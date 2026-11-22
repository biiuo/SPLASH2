// Lo que la aplicación necesita para autenticar, sin saber con qué biblioteca se hace (eso es infraestructura).
import type { Identidad } from '../../domain/entities/usuario.entity'

export interface CifradorContrasenas {
  cifrar(contrasena: string): Promise<string>
  coincide(contrasena: string, cifrada: string): Promise<boolean>
}

export interface EmisorTokens {
  emitir(identidad: Identidad): Promise<string>
  /** La identidad del token, o null si es inválido o venció. */
  verificar(token: string): Promise<Identidad | null>
}

export const CIFRADOR_CONTRASENAS = Symbol('CifradorContrasenas')
export const EMISOR_TOKENS = Symbol('EmisorTokens')
