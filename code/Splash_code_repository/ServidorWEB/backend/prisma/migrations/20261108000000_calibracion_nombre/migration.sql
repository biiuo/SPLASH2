-- Cada calibración es una posición de la cámara: su homografía y sus zonas de análisis (columna "zonas", que ya
-- existía). El nombre ("Tribuna, lado norte") sirve para elegir entre varias cuando la cámara cambia de lugar.
ALTER TABLE calibraciones
    ADD COLUMN nombre text CHECK (nombre IS NULL OR char_length(nombre) BETWEEN 1 AND 80);
