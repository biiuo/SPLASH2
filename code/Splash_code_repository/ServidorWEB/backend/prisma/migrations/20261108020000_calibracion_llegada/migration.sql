-- Dónde se cuenta la llegada a cada pared cuando la cámara no ve hasta la pared (por ejemplo, la de salida queda
-- tapada por la baranda): { inicio_m, fin_m } en metros desde la pared de salida. NULL = en la pared.
ALTER TABLE calibraciones
    ADD COLUMN llegada jsonb;
