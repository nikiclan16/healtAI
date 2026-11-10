"""Procesamiento por lotes (RF03.2): CSV/XLSX → inferencia + reglas por fila, sin persistir.

Se admiten dos formatos de cabecera, que pueden leerse con el mismo archivo:

- **Formato de sistematización** de la investigación (`Formato.xlsx`, hoja «Sistematizacion», o su CSV): los
  ítems de WHO-5 y DASS-21 van por separado y los totales se calculan aquí (las fórmulas de Excel no
  siempre traen valor guardado). `V9_*` y `V11_*` son columnas 0/1.
- **Formato corto** con las variables del formulario (`who5_total`, `dass_depresion`…).

`Sujeto`, `Nivel_de_Riesgo`, `Ruta_1`, `Ruta_2` y `V1`–`V6` se reconocen pero **se descartan**: el modelo no usa
variables sociodemográficas, `Nivel_de_Riesgo` (riesgo de amputación) nunca entra al modelo (RF02.4) y el código
del sujeto no se devuelve ni se guarda (RNF01.2). Cualquier otra columna desconocida rechaza el archivo, así un
identificador (cédula, nombre…) no entra por esta vía. Cada fila se valida con el mismo contrato que `/evaluaciones`.
"""

import csv
import hashlib
import io
import re
import unicodedata
from typing import Any

from fastapi import HTTPException
from pydantic import ValidationError

from .. import APP_VERSION
from ..config import get_settings
from ..modelo.component import ComponenteEstratificacionSaludMental
from ..schemas_clinicos import ScreeningFormIn
from . import evaluacion as svc

MAX_BYTES = 5 * 1024 * 1024
MAX_FILAS = 2000

# ── Formato corto: columna → (ruta en el formulario, tipo) ──────────────────────
_ENTERO, _BOOL, _TRAT = "entero", "bool", "tratamiento"
COLUMNAS: dict[str, tuple[tuple[str, ...], str]] = {
    "v8_tiempo_diagnostico": (("v8_tiempo_diagnostico",), _ENTERO),
    "v9_tratamiento": (("v9_tratamiento",), _TRAT),
    "v11_hipertension": (("v11", "hipertension"), _BOOL),
    "v11_cardiaca": (("v11", "cardiaca"), _BOOL),
    "v11_obesidad": (("v11", "obesidad"), _BOOL),
    "v11_otra": (("v11", "otra"), _BOOL),
    "v12_percepcion_salud": (("v12_percepcion_salud",), _ENTERO),
    "v13_apoyo_familiar": (("v13_apoyo_familiar",), _ENTERO),
    "v14_actividad_fisica": (("v14_actividad_fisica",), _ENTERO),
    "v15_calidad_sueno": (("v15_calidad_sueno",), _ENTERO),
    "who5_total": (("who5_total",), _ENTERO),
    "dass_depresion": (("dass_depresion",), _ENTERO),
    "dass_ansiedad": (("dass_ansiedad",), _ENTERO),
    "dass_estres": (("dass_estres",), _ENTERO),
    "dass_item21": (("dass_item21",), "item21"),
    # Opcionales: si faltan, se asumen sin alerta del profesional.
    "alerta_riesgo_suicida": (("alertas_profesional", "riesgo_suicida"), "alerta"),
    "alerta_deterioro_agudo": (("alertas_profesional", "deterioro_agudo"), "alerta"),
    "alerta_riesgo_urgente": (("alertas_profesional", "riesgo_urgente"), "alerta"),
}

