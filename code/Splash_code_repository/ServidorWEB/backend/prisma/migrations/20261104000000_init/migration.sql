-- SafeSplash: migración inicial (PostgreSQL 16).
-- La aplica Prisma (`prisma migrate deploy`). Además de las tablas de schema.prisma trae lo que Prisma no puede
-- expresar ahí: índices parciales y por expresión, los CHECK y la vista resumen_sesion.
-- Un cambio al esquema es una migración nueva (otra carpeta en prisma/migrations), no una edición de esta.

CREATE TYPE rol_usuario   AS ENUM ('administrador', 'entrenador', 'nadador');
CREATE TYPE estado_sesion AS ENUM ('activa', 'finalizada', 'cancelada');
-- Dónde se procesa el video de la sesión. Es un dato interno: el usuario nunca lo ve.
CREATE TYPE modo_proceso  AS ENUM ('celular', 'servidor');
CREATE TYPE tipo_evento   AS ENUM ('cruce_nodo', 'viraje', 'inicio_descanso', 'fin_descanso');

-- ------------------------------------------------------------------ usuarios
CREATE TABLE usuarios (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text        NOT NULL,
    nombre        text        NOT NULL,
    password_hash text        NOT NULL,            -- bcrypt; nunca la contraseña
    rol           rol_usuario NOT NULL,
    activo        boolean     NOT NULL DEFAULT true,
    creado_en     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX usuarios_email_uq ON usuarios (lower(email));

-- Un nadador puede existir antes de tener cuenta (usuario_id vacío).
CREATE TABLE nadadores (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id    uuid UNIQUE REFERENCES usuarios (id) ON DELETE CASCADE,
    entrenador_id uuid REFERENCES usuarios (id) ON DELETE SET NULL,
    nombre        text        NOT NULL,
    creado_en     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX nadadores_entrenador_idx ON nadadores (entrenador_id);

-- ------------------------------------------------------------------ configuración (una sola fila)
-- Datos de la piscina y de la cámara que usa la calibración. Los edita un entrenador o un administrador.
CREATE TABLE configuracion (
    id              boolean PRIMARY KEY DEFAULT true CHECK (id),   -- "id = true" obliga a que haya una sola fila
    piscina         jsonb       NOT NULL,
    camara          jsonb       NOT NULL,
    actualizada_por uuid REFERENCES usuarios (id) ON DELETE SET NULL,
    actualizada_en  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------ calibración
CREATE TABLE calibraciones (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creada_por   uuid REFERENCES usuarios (id) ON DELETE SET NULL,
    image_width  integer NOT NULL CHECK (image_width  > 0),
    image_height integer NOT NULL CHECK (image_height > 0),
    puntos       jsonb   NOT NULL,                 -- [{ id, px: [x, y], mundo: [x, y] }]
    homografia   jsonb   NOT NULL,                 -- matriz 3x3, píxeles -> metros
    geometria    jsonb   NOT NULL,                 -- medidas de la piscina con las que se calculó
    zonas        jsonb,                            -- contenido de zones.json (opcional)
    rmse_m       numeric(8, 4),
    cruzado_m    numeric(8, 4),
    completa     boolean NOT NULL DEFAULT false,
    activa       boolean NOT NULL DEFAULT false,
    creado_en    timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- A lo sumo una calibración activa a la vez.
CREATE UNIQUE INDEX calibracion_activa_uq ON calibraciones ((true)) WHERE activa;

-- ------------------------------------------------------------------ sesiones
CREATE TABLE sesiones (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entrenador_id  uuid REFERENCES usuarios (id) ON DELETE SET NULL,
    calibracion_id uuid REFERENCES calibraciones (id) ON DELETE SET NULL,
    estado         estado_sesion NOT NULL DEFAULT 'activa',
    modo           modo_proceso  NOT NULL,
    inicio         timestamptz   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fin            timestamptz,
    CHECK (fin IS NULL OR fin >= inicio)
);
-- Hay una sola cámara: no puede haber dos sesiones activas a la vez.
CREATE UNIQUE INDEX sesion_activa_uq ON sesiones ((true)) WHERE estado = 'activa';

-- Qué nadador está en cada carril durante la sesión (el nadador puede ser anónimo).
CREATE TABLE sesion_nadadores (
    sesion_id  uuid     NOT NULL REFERENCES sesiones (id) ON DELETE CASCADE,
    carril     smallint NOT NULL CHECK (carril BETWEEN 1 AND 12),
    nadador_id uuid REFERENCES nadadores (id) ON DELETE SET NULL,
    PRIMARY KEY (sesion_id, carril)
);

-- ------------------------------------------------------------------ resultados
-- Los ids los genera quien mide (celular o servidor de IA): si reenvía lo mismo, no se duplica.
CREATE TABLE eventos (
    id          uuid PRIMARY KEY,
    sesion_id   uuid        NOT NULL REFERENCES sesiones (id) ON DELETE CASCADE,
    carril      smallint    NOT NULL CHECK (carril BETWEEN 1 AND 12),
    identidad   integer,                           -- identidad estable del tracker (no es un usuario)
    tipo        tipo_evento NOT NULL,
    nodo_m      numeric(6, 2),
    ts_captura  timestamptz NOT NULL,              -- instante en que se capturó el frame
    observado   boolean     NOT NULL DEFAULT true, -- false = inferido (fuera de lo que ve la cámara)
    recibido_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX eventos_sesion_ts_idx ON eventos (sesion_id, ts_captura);

CREATE TABLE tramos (
    id           uuid PRIMARY KEY,
    sesion_id    uuid        NOT NULL REFERENCES sesiones (id) ON DELETE CASCADE,
    carril       smallint    NOT NULL CHECK (carril BETWEEN 1 AND 12),
    identidad    integer,
    nodo_desde_m numeric(6, 2) NOT NULL,
    nodo_hasta_m numeric(6, 2) NOT NULL,
    t_inicio     timestamptz NOT NULL,
    t_fin        timestamptz NOT NULL,
    distancia_m  numeric(7, 2) NOT NULL CHECK (distancia_m > 0),
    velocidad_ms numeric(7, 3) NOT NULL CHECK (velocidad_ms >= 0),
    observado    boolean     NOT NULL DEFAULT true,
    recibido_en  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (t_fin > t_inicio)
);
CREATE INDEX tramos_sesion_idx ON tramos (sesion_id, t_inicio);

-- ------------------------------------------------------------------ estado de los componentes
-- Cada componente (servidor de IA, celulares) avisa que está vivo; sirve para elegir dónde procesar.
CREATE TABLE latidos (
    componente    text PRIMARY KEY,                -- 'ia-nube' o 'celular:<id>'
    estado        jsonb       NOT NULL DEFAULT '{}'::jsonb,
    ultimo_latido timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------ vistas
CREATE VIEW resumen_sesion AS
SELECT sesion_id,
       carril,
       count(*)                                              AS tramos,
       sum(distancia_m)                                      AS distancia_m,
       sum(extract(epoch FROM (t_fin - t_inicio)))           AS tiempo_s,
       sum(distancia_m)
         / NULLIF(sum(extract(epoch FROM (t_fin - t_inicio))), 0) AS velocidad_media_ms,
       max(velocidad_ms)                                     AS velocidad_max_ms
FROM tramos
GROUP BY sesion_id, carril;
