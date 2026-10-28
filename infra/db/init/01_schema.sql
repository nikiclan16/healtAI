-- healthAI · esquema PostgreSQL
-- Se ejecuta una sola vez al crear el volumen (docker-entrypoint-initdb.d).
--
-- Principios:
--   * Seudonimización (RNF01.2): no existe ninguna columna para cédula ni nombre de paciente.
--   * Bitácora inmutable (RNF01.3): evaluations, decisions y audit_log son de solo inserción
--     (triggers) y audit_log encadena hashes SHA-256 verificables.
--   * Regla de seguridad (RF05.1): la base rechaza degradar a Ruta B una evaluación bloqueada.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ─────────────────────────────── Catálogos y accesos ───────────────────────────────

CREATE TABLE sites (
    code    TEXT PRIMARY KEY CHECK (code IN ('BAQ', 'RHA', 'VUP')),
    ciudad  TEXT NOT NULL,
    centro  TEXT NOT NULL,
    nombre  TEXT NOT NULL
);

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          CITEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,                       -- bcrypt ($2a$/$2b$)
    nombre         TEXT NOT NULL,
    rol            TEXT NOT NULL CHECK (rol IN ('evaluador', 'investigador')),  -- perfil RBAC
    activo         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles operativos que el usuario puede declarar en el portal de acceso.
CREATE TABLE user_cargos (
    user_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    cargo    TEXT NOT NULL CHECK (cargo IN ('medico', 'psicologo', 'enfermeria', 'investigador')),
    PRIMARY KEY (user_id, cargo)
);

-- Sedes en las que el usuario está autorizado a operar.
CREATE TABLE user_sites (
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    site_code  TEXT NOT NULL REFERENCES sites (code),
    PRIMARY KEY (user_id, site_code)
);

-- El cargo "investigador" solo es compatible con el perfil RBAC "investigador" y viceversa.
CREATE FUNCTION trg_user_cargo_consistency() RETURNS trigger AS $$
DECLARE
    perfil TEXT;
BEGIN
    SELECT rol INTO perfil FROM users WHERE id = NEW.user_id;
    IF (NEW.cargo = 'investigador') <> (perfil = 'investigador') THEN
        RAISE EXCEPTION 'El cargo % no es compatible con el perfil %', NEW.cargo, perfil;
    END IF;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_cargos_consistency
    BEFORE INSERT OR UPDATE ON user_cargos
    FOR EACH ROW EXECUTE FUNCTION trg_user_cargo_consistency();

-- ─────────────────────────── Código seudonimizado PAC-AAAA-NNNN ───────────────────────────

CREATE TABLE patient_code_counters (
    anio    INT PRIMARY KEY,
    ultimo  INT NOT NULL
);

-- Consecutivo por año, seguro ante concurrencia (el UPSERT bloquea la fila del año).
CREATE FUNCTION next_patient_code() RETURNS TEXT AS $$
DECLARE
    y INT := extract(year FROM now())::int;
    n INT;
BEGIN
    INSERT INTO patient_code_counters (anio, ultimo) VALUES (y, 1)
    ON CONFLICT (anio) DO UPDATE SET ultimo = patient_code_counters.ultimo + 1
    RETURNING ultimo INTO n;
    RETURN 'PAC-' || y || '-' || lpad(n::text, 4, '0');
END
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────── Evaluaciones ────────────────────────────────────

CREATE TABLE evaluations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_paciente      TEXT NOT NULL UNIQUE DEFAULT next_patient_code(),
    site_code            TEXT NOT NULL REFERENCES sites (code),
    user_id              UUID NOT NULL REFERENCES users (id),
    cargo                TEXT NOT NULL CHECK (cargo IN ('medico', 'psicologo', 'enfermeria', 'investigador')),

    formulario           JSONB NOT NULL,   -- respuestas del formulario (ScreeningForm)
    entrada_modelo       JSONB NOT NULL,   -- variables enviadas al clasificador (sin ADA/IWGDF)
    prediccion           JSONB NOT NULL,   -- respuesta del modelo (P(RA), SHAP, confianza…)
    reglas               JSONB NOT NULL,   -- resultado del motor de reglas (incluye `locked`)

    probabilidad_ra      NUMERIC(6, 4) NOT NULL CHECK (probabilidad_ra BETWEEN 0 AND 1),
    ruta_base            TEXT NOT NULL CHECK (ruta_base IN ('A', 'B')),
    ruta_sistema         TEXT NOT NULL CHECK (ruta_sistema IN ('A', 'B')),
    escalada             BOOLEAN NOT NULL,
    reglas_activadas     TEXT[] NOT NULL DEFAULT '{}',

    version_app          TEXT NOT NULL,
    version_modelo       TEXT NOT NULL,
    version_diccionario  TEXT NOT NULL,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX evaluations_site_created_idx ON evaluations (site_code, created_at DESC);
CREATE INDEX evaluations_user_created_idx ON evaluations (user_id, created_at DESC);

-- Decisión humana final (RF06): una sola por evaluación; es la etiqueta de referencia.
CREATE TABLE decisions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id  UUID NOT NULL UNIQUE REFERENCES evaluations (id),
    accion         TEXT NOT NULL CHECK (accion IN ('confirmar', 'rechazar', 'ajustar')),
    ruta_final     TEXT NOT NULL CHECK (ruta_final IN ('A', 'B')),
    justificacion  TEXT NOT NULL DEFAULT '',
    user_id        UUID NOT NULL REFERENCES users (id),
    decidido_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE FUNCTION trg_decision_validate() RETURNS trigger AS $$
