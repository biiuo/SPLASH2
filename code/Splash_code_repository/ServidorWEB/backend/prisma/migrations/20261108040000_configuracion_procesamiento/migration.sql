-- Dónde se procesan las sesiones nuevas (servidor o celular). {} = el que diga PROCESAR_EN en el .env del backend.
ALTER TABLE "configuracion" ADD COLUMN "procesamiento" JSONB NOT NULL DEFAULT '{}';