# ── Formato de sistematización ──────────────────────────────────────────────────
# Encabezado normalizado (sin tildes, minúsculas, espacios → «_») → clave interna.
_SIMPLES = {
    "v8_tiempodiagnosticodm2": "v8_tiempo_diagnostico",
    "v12_percepcionsalud": "v12_percepcion_salud",
    "v13_apoyofamiliar": "v13_apoyo_familiar",
    "v14_actividadfisica": "v14_actividad_fisica",
    "v15_calidadsueno": "v15_calidad_sueno",
    "v9_trat_dietaejercicio": "v9_dieta_ejercicio",
    "v9_trat_orales": "v9_orales",
    "v9_trat_insulina": "v9_insulina",
    "v9_trat_oralesinsulina": "v9_orales_insulina",
    "v9_trat_ninguno": "v9_ninguno",
    "v11_enf_ninguna": "v11_ninguna",
    "v11_enf_hipertension": "v11_hipertension",
    "v11_enf_cardiaca": "v11_cardiaca",
    "v11_enf_obesidad": "v11_obesidad",
    "v11_enf_otra": "v11_otra",
    "total_who5": "who5_total",
    "total_depresion": "dass_depresion",
    "total_ansiedad": "dass_ansiedad",
    "total_estres": "dass_estres",
}
_NOMBRE_FORMATO = {  # cómo se llama en el formato de sistematización (para los mensajes)
    "v8_tiempo_diagnostico": "V8_TiempoDiagnosticoDM2",
    "v11_hipertension": "V11_Enf_Hipertension",
    "v11_cardiaca": "V11_Enf_Cardiaca",
    "v11_obesidad": "V11_Enf_Obesidad",
    "v11_otra": "V11_Enf_Otra",
    "v12_percepcion_salud": "V12_PercepcionSalud",
    "v13_apoyo_familiar": "V13_ApoyoFamiliar",
    "v14_actividad_fisica": "V14_ActividadFisica",
    "v15_calidad_sueno": "V15_CalidadSueno",
    "dass_item21": "DASS21 - Depresión - Ítem 21",
}
_TRATAMIENTOS = {
    "v9_dieta_ejercicio": "dieta_ejercicio",
    "v9_orales": "orales",
    "v9_insulina": "insulina",
    "v9_orales_insulina": "orales_insulina",
    "v9_ninguno": "ninguno",
}
_IGNORADA, _DERIVADA = "~ignorada", "~derivada"
_IGNORADAS = {  # se leen pero no se usan (ver docstring del módulo)
    "sujeto", "nivel_de_riesgo", "ruta_1", "ruta_2", "v1_edad", "v2_sexo", "v3_estadocivil",
    "v4_niveleducativo", "v5_situacionlaboral", "v6_estrato",
}
_DERIVADAS = {"puntaje_who5_pct", "total_dass21_general", "total_sociodemografico"}  # fórmulas del formato

_WHO5_ITEMS = [f"who5_i{i}" for i in range(1, 6)]
_DASS_ITEMS = {  # dimensión → ítems (el 21 de depresión es `dass_item21`, que el modelo usa por separado)
    "depresion": [f"dep_i{i}" for i in (3, 5, 10, 13, 16, 17)],
    "ansiedad": [f"ans_i{i}" for i in (2, 4, 7, 9, 15, 19, 20)],
    "estres": [f"est_i{i}" for i in (1, 6, 8, 11, 12, 14, 18)],
}
_DASS_TOTAL = {"depresion": "dass_depresion", "ansiedad": "dass_ansiedad", "estres": "dass_estres"}
_DIMENSION = {"depresi": "depresion", "ansiedad": "ansiedad", "estr": "estres"}
_DASS_NUMEROS = {"depresion": {3, 5, 10, 13, 16, 17, 21}, "ansiedad": {2, 4, 7, 9, 15, 19, 20}, "estres": {1, 6, 8, 11, 12, 14, 18}}
# «\S{0,2}tem» tolera «Ítem», «Item» y el «�tem» de un archivo mal codificado.
_RE_WHO5 = re.compile(r"^who-?5 ?- ?\S{0,2}tem (\d)\b")
_RE_DASS = re.compile(r"^dass-?21 ?- ?(depresi|ansiedad|estr)\S{0,2} ?- ?\S{0,2}tem (\d{1,2})\b")

_SIEMPRE = [
    "v8_tiempo_diagnostico", "v11_hipertension", "v11_cardiaca", "v11_obesidad", "v11_otra",
    "v12_percepcion_salud", "v13_apoyo_familiar", "v14_actividad_fisica", "v15_calidad_sueno", "dass_item21",
]
OPCIONALES = {c for c, (_, tipo) in COLUMNAS.items() if tipo == "alerta"}
REQUERIDAS = [c for c in COLUMNAS if c not in OPCIONALES]

