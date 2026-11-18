-- 1) Entrenadores que esperan la aprobación del administrador.
--    Quien se registra como entrenador queda "pendiente": no puede iniciar sesión hasta que un administrador lo acepte.
--    Las cuentas que ya existían quedan aprobadas (DEFAULT false).
ALTER TABLE usuarios ADD COLUMN pendiente boolean NOT NULL DEFAULT false;
CREATE INDEX usuarios_pendientes_idx ON usuarios (creado_en) WHERE pendiente;

-- 2) Perfil deportivo del nadador (cuestionario inicial). Las respuestas van en un JSON: las valida el backend
--    (domain/entities/perfil-nadador.entity.ts) y así una pregunta nueva no pide una migración.
CREATE TABLE perfiles_nadador (
    nadador_id     uuid PRIMARY KEY REFERENCES nadadores (id) ON DELETE CASCADE,
    respuestas     jsonb NOT NULL DEFAULT '{}',
    -- por dónde va el cuestionario, para retomarlo
    etapa          smallint NOT NULL DEFAULT 0 CHECK (etapa BETWEEN 0 AND 100),
    -- eligió "completar más tarde"
    omitido        boolean NOT NULL DEFAULT false,
    completado_en  timestamptz,
    actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- 3) Historial del perfil: una foto de las respuestas y de la historia cada vez que se termina o se edita.
CREATE TABLE perfil_nadador_versiones (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nadador_id uuid NOT NULL REFERENCES nadadores (id) ON DELETE CASCADE,
    respuestas jsonb NOT NULL,
    historia   text NOT NULL,
    creado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX perfil_nadador_versiones_idx ON perfil_nadador_versiones (nadador_id, creado_en DESC);

-- 4) Tiempos personales que declara el nadador. Con ellos se calculan mejor marca, promedio y último tiempo,
--    siempre del mismo estilo, distancia y piscina.
CREATE TYPE estilo_nado AS ENUM ('libre', 'espalda', 'pecho', 'mariposa');

CREATE TABLE tiempos_personales (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nadador_id uuid NOT NULL REFERENCES nadadores (id) ON DELETE CASCADE,
    estilo     estilo_nado NOT NULL,
    distancia_m integer NOT NULL CHECK (distancia_m IN (25, 50, 100, 200, 400, 800, 1500)),
    piscina_m  smallint NOT NULL CHECK (piscina_m IN (25, 50)),
    -- milisegundos (las centésimas se guardan como múltiplos de 10)
    tiempo_ms  integer NOT NULL CHECK (tiempo_ms > 0 AND tiempo_ms < 7200000),
    fecha      date NOT NULL,
    creado_en  timestamptz NOT NULL DEFAULT now(),
    -- en una piscina de 50 m no hay pruebas de 25 m
    CHECK (piscina_m = 25 OR distancia_m >= 50)
);
CREATE INDEX tiempos_personales_nadador_idx ON tiempos_personales (nadador_id, estilo, distancia_m, piscina_m);
