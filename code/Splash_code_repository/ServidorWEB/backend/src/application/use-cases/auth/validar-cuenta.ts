import { MIN_LARGO_CONTRASENA } from '../../../domain/entities/usuario.entity'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** bcrypt solo mira los primeros 72 bytes: una contraseña más larga daría una falsa sensación de seguridad. */
const MAX_BYTES_CONTRASENA = 72

export function normalizarEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

/** Lista de problemas de los datos de una cuenta nueva (vacía si están bien). */
export function problemasDeCuenta(datos: { email?: unknown; nombre?: unknown; contrasena?: unknown }): string[] {
  const errores: string[] = []
  const email = normalizarEmail(datos.email)
  if (!EMAIL.test(email) || email.length > 200) errores.push('El correo no es válido.')
  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : ''
  if (nombre.length < 1 || nombre.length > 80) errores.push('El nombre tiene que tener de 1 a 80 letras.')
  const c = datos.contrasena
  if (typeof c !== 'string' || c.length < MIN_LARGO_CONTRASENA) {
    errores.push(`La contraseña tiene que tener al menos ${MIN_LARGO_CONTRASENA} caracteres.`)
  } else if (Buffer.byteLength(c, 'utf8') > MAX_BYTES_CONTRASENA) {
    errores.push(`La contraseña puede tener hasta ${MAX_BYTES_CONTRASENA} caracteres.`)
  }
  return errores
}

const TELEFONO = /^\+?[0-9][0-9\s()-]{5,23}$/

/**
 * El teléfono (opcional): undefined = no vino (no tocar), null = borrarlo, o el número limpio.
 * Lanza un texto de error si no parece un teléfono.
 */
export function telefonoDe(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null || (typeof v === 'string' && v.trim() === '')) return null
  if (typeof v !== 'string' || !TELEFONO.test(v.trim())) throw new Error('El teléfono no es válido: usá solo números, espacios, guiones o + (de 6 a 24 caracteres).')
  return v.trim()
}