_SI = {"1", "true", "si", "sí", "s", "yes", "y", "x", "verdadero"}
_NO = {"0", "false", "no", "n", "falso"}
_SIN_DATO = {"", "na", "n/a", "nan", "none", "null", "no evaluable", "no_evaluable"}

PLANTILLA = [  # formato corto (el de sistematización se sirve desde app/plantillas/)
    ",".join(COLUMNAS),
    "10,orales,1,0,0,0,3,4,0,2,8,9,8,12,1,0,0,0",
]


class FilaInvalida(ValueError):
    pass


def _texto(valor: Any) -> str:
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    return str(valor).strip()


def _normalizar(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto.strip().lower())
    return re.sub(r"\s+", " ", "".join(c for c in t if not unicodedata.combining(c)))


def _clasificar(encabezado: str) -> str | None:
    """Clave interna de una columna; `_IGNORADA`/`_DERIVADA` si se descarta; None si no se reconoce."""
    n = _normalizar(encabezado)
    simple = n.replace(" ", "_")
    if simple in COLUMNAS:
        return simple
    if simple in _SIMPLES:
        return _SIMPLES[simple]
    if simple in _IGNORADAS:
        return _IGNORADA
    if simple in _DERIVADAS:
        return _DERIVADA
    if m := _RE_WHO5.match(n):
        return f"who5_i{m[1]}" if 1 <= int(m[1]) <= 5 else None
    if m := _RE_DASS.match(n):
        dimension, numero = _DIMENSION[m[1]], int(m[2])
        if numero not in _DASS_NUMEROS[dimension]:
            return None
        return "dass_item21" if (dimension, numero) == ("depresion", 21) else f"{dimension[:3]}_i{numero}"
    return None


def _etiqueta(clave: str, original: str) -> str:
    """Nombre corto de la columna para los mensajes de error."""
    if m := re.fullmatch(r"who5_i(\d)", clave):
        return f"WHO5 ítem {m[1]}"
    if m := re.fullmatch(r"(dep|ans|est)_i(\d+)", clave):
        return f"DASS21 {dict(dep='depresión', ans='ansiedad', est='estrés')[m[1]]} ítem {m[2]}"
    if clave == "dass_item21" and len(original) > 30:
        return "DASS21 depresión ítem 21"
    return original if len(original) <= 40 else original[:40] + "…"


def _convertir(columna: str, tipo: str, valor: Any) -> Any:
    t = _texto(valor)
    k = t.lower()
    if tipo == _ENTERO:
        try:
            f = float(t.replace(",", "."))
        except ValueError:
            raise FilaInvalida(f"{columna}: se esperaba un número entero") from None
        if not f.is_integer():
            raise FilaInvalida(f"{columna}: se esperaba un número entero")
        return int(f)
    if tipo == "item21":
        return None if k in _SIN_DATO else _convertir(columna, _ENTERO, valor)
    if tipo in (_BOOL, "alerta"):
        if k in _SI:
            return True
        if k in _NO or (tipo == "alerta" and k == ""):
            return False
        raise FilaInvalida(f"{columna}: use 1/0, sí/no o true/false")
    return k  # tratamiento: lo valida el contrato


def _mensaje(error: dict[str, Any]) -> str:
    """Mensaje de validación en español para el usuario del lote."""
    ctx = error.get("ctx") or {}
    match error["type"]:
        case "less_than_equal":
            return f"debe ser como máximo {ctx.get('le')}"
        case "greater_than_equal":
            return f"debe ser como mínimo {ctx.get('ge')}"
        case "literal_error":
            return f"valor no permitido (use: {ctx.get('expected', '').replace(chr(39), '')})"
        case "missing":
            return "dato obligatorio"
        case _:
            return str(error["msg"])


# ── Armado de una fila ──────────────────────────────────────────────────────────

def _vacio(fila: dict[str, Any], clave: str) -> bool:
    return _texto(fila.get(clave)) == ""


def _bandera(etq: str, valor: Any) -> bool:
    return False if _texto(valor) == "" else _convertir(etq, _BOOL, valor)


def _item(etq: str, valor: Any, tope: int) -> int:
    n = _convertir(etq, _ENTERO, valor)
    if not 0 <= n <= tope:
        raise FilaInvalida(f"{etq}: debe estar entre 0 y {tope}")
    return n


