// Errores de la aplicación. No saben nada de HTTP: la capa de presentación los traduce a códigos de estado.

/** Lo que llegó no sirve. `detalles` lista qué está mal, en español, para mostrárselo a la persona. */
export class ValidacionException extends Error {
  constructor(
    mensaje: string,
    public readonly detalles: string[] = [],
  ) {
    super(mensaje)
    this.name = 'ValidacionException'
  }
}

export class NoEncontradoException extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'NoEncontradoException'
  }
}

/** La operación choca con el estado actual (por ejemplo, ya hay una sesión activa). */
export class ConflictoException extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ConflictoException'
  }
}

/** No se sabe quién es (sin sesión iniciada, token vencido o credenciales incorrectas). */
export class NoAutenticadoException extends Error {
  constructor(mensaje = 'Iniciá sesión para continuar.') {
    super(mensaje)
    this.name = 'NoAutenticadoException'
  }
}

/** Se sabe quién es, pero su rol no le permite hacer esto. */
export class ProhibidoException extends Error {
  constructor(mensaje = 'Tu rol no permite hacer esto.') {
    super(mensaje)
    this.name = 'ProhibidoException'
  }
}