DECLARE
    ev evaluations%ROWTYPE;
BEGIN
    SELECT * INTO ev FROM evaluations WHERE id = NEW.evaluation_id;

    -- Regla de seguridad: no se puede degradar a Ruta B una evaluación bloqueada.
    IF COALESCE((ev.reglas ->> 'locked')::boolean, FALSE) AND NEW.ruta_final = 'B' THEN
        RAISE EXCEPTION 'Regla de seguridad activa: la evaluación % no puede asignarse a Ruta B', ev.codigo_paciente;
    END IF;

    IF NEW.accion = 'confirmar' AND NEW.ruta_final <> ev.ruta_sistema THEN
        RAISE EXCEPTION '"confirmar" exige la misma ruta sugerida por el sistema (%)', ev.ruta_sistema;
    END IF;

    -- Diferir de la ruta sugerida exige justificación clínica.
    IF NEW.ruta_final <> ev.ruta_sistema AND length(btrim(NEW.justificacion)) < 10 THEN
        RAISE EXCEPTION 'Diferir de la ruta sugerida exige una justificación clínica (mínimo 10 caracteres)';
    END IF;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER decisions_validate
    BEFORE INSERT ON decisions
    FOR EACH ROW EXECUTE FUNCTION trg_decision_validate();

-- ───────────────────────── Bitácora de auditoría (encadenada) ─────────────────────────

CREATE TABLE audit_log (
    id             BIGSERIAL PRIMARY KEY,
    ts             TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    evento         TEXT NOT NULL,   -- login, login_fallido, inferencia, decision, …
    user_id        UUID REFERENCES users (id),
    site_code      TEXT REFERENCES sites (code),
    evaluation_id  UUID REFERENCES evaluations (id),
    detalle        JSONB NOT NULL DEFAULT '{}'::jsonb,
    prev_hash      TEXT NOT NULL,
    hash           TEXT NOT NULL
);

CREATE INDEX audit_log_evaluation_idx ON audit_log (evaluation_id);
CREATE INDEX audit_log_evento_ts_idx ON audit_log (evento, ts DESC);

CREATE FUNCTION audit_hash(
    prev TEXT, ts TIMESTAMPTZ, evento TEXT, user_id UUID, site_code TEXT, evaluation_id UUID, detalle JSONB
) RETURNS TEXT AS $$
    SELECT encode(
        digest(
            prev || '|' || to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' || evento || '|' ||
            COALESCE(user_id::text, '') || '|' || COALESCE(site_code, '') || '|' ||
            COALESCE(evaluation_id::text, '') || '|' || detalle::text,
            'sha256'),
        'hex')
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION trg_audit_log_chain() RETURNS trigger AS $$
DECLARE
    prev TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(727201);   -- serializa inserciones para mantener la cadena
    SELECT hash INTO prev FROM audit_log ORDER BY id DESC LIMIT 1;
    NEW.prev_hash := COALESCE(prev, repeat('0', 64));
    NEW.ts := clock_timestamp();
    NEW.hash := audit_hash(NEW.prev_hash, NEW.ts, NEW.evento, NEW.user_id, NEW.site_code, NEW.evaluation_id, NEW.detalle);
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_chain
    BEFORE INSERT ON audit_log
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log_chain();

-- Devuelve el id del primer registro cuya cadena no cuadra, o NULL si está íntegra.
CREATE FUNCTION verify_audit_chain() RETURNS BIGINT AS $$
DECLARE
    r RECORD;
    expected_prev TEXT := repeat('0', 64);
BEGIN
    FOR r IN SELECT * FROM audit_log ORDER BY id LOOP
        IF r.prev_hash <> expected_prev
           OR r.hash <> audit_hash(r.prev_hash, r.ts, r.evento, r.user_id, r.site_code, r.evaluation_id, r.detalle) THEN
            RETURN r.id;
        END IF;
        expected_prev := r.hash;
    END LOOP;
    RETURN NULL;
END
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────── Registros de solo inserción ───────────────────────────────

CREATE FUNCTION trg_prevent_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es de solo inserción (registro inmutable)', TG_TABLE_NAME
        USING ERRCODE = 'integrity_constraint_violation';
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER evaluations_immutable BEFORE UPDATE OR DELETE ON evaluations
    FOR EACH ROW EXECUTE FUNCTION trg_prevent_mutation();
CREATE TRIGGER evaluations_no_truncate BEFORE TRUNCATE ON evaluations
    FOR EACH STATEMENT EXECUTE FUNCTION trg_prevent_mutation();

CREATE TRIGGER decisions_immutable BEFORE UPDATE OR DELETE ON decisions
    FOR EACH ROW EXECUTE FUNCTION trg_prevent_mutation();
CREATE TRIGGER decisions_no_truncate BEFORE TRUNCATE ON decisions
    FOR EACH STATEMENT EXECUTE FUNCTION trg_prevent_mutation();

CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION trg_prevent_mutation();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION trg_prevent_mutation();
