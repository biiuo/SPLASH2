import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { Rol, Solicitante as TipoSolicitante } from '../../domain/entities/usuario.entity'

export const CLAVE_PUBLICO = 'auth:publico'
export const CLAVE_ROLES = 'auth:roles'
export const CLAVE_SERVICIO = 'auth:servicio'

/** La ruta no pide sesión (salud, registrarse, ingresar). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true)

/** Solo personas con alguno de estos roles. Sin este decorador, cualquier persona con sesión iniciada. */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles)

/** El servidor de IA (con IA_TOKEN) también puede usar esta ruta. Sin este decorador, solo personas. */
export const PermiteServicio = () => SetMetadata(CLAVE_SERVICIO, true)

/** El id de la persona que hizo el pedido, o null si fue el servidor de IA. */
export const idDe = (s: TipoSolicitante | undefined): string | null => (s?.tipo === 'usuario' ? s.id : null)

/** Quién hizo el pedido (lo deja el guard). */
export const Solicitante = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TipoSolicitante => ctx.switchToHttp().getRequest<{ solicitante: TipoSolicitante }>().solicitante,
)
