-- Configuración de cada grupo: una descripción, el nivel y el horario de clases
-- (horario = {"dias": ["lun", "mie", "vie"], "inicio": "06:00", "fin": "07:30"}).
ALTER TABLE grupos
    ADD COLUMN descripcion text CHECK (descripcion IS NULL OR char_length(descripcion) <= 200),
    ADD COLUMN nivel text CHECK (nivel IS NULL OR nivel IN ('principiante', 'intermedio', 'avanzado', 'competitivo')),
    ADD COLUMN horario jsonb;
