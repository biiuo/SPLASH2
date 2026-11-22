import { randomBytes } from 'node:crypto'

import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcryptjs'

import type { CifradorContrasenas, EmisorTokens } from '../../application/ports/autenticacion.ports'
import { ROLES, type Identidad, type Rol } from '../../domain/entities/usuario.entity'

/** Costo de bcrypt: 2^12 vueltas (~250 ms por intento en un servidor común; frena a quien quiera adivinar). */
const COSTO_BCRYPT = 12

export class BcryptCifrador implements CifradorContrasenas {
  constructor(private readonly costo = COSTO_BCRYPT) {}

  cifrar(contrasena: string): Promise<string> {
    return bcrypt.hash(contrasena, this.costo)
  }

  coincide(contrasena: string, cifrada: string): Promise<boolean> {
    return bcrypt.compare(contrasena, cifrada)
  }
}

/**
 * La clave con la que se firman los tokens. En producción es obligatoria (JWT_SECRET). En desarrollo, si falta, se
 * inventa una al arrancar: funciona, pero las sesiones se cierran cada vez que se reinicia el backend.
 */
export function claveJwt(): string {
  const clave = process.env.JWT_SECRET?.trim()
  const deEjemplo = !clave || clave.startsWith('cambiame')
  if (!deEjemplo && clave.length >= 32) return clave
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Falta JWT_SECRET (al menos 32 caracteres, distinto del de .env.example). Ver .env.example.')
  }
  if (clave && !deEjemplo) return clave
  new Logger('Auth').warn('JWT_SECRET no está definido: uso una clave temporal (las sesiones se pierden al reiniciar).')
  return randomBytes(48).toString('base64url')
}

export class JwtEmisor implements EmisorTokens {
  constructor(private readonly jwt: JwtService) {}

  emitir(identidad: Identidad): Promise<string> {
    return this.jwt.signAsync({ sub: identidad.id, rol: identidad.rol, nombre: identidad.nombre })
  }

  async verificar(token: string): Promise<Identidad | null> {
    try {
      const p = await this.jwt.verifyAsync<{ sub?: unknown; rol?: unknown; nombre?: unknown }>(token)
      if (typeof p.sub !== 'string' || !ROLES.includes(p.rol as Rol)) return null
      return { id: p.sub, rol: p.rol as Rol, nombre: typeof p.nombre === 'string' ? p.nombre : '' }
    } catch {
      return null
    }
  }
}
