-- La imagen (JPEG) sobre la que se calibró. NULL en las calibraciones guardadas antes de este cambio.
ALTER TABLE "calibraciones" ADD COLUMN "imagen" BYTEA;