def _total(fila: dict[str, Any], et: dict[str, str], items: list[str], clave_total: str, tope: int,
           nombre: str, extra: str | None = None) -> int:
    """Total de una escala: suma de sus ítems (formato de sistematización) o la columna de total (formato corto).

    `extra` es un ítem que puede quedar vacío (el 21 de DASS-21 = «no evaluable»): si falta, la suma queda
    incompleta, pero la regla R1 fuerza la Ruta A de todos modos."""
    def n(k: str) -> str:
        return et.get(k, k)

    con_items = all(k in fila for k in items) and any(not _vacio(fila, k) for k in items)
    if con_items:
        faltan = [n(k) for k in items if _vacio(fila, k)]
        if faltan:
            raise FilaInvalida(f"{nombre}: faltan ítems ({', '.join(faltan)})")
        suma = sum(_item(n(k), fila[k], tope) for k in items)
        completa = True
        if extra and not _vacio(fila, extra):
            suma += _item(n(extra), fila[extra], tope)
        elif extra:
            completa = False
        if completa and clave_total in fila and not _vacio(fila, clave_total):
            declarado = _convertir(n(clave_total), _ENTERO, fila[clave_total])
            if declarado != suma:
                raise FilaInvalida(f"{n(clave_total)} ({declarado}) no coincide con la suma de los ítems ({suma})")
        return suma
    if clave_total in fila and not _vacio(fila, clave_total):
        return _convertir(n(clave_total), _ENTERO, fila[clave_total])
    raise FilaInvalida(f"{nombre}: complete todos los ítems o el total")


def _tratamiento(fila: dict[str, Any], et: dict[str, str]) -> str:
    if "v9_tratamiento" in fila:
        return _convertir(et["v9_tratamiento"], _TRAT, fila["v9_tratamiento"])
    marcados = [valor for clave, valor in _TRATAMIENTOS.items() if _bandera(et.get(clave, clave), fila[clave])]
    if len(marcados) != 1:
        raise FilaInvalida("V9 (tratamiento): marque exactamente una opción")
    return marcados[0]


def _comorbilidades(fila: dict[str, Any], et: dict[str, str]) -> dict[str, bool]:
    datos = {c: _bandera(et.get(f"v11_{c}", f"v11_{c}"), fila[f"v11_{c}"]) for c in ("hipertension", "cardiaca", "obesidad", "otra")}
    if "v11_ninguna" in fila:  # formato de sistematización: «Ninguna» es excluyente
        ninguna = _bandera(et["v11_ninguna"], fila["v11_ninguna"])
        if ninguna and any(datos.values()):
            raise FilaInvalida("V11: «Ninguna» no puede marcarse junto con otra enfermedad")
        if not ninguna and not any(datos.values()):
            raise FilaInvalida("V11: marque «Ninguna» o al menos una enfermedad")
    return datos


def _formulario(fila: dict[str, Any], et: dict[str, str]) -> ScreeningFormIn:
    def n(k: str) -> str:
        return et.get(k, k)

    datos: dict[str, Any] = {
        "v8_tiempo_diagnostico": _convertir(n("v8_tiempo_diagnostico"), _ENTERO, fila["v8_tiempo_diagnostico"]),
        "v9_tratamiento": _tratamiento(fila, et),
        "v11": _comorbilidades(fila, et),
        "who5_total": _total(fila, et, _WHO5_ITEMS, "who5_total", 5, "WHO-5"),
        "dass_depresion": _total(fila, et, _DASS_ITEMS["depresion"], "dass_depresion", 3, "DASS-21 depresión", extra="dass_item21"),
        "dass_ansiedad": _total(fila, et, _DASS_ITEMS["ansiedad"], "dass_ansiedad", 3, "DASS-21 ansiedad"),
        "dass_estres": _total(fila, et, _DASS_ITEMS["estres"], "dass_estres", 3, "DASS-21 estrés"),
        "dass_item21": _convertir(n("dass_item21"), "item21", fila["dass_item21"]),
        "alertas_profesional": {"riesgo_suicida": False, "deterioro_agudo": False, "riesgo_urgente": False},
    }
    for clave in ("v12_percepcion_salud", "v13_apoyo_familiar", "v14_actividad_fisica", "v15_calidad_sueno"):
        datos[clave] = _convertir(n(clave), _ENTERO, fila[clave])
    for clave in OPCIONALES:
        if clave in fila:
            ruta = COLUMNAS[clave][0]
            datos[ruta[0]][ruta[1]] = _bandera(n(clave), fila[clave])
    try:
        return ScreeningFormIn.model_validate(datos)
    except ValidationError as exc:
        inverso = {ruta: col for col, (ruta, _) in COLUMNAS.items()}
        errores = []
        for e in exc.errors():
            loc = tuple(str(p) for p in e["loc"])
            columna = inverso.get(loc)
            errores.append(f"{n(columna) if columna else '.'.join(loc)}: {_mensaje(e)}")
        raise FilaInvalida("; ".join(errores)) from None


