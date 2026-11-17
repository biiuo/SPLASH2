-- Objetivos que un entrenador le pone a cada nadador: una meta de distancia (metros en el período), de velocidad
-- (mejor velocidad de largo, m/s) o de tiempo por largo (segundos o menos), entre dos fechas.
CREATE TYPE tipo_objetivo AS ENUM ('distancia', 'velocidad', 'tiempo_largo');

CREATE TABLE objetivos (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nadador_id    uuid NOT NULL REFERENCES nadadores (id) ON DELETE CASCADE,
    entrenador_id uuid REFERENCES usuarios (id) ON DELETE SET NULL,
    tipo          tipo_objetivo NOT NULL,
    meta          numeric(9, 3) NOT NULL CHECK (meta > 0),
    desde         date NOT NULL,
    hasta         date NOT NULL,
    descripcion   text CHECK (descripcion IS NULL OR char_length(descripcion) <= 200),
    creado_en     timestamptz NOT NULL DEFAULT now(),
    CHECK (hasta >= desde)
);
CREATE INDEX objetivos_nadador_idx ON objetivos (nadador_id);
