\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.fails(q text) RETURNS boolean AS $$
BEGIN
    EXECUTE q;
    RETURN FALSE;
EXCEPTION WHEN OTHERS THEN
    RETURN TRUE;
END
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    uid UUID; aid UUID; e1 UUID; e2 UUID; e3 UUID;
    c1 TEXT; c2 TEXT; ok BOOLEAN; n INT;
    y TEXT := extract(year FROM now())::int::text;
    ev TEXT := $e$INSERT INTO evaluations (site_code, user_id, cargo, formulario, entrada_modelo, prediccion, reglas,
        probabilidad_ra, ruta_base, ruta_sistema, escalada, reglas_activadas, version_app, version_modelo, version_diccionario)
        VALUES ('BAQ', %L, 'medico', '{}', '{}', '{}', %L, %s, %L, %L, false, '{}', '0.1.0', 'v1.0.0', 'v2.1') RETURNING id$e$;
BEGIN
    -- Seed
    SELECT count(*) INTO n FROM sites;       ASSERT n = 3, 'sedes';
    SELECT count(*) INTO n FROM users;       ASSERT n = 3, 'usuarios';
    SELECT count(*) INTO n FROM user_cargos; ASSERT n = 4, 'cargos';
    SELECT count(*) INTO n FROM user_sites;  ASSERT n = 9, 'sedes por usuario';

    -- Contraseña bcrypt
    SELECT id, (password_hash = crypt('demo1234', password_hash)) INTO uid, ok FROM users WHERE email = 'evaluador@cuc.test';
    ASSERT ok, 'contraseña correcta valida';
    SELECT (password_hash = crypt('otra', password_hash)) INTO ok FROM users WHERE id = uid;
    ASSERT NOT ok, 'contraseña incorrecta rechazada';
    ASSERT (SELECT password_hash LIKE '$2a$%' FROM users WHERE id = uid), 'hash bcrypt';

    -- Cargo investigador no compatible con perfil evaluador
    ASSERT pg_temp.fails(format('INSERT INTO user_cargos VALUES (%L, ''investigador'')', uid)), 'cargo/perfil';

    -- Roles creables: un cargo nuevo es válido para su perfil base; el admin no admite cargos
    SELECT count(*) INTO n FROM cargos; ASSERT n = 4, 'cargos base';
    INSERT INTO cargos (code, label, rol) VALUES ('trabajo_social', 'Trabajo Social', 'evaluador');
    INSERT INTO user_cargos VALUES (uid, 'trabajo_social');
    INSERT INTO users (email, password_hash, nombre, rol) VALUES ('admin@test', 'x', 'Admin', 'admin') RETURNING id INTO aid;
    ASSERT pg_temp.fails(format('INSERT INTO user_cargos VALUES (%L, ''medico'')', aid)), 'admin sin cargos';
    ASSERT pg_temp.fails($c$INSERT INTO cargos (code, label, rol) VALUES ('Mal Codigo', 'xyz', 'evaluador')$c$), 'formato de código';
    ASSERT pg_temp.fails($c$INSERT INTO cargos (code, label, rol) VALUES ('otro_cargo', 'Otro', 'admin')$c$), 'cargo no puede ser admin';

    -- Códigos seudonimizados consecutivos
    EXECUTE format(ev, uid, '{"locked": false}', '0.6080', 'A', 'A') INTO e1;
    EXECUTE format(ev, uid, '{"locked": false}', '0.3000', 'B', 'B') INTO e2;
    EXECUTE format(ev, uid, '{"locked": true}',  '0.7000', 'A', 'A') INTO e3;
    SELECT codigo_paciente INTO c1 FROM evaluations WHERE id = e1;
    SELECT codigo_paciente INTO c2 FROM evaluations WHERE id = e2;
    ASSERT c1 = 'PAC-' || y || '-0001', 'codigo 1: ' || c1;
    ASSERT c2 = 'PAC-' || y || '-0002', 'codigo 2: ' || c2;

    -- Inmutabilidad de evaluaciones
    ASSERT pg_temp.fails(format('UPDATE evaluations SET escalada = true WHERE id = %L', e1)), 'update evaluations';
    ASSERT pg_temp.fails(format('DELETE FROM evaluations WHERE id = %L', e1)), 'delete evaluations';
    ASSERT pg_temp.fails('TRUNCATE evaluations CASCADE'), 'truncate evaluations';

    -- Decisiones
    ASSERT pg_temp.fails(format($q$INSERT INTO decisions (evaluation_id, accion, ruta_final, justificacion, user_id) VALUES (%L, 'confirmar', 'B', '', %L)$q$, e1, uid)),
        'confirmar con otra ruta';
    ASSERT pg_temp.fails(format($q$INSERT INTO decisions (evaluation_id, accion, ruta_final, justificacion, user_id) VALUES (%L, 'rechazar', 'B', 'corto', %L)$q$, e1, uid)),
        'diferir sin justificacion';
    ASSERT pg_temp.fails(format($q$INSERT INTO decisions (evaluation_id, accion, ruta_final, justificacion, user_id) VALUES (%L, 'rechazar', 'B', 'justificacion clinica larga', %L)$q$, e3, uid)),
        'regla de seguridad bloquea Ruta B';
    EXECUTE format($q$INSERT INTO decisions (evaluation_id, accion, ruta_final, justificacion, user_id) VALUES (%L, 'confirmar', 'A', '', %L)$q$, e1, uid);
    ASSERT pg_temp.fails(format($q$INSERT INTO decisions (evaluation_id, accion, ruta_final, justificacion, user_id) VALUES (%L, 'confirmar', 'A', '', %L)$q$, e1, uid)),
        'una decision por evaluacion';
    ASSERT pg_temp.fails(format($q$INSERT INTO decisions (evaluation_id, accion, ruta_final, justificacion, user_id) VALUES (%L, 'rechazar', 'A', '', %L)$q$, e2, uid)),
        'diferir exige justificacion (B->A)';
    EXECUTE format($q$INSERT INTO decisions (evaluation_id, accion, ruta_final, justificacion, user_id) VALUES (%L, 'rechazar', 'A', 'Paciente refiere alta angustia', %L)$q$, e2, uid);
    ASSERT pg_temp.fails('UPDATE decisions SET justificacion = ''x'''), 'update decisions';
    ASSERT pg_temp.fails('DELETE FROM decisions'), 'delete decisions';

    -- Bitácora encadenada
    INSERT INTO audit_log (evento, user_id, site_code, detalle) VALUES ('login', uid, 'BAQ', '{"ok": true}');
    INSERT INTO audit_log (evento, user_id, site_code, evaluation_id, detalle) VALUES ('inferencia', uid, 'BAQ', e1, '{"modelo": "v1.0.0"}');
    INSERT INTO audit_log (evento, user_id, site_code, evaluation_id, detalle) VALUES ('decision', uid, 'BAQ', e1, '{}');
    ASSERT (SELECT prev_hash FROM audit_log ORDER BY id LIMIT 1) = repeat('0', 64), 'génesis';
    ASSERT (SELECT count(*) FROM audit_log a JOIN audit_log b ON b.id = (SELECT min(id) FROM audit_log WHERE id > a.id) WHERE b.prev_hash = a.hash) = 2, 'enlaces';
    ASSERT verify_audit_chain() IS NULL, 'cadena íntegra';
    ASSERT pg_temp.fails('UPDATE audit_log SET evento = ''x'''), 'update audit_log';
    ASSERT pg_temp.fails('DELETE FROM audit_log'), 'delete audit_log';
    ASSERT pg_temp.fails('TRUNCATE audit_log'), 'truncate audit_log';

    -- Detección de manipulación (simulada deshabilitando el trigger, solo dentro de esta transacción)
    ALTER TABLE audit_log DISABLE TRIGGER audit_log_immutable;
    UPDATE audit_log SET detalle = '{"ok": false}' WHERE evento = 'login';
    ASSERT verify_audit_chain() = (SELECT id FROM audit_log WHERE evento = 'login'), 'manipulación detectada';

    RAISE NOTICE 'TODAS LAS PRUEBAS DEL ESQUEMA PASARON';
END
$$;

ROLLBACK;
SELECT 'evaluaciones tras rollback' AS check, count(*) FROM evaluations;
SELECT 'bitacora tras rollback' AS check, count(*) FROM audit_log;
