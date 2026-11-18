import type { NuevoTiempo, PerfilGuardado, RespuestasPerfil, TiempoPersonal } from '../entities/perfil-nadador.entity'

/** Lo que se cambia al guardar el perfil (undefined = no tocar). */
export type CambiosPerfil = { respuestas?: RespuestasPerfil; etapa?: number; omitido?: boolean; completado?: boolean }

export interface PerfilNadadorRepository {
  /** null si el nadador nunca abrió el cuestionario. */
  obtener(nadadorId: string): Promise<PerfilGuardado | null>
  /** Crea el perfil si no existe. `completado: true` fija la fecha de terminado (solo la primera vez). */
  guardar(nadadorId: string, cambios: CambiosPerfil): Promise<PerfilGuardado>

  tiempos(nadadorId: string): Promise<TiempoPersonal[]>
  agregarTiempo(nadadorId: string, t: NuevoTiempo): Promise<TiempoPersonal>
  /** false si ese tiempo no existe o no es de ese nadador. */
  borrarTiempo(nadadorId: string, id: string): Promise<boolean>
}

export const PERFIL_NADADOR_REPOSITORY = Symbol('PerfilNadadorRepository')