# ── Lectura del archivo ─────────────────────────────────────────────────────────

def _leer_csv(contenido: bytes) -> list[list[Any]]:
    for codificacion in ("utf-8-sig", "cp1252", "latin-1"):  # Excel en Windows guarda en cp1252
        try:
            texto = contenido.decode(codificacion)
            break
        except UnicodeDecodeError:
            continue
    muestra = texto[:4096]
    delimitador = max(",;\t", key=muestra.count)  # Excel en español exporta con ';'
    return [list(r) for r in csv.reader(io.StringIO(texto), delimiter=delimitador)]


def _leer_xlsx(contenido: bytes) -> list[list[Any]]:
    from openpyxl import load_workbook

    try:
        libro = load_workbook(io.BytesIO(contenido), read_only=True, data_only=True)
    except Exception:
        raise HTTPException(422, "No se pudo leer el archivo XLSX") from None
    try:
        hojas = libro.worksheets
        hoja = next((h for h in hojas if _normalizar(h.title).startswith("sistematizacion")), hojas[0])
        return [list(r) for r in hoja.iter_rows(values_only=True)]
    finally:
        libro.close()


def _faltantes(claves: set[str]) -> list[str]:
    faltan = [f"{c} (o {_NOMBRE_FORMATO[c]})" if c in _NOMBRE_FORMATO else c for c in _SIEMPRE if c not in claves]
    if "v9_tratamiento" not in claves and not set(_TRATAMIENTOS) <= claves:
        faltan.append("tratamiento V9 (v9_tratamiento o las 5 columnas V9_Trat_*)")
    if "who5_total" not in claves and not set(_WHO5_ITEMS) <= claves:
        faltan.append("WHO-5 (who5_total / Total_WHO5, o los 5 ítems)")
    for dimension, items in _DASS_ITEMS.items():
        if _DASS_TOTAL[dimension] not in claves and not set(items) <= claves:
            faltan.append(f"DASS-21 {dimension} (Total_{dimension.capitalize()} o sus ítems)")
    return faltan


class Tabla:
    def __init__(self, usadas: list[str], ignoradas: list[str], etiquetas: dict[str, str], registros: list[tuple[int, dict[str, Any]]]):
        self.usadas, self.ignoradas, self.etiquetas, self.registros = usadas, ignoradas, etiquetas, registros


