// Una persona que usa el sistema y lo que puede hacer según su rol.

export type Rol = 'administrador' | 'entrenador' | 'nadador'

export const ROLES: readonly Rol[] = ['administrador', 'entrenador', 'nadador']

/** Los roles que una persona puede elegir al registrarse. Un administrador lo crea otro administrador (o el arranque). */
export const ROLES_REGISTRABLES: readonly Rol[] = ['entrenador', 'nadador']

export type Usuario = {
  id: string
  email: string
  nombre: string
  rol: Rol
  activo: boolean
}

/** Lo que va dentro del token: quién es y qué rol tiene. */
export type Identidad = { id: string; rol: Rol; nombre: string }

/**
 * Quien hace un pedido a la API: una persona con sesión iniciada, o el servidor de IA (que se identifica con un token
 * fijo, IA_TOKEN, y solo puede mandar posiciones y leer lo que necesita para medir).
 */
export type Solicitante = ({ tipo: 'usuario' } & Identidad) | { tipo: 'servicio'; nombre: string }

export const MIN_LARGO_CONTRASENA = 8
