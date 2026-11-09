import type { Nadador } from '../entities/nadador.entity'
import type { Rol } from '../entities/usuario.entity'

export interface NadadorRepository {
  obtener(id: string): Promise<Nadador | null>
  /** El perfil de nadador de una cuenta. Si no tiene, se crea (sin entrenador). */
  asegurarDeUsuario(usuarioId: string, nombre: string): Promise<Nadador>
  deUsuario(usuarioId: string): Promise<Nadador | null>
  /** Los nadadores del grupo de un entrenador, por nombre. */
  grupoDe(entrenadorId: string): Promise<Nadador[]>
  /** La cuenta con ese correo (sin mayúsculas) y su perfil de nadador, si tiene. */
  buscarPorEmail(email: string): Promise<{ usuario: { id: string; nombre: string; rol: Rol }; nadador: Nadador | null } | null>
  /** Cambia el entrenador del nadador (null = sin grupo). */
  asignarEntrenador(nadadorId: string, entrenadorId: string | null): Promise<void>
}

export const NADADOR_REPOSITORY = Symbol('NadadorRepository')
