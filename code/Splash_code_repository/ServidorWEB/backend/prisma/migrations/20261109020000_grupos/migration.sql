-- Un entrenador puede tener VARIOS grupos, y un nadador puede estar en varios. Antes, cada nadador tenía un solo
-- entrenador (nadadores.entrenador_id).
CREATE TABLE grupos (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entrenador_id uuid NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    nombre        text NOT NULL,
    creado_en     timestamptz NOT NULL DEFAULT now()
);
-- un entrenador no repite el nombre de un grupo (sin importar mayúsculas)
CREATE UNIQUE INDEX grupos_entrenador_nombre_uq ON grupos (entrenador_id, lower(nombre));

CREATE TABLE grupo_nadadores (
    grupo_id   uuid NOT NULL REFERENCES grupos (id) ON DELETE CASCADE,
    nadador_id uuid NOT NULL REFERENCES nadadores (id) ON DELETE CASCADE,
    PRIMARY KEY (grupo_id, nadador_id)
);
CREATE INDEX grupo_nadadores_nadador_idx ON grupo_nadadores (nadador_id);

-- el grupo único de antes pasa a ser el grupo "Mi grupo" de cada entrenador
INSERT INTO grupos (entrenador_id, nombre)
    SELECT DISTINCT entrenador_id, 'Mi grupo' FROM nadadores WHERE entrenador_id IS NOT NULL;
INSERT INTO grupo_nadadores (grupo_id, nadador_id)
    SELECT g.id, n.id FROM nadadores n JOIN grupos g ON g.entrenador_id = n.entrenador_id;

DROP INDEX IF EXISTS nadadores_entrenador_idx;
ALTER TABLE nadadores DROP COLUMN entrenador_id;

-- La sesión de un entrenador es de un grupo (grupo_id) o libre (NULL: cualquier nadador se puede sumar).
ALTER TABLE sesiones ADD COLUMN grupo_id uuid REFERENCES grupos (id) ON DELETE SET NULL;
