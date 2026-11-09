import type { ArchivoCalibracion, CalibracionGuardada, Llegada, Zona } from '../entities/calibracion.entity'

/** Lo que se guarda además de la homografía. */
export type ExtrasCalibracion = {
  nombre?: string | null
  zonas?: Zona[] | null
  llegada?: Llegada | null
  /** La imagen (JPEG) sobre la que se calibró. */
  imagen?: Uint8Array | null
}

export interface CalibracionRepository {
  /** Guarda una calibración nueva y la deja como la activa (la anterior queda en el historial). */
  guardar(calibracion: ArchivoCalibracion, usuarioId?: string | null, extras?: ExtrasCalibracion): Promise<{ id: string }>
  /** La calibración activa, o null si no hay ninguna. */
  obtenerActiva(): Promise<CalibracionGuardada | null>
  obtener(id: string): Promise<CalibracionGuardada | null>
  /** El historial, de la más nueva a la más vieja (sin la matriz ni los puntos: es solo para elegir). */
  listar(): Promise<CalibracionResumen[]>
  /** Deja esta calibración como la activa. false si no existe. */
  activar(id: string): Promise<boolean>
  /** Cambia el nombre y/o las zonas (lo que venga; undefined = no tocar). null si no existe. */
  actualizar(id: string, cambios: ExtrasCalibracion): Promise<CalibracionGuardada | null>
  /** La imagen (JPEG) de una calibración, o null si no existe o no tiene. Va aparte: pesa y casi nunca hace falta. */
  obtenerImagen(id: string): Promise<Uint8Array | null>
}

export type CalibracionResumen = {
  id: string
  nombre: string | null
  /** Tamaño de la imagen sobre la que se calibró: las zonas se guardan en esos píxeles. */
  image_size: [number, number]
  creada: string
  completa: boolean
  rmse_m: number | null
  cruzado_m: number | null
  n_puntos: number
  /** Nombres de las zonas guardadas (vacío si todavía no tiene). */
  zonas: string[]
  activa: boolean
  /** Si se guardó la imagen sobre la que se calibró (GET /calibracion/:id/imagen). */
  tiene_imagen: boolean
}

export const CALIBRACION_REPOSITORY = Symbol('CalibracionRepository')
