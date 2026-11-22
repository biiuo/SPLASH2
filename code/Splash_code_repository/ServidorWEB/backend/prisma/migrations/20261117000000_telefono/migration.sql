-- Teléfono de contacto de cada cuenta (opcional). Lo ve el administrador y, del entrenador, sus nadadores.
ALTER TABLE usuarios ADD COLUMN telefono text;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_telefono_largo CHECK (telefono IS NULL OR char_length(telefono) BETWEEN 6 AND 25);
