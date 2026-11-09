-- Puntos marcados sobre las corcheras (en cualquier lugar de su largo), que la homografía usa además de los nodos:
-- [{ cuerda, px: [x, y], y_m }]. Las calibraciones anteriores quedan con la lista vacía.
ALTER TABLE calibraciones
    ADD COLUMN cuerdas jsonb NOT NULL DEFAULT '[]';
