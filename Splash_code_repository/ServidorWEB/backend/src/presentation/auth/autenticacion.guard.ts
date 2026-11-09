import { timingSafeEqual } from 'node:crypto'

import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { NoAutenticadoException, ProhibidoException } from '../../application/exceptions/aplicacion.exceptions'
import { EMISOR_TOKENS, type EmisorTokens } from '../../application/ports/autenticacion.ports'
import type { Rol, Solicitante } from '../../domain/entities/usuario.entity'
import { CLAVE_PUBLICO, CLAVE_ROLES, CLAVE_SERVICIO } from './decoradores'

/** Compara sin filtrar por el tiempo de respuesta cuántos caracteres coincidieron. */
function igualesSeguro(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Se aplica a todas las rutas. Lee `Authorization: Bearer <token>`:
 *   * el token de una persona (JWT del inicio de sesión) -> se sabe quién es y su rol;
 *   * IA_TOKEN -> es el servidor de IA, que solo entra a las rutas marcadas con @PermiteServicio().
 * Las rutas @Publico() no piden nada.
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  private readonly tokenIa = process.env.IA_TOKEN?.trim() || null

  constructor(
    private readonly reflector: Reflector,
    @Inject(EMISOR_TOKENS) private readonly tokens: EmisorTokens,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const objetivos = [ctx.getHandler(), ctx.getClass()]
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos)) return true

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; solicitante?: Solicitante }>()
    const [tipo, token] = (req.headers.authorization ?? '').split(' ')
    if (tipo?.toLowerCase() !== 'bearer' || !token) throw new NoAutenticadoException()

    if (this.tokenIa && igualesSeguro(token, this.tokenIa)) {
      if (!this.reflector.getAllAndOverride<boolean>(CLAVE_SERVICIO, objetivos)) {
        throw new ProhibidoException('El servidor de IA no puede usar esta ruta.')
      }
      req.solicitante = { tipo: 'servicio', nombre: 'ia' }
      return true
    }

    const identidad = await this.tokens.verificar(token)
    if (!identidad) throw new NoAutenticadoException('La sesión venció o no es válida. Iniciá sesión de nuevo.')
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(CLAVE_ROLES, objetivos)
    if (roles && !roles.includes(identidad.rol)) throw new ProhibidoException()
    req.solicitante = { tipo: 'usuario', ...identidad }
    return true
  }
}
