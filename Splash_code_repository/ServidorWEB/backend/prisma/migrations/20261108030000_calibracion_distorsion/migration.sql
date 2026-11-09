-- Curvatura del lente estimada junto con la homografía: { k1, centro: [x, y], escala }. La homografía de una fila con
-- distorsión trabaja sobre puntos corregidos (metros = H · corregir(px)). NULL = no se corrige (calibraciones anteriores).
ALTER TABLE calibraciones
    ADD COLUMN distorsion jsonb;
