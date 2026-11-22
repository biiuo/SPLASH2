import type { Sesion } from '../entities/sesion.entity'

/**
 * Si un nadador se puede sumar a una sesión en curso: tiene que ser de un entrenador (o administrador) y, si es de un
 * grupo, el nadador tiene que estar en ese grupo. Las sesiones libres de un entrenador están abiertas a cualquier
 * nadador. A la sesión personal de otro nadador no se suma nadie.
 */
export function puedeSumarse(sesion: Sesion, usuarioId: string, misGrupos: string[]): boolean {
  if (sesion.estado !== 'activa' || sesion.iniciada_por_id === usuarioId) return false
  if (sesion.iniciada_por_rol !== 'entrenador' && sesion.iniciada_por_rol !== 'administrador') return false
  return sesion.grupo_id === null || misGrupos.includes(sesion.grupo_id)
}