def leer_tabla(nombre: str, contenido: bytes) -> Tabla:
    """Lee el archivo: columnas usadas/ignoradas y las filas con datos (número de fila del archivo, valores por clave)."""
    if len(contenido) > MAX_BYTES:
        raise HTTPException(413, f"El archivo supera el máximo de {MAX_BYTES // (1024 * 1024)} MB")
    extension = nombre.lower().rsplit(".", 1)[-1] if "." in nombre else ""
    if extension == "xlsx":
        filas = _leer_xlsx(contenido)
    elif extension in ("csv", "txt"):
        filas = _leer_csv(contenido)
    else:
        raise HTTPException(415, "Formato no admitido: use un archivo .csv o .xlsx")

    con_datos = [(numero, r) for numero, r in enumerate(filas, start=1) if any(_texto(c) for c in r)]
    if not con_datos:
        raise HTTPException(422, "El archivo está vacío")
    (_, encabezado), *cuerpo = con_datos

    originales = [_texto(c) for c in encabezado]
    claves = [_clasificar(o) if o else None for o in originales]
    desconocidas = [o[:60] for o, k in zip(originales, claves) if o and k is None]
    if desconocidas:
        raise HTTPException(
            422,
            "Columnas no reconocidas (no se admiten identificadores del paciente ni columnas fuera del "
            f"Diccionario {get_settings().dictionary_version}): {', '.join(desconocidas)}",
        )
    usadas = [(o, k) for o, k in zip(originales, claves) if k and k not in (_IGNORADA, _DERIVADA)]
    repetidas = sorted({k for _, k in usadas if [x for _, x in usadas].count(k) > 1})
    if repetidas:
        raise HTTPException(422, f"Columnas repetidas: {', '.join(repetidas)}")
    faltantes = _faltantes({k for _, k in usadas})
    if faltantes:
        raise HTTPException(422, f"Faltan columnas obligatorias: {', '.join(faltantes)}")

    # Los totales con fórmula del formato de sistematización no cuentan para saber si una fila está vacía.
    derivadas = {_DERIVADA} | ({"who5_total", "dass_depresion", "dass_ansiedad", "dass_estres"} if "who5_i1" in claves else set())
    cuerpo = [(n, r) for n, r in cuerpo if any(_texto(c) for c, k in zip(r, claves) if k not in derivadas)]
    if not cuerpo:
        raise HTTPException(422, "El archivo no tiene filas de datos debajo de la cabecera")
    if len(cuerpo) > MAX_FILAS:
        raise HTTPException(413, f"El archivo supera el máximo de {MAX_FILAS} filas por lote")

    posiciones = [(i, k) for i, k in enumerate(claves) if k and k not in (_IGNORADA, _DERIVADA)]
    registros = [(n, {k: r[i] if i < len(r) else None for i, k in posiciones}) for n, r in cuerpo]
    return Tabla(
        usadas=[o for o, _ in usadas],
        ignoradas=[o for o, k in zip(originales, claves) if k in (_IGNORADA, _DERIVADA)],
        etiquetas={k: _etiqueta(k, o) for o, k in usadas},
        registros=registros,
    )


# ── Procesamiento ───────────────────────────────────────────────────────────────

def procesar(modelo: ComponenteEstratificacionSaludMental, nombre: str, contenido: bytes) -> dict:
    tabla = leer_tabla(nombre, contenido)
    resultados = []
    for numero, fila in tabla.registros:
        try:
            r = svc.ejecutar(modelo, _formulario(fila, tabla.etiquetas))
        except FilaInvalida as exc:
            resultados.append({"fila": numero, "ok": False, "error": str(exc)})
            continue
        resultados.append(
            {
                "fila": numero,
                "ok": True,
                "probabilidadRA": r["prediccion"]["probabilidadRA"],
                "rutaBase": r["prediccion"]["rutaBase"],
                "rutaSistema": r["rutaSistema"],
                "escalada": r["escalada"],
                "reglas": [x["code"] for x in r["reglas"]["triggered"]],
                "shapTop3": r["prediccion"]["shapTop3"],
            }
        )

    ok = [x for x in resultados if x["ok"]]
    return {
        "archivo": nombre[:120],
        "sha256": hashlib.sha256(contenido).hexdigest(),
        "columnas": tabla.usadas,
        "columnasIgnoradas": tabla.ignoradas,
        "resumen": {
            "filas": len(resultados),
            "procesadas": len(ok),
            "conError": len(resultados) - len(ok),
            "baseRA": sum(x["rutaBase"] == "A" for x in ok),
            "baseRB": sum(x["rutaBase"] == "B" for x in ok),
            "escaladas": sum(x["escalada"] for x in ok),
            "finalA": sum(x["rutaSistema"] == "A" for x in ok),
            "finalB": sum(x["rutaSistema"] == "B" for x in ok),
        },
        "versiones": {
            "app": APP_VERSION,
            "modelo": modelo.artefacto.version,
            "diccionario": get_settings().dictionary_version,
        },
        "modeloPlaceholder": modelo.artefacto.placeholder,
        "resultados": resultados,
    }
