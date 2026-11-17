import type { Grupo, Nadador } from '../entities/nadador.entity'
import type { Rol } from '../entities/usuario.entity'

export interface NadadorRepository {
  obtener(id: string): Promise<Nadador | null>
  /** El perfil de nadador de una cuenta. Si no tiene, se crea. */
  asegurarDeUsuario(usuarioId: string, nombre: string): Promise<Nadador>
  deUsuario(usuarioId: string): Promise<Nadador | null>
  /** Todos los nadadores con cuenta activa, por nombre. */
  todos(): Promise<Nadador[]>
  /** Hasta `limite` nadadores con cuenta activa cuyo correo o nombre contiene el texto (sin mayúsculas). */
  buscar(texto: string, limite: number): Promise<Nadador[]>
  /** La cuenta con ese correo (sin mayúsculas) y su perfil de nadador, si tiene. */
  buscarPorEmail(email: string): Promise<{ usuario: { id: string; nombre: string; rol: Rol }; nadador: Nadador | null } | null>
}

export interface GrupoRepository {
  /** Los grupos de un entrenador, con sus nadadores. */
  deEntrenador(entrenadorId: string): Promise<Grupo[]>
  /** Todos los grupos de todos los entrenadores (para el administrador). */
  todos(): Promise<Grupo[]>
  obtener(id: string): Promise<Grupo | null>
  /** Los grupos en los que está un nadador (de cualquier entrenador). */
  deNadador(nadadorId: string): Promise<Grupo[]>
  /** Lanza GrupoRepetido si el entrenador ya tiene un grupo con ese nombre. */
  crear(entrenadorId: string, nombre: string): Promise<Grupo>
  renombrar(id: string, nombre: string): Promise<Grupo>
  /** Pasa el grupo a otro entrenador. Lanza GrupoRepetido si ese entrenador ya tiene un grupo con el mismo nombre. */
  cambiarEntrenador(id: string, entrenadorId: string): Promise<Grupo>
  borrar(id: string): Promise<void>
  agregarNadador(grupoId: string, nadadorId: string): Promise<void>
  quitarNadador(grupoId: string, nadadorId: string): Promise<void>
}

/** El entrenador ya tiene un grupo con ese nombre. */
export class GrupoRepetido extends Error {}

export const NADADOR_REPOSITORY = Symbol('NadadorRepository')
export const GRUPO_REPOSITORY = Symbol('GrupoRepository')
