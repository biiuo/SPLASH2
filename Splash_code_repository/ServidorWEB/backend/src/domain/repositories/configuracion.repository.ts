import type { Configuracion } from '../entities/configuracion.entity'

/** Lo que el dominio necesita de la persistencia de la configuración. La implementación vive en infrastructure. */
export interface ConfiguracionRepository {
  /** La configuración guardada, o null si todavía no se guardó ninguna. */
  obtener(): Promise<Configuracion | null>
  guardar(configuracion: Configuracion, usuarioId?: string | null): Promise<Configuracion>
}

export const CONFIGURACION_REPOSITORY = Symbol('ConfiguracionRepository')
