-- healthAI · datos SOLO PARA DESARROLLO.
-- Usuarios de demostración (mismos que el modo `mock` del frontend).
-- Las sedes y los roles base viven en el esquema. El administrador inicial lo crea el backend
-- al arrancar con ADMIN_EMAIL / ADMIN_PASSWORD (no hay contraseña de admin en este archivo).
-- NUNCA montar este archivo en un entorno con datos reales.

-- Contraseñas con bcrypt generado por pgcrypto; no se guarda ningún hash fijo en el repo.
INSERT INTO users (email, password_hash, nombre, rol) VALUES
    ('evaluador@cuc.test',    crypt('demo1234', gen_salt('bf', 10)), 'Dr. Alejandro Restrepo', 'evaluador'),
    ('psicologa@cuc.test',    crypt('demo1234', gen_salt('bf', 10)), 'Psic. Laura Mendoza',    'evaluador'),
    ('investigador@cuc.test', crypt('demo1234', gen_salt('bf', 10)), 'Investigador CUC',       'investigador');

INSERT INTO user_cargos (user_id, cargo)
SELECT u.id, c.cargo
FROM users u
JOIN (VALUES
    ('evaluador@cuc.test',    'medico'),
    ('evaluador@cuc.test',    'enfermeria'),
    ('psicologa@cuc.test',    'psicologo'),
    ('investigador@cuc.test', 'investigador')
) AS c (email, cargo) ON c.email = u.email;

INSERT INTO user_sites (user_id, site_code)
SELECT u.id, s.code FROM users u CROSS JOIN sites s;
