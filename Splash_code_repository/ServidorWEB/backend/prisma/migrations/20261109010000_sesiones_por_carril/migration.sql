-- Varias sesiones a la vez: antes había UNA sola sesión activa en toda la piscina. Ahora cada CARRIL pertenece a una
-- sola sesión activa (la de un entrenador con su grupo, o la sesión libre de un nadador), y en otros carriles puede haber
-- otras sesiones.
DROP INDEX IF EXISTS sesion_activa_uq;

-- "activo": el carril está tomado por una sesión en curso (se apaga al finalizarla). Así la base misma impide que dos
-- sesiones tomen el mismo carril, aunque dos pedidos lleguen a la vez.
ALTER TABLE sesion_nadadores ADD COLUMN activo boolean NOT NULL DEFAULT false;
UPDATE sesion_nadadores sn SET activo = true FROM sesiones s WHERE s.id = sn.sesion_id AND s.estado = 'activa';

-- un carril, en una sola sesión activa
CREATE UNIQUE INDEX sesion_nadadores_carril_activo_uq ON sesion_nadadores (carril) WHERE activo;
-- un nadador, en un solo carril activo
CREATE UNIQUE INDEX sesion_nadadores_nadador_activo_uq ON sesion_nadadores (nadador_id) WHERE activo AND nadador_id IS NOT NULL;
-- cada persona, una sola sesión activa iniciada por ella
CREATE UNIQUE INDEX sesion_activa_por_persona_uq ON sesiones (entrenador_id) WHERE estado = 'activa' AND entrenador_id IS NOT NULL;
