import type { ModoProceso, ResumenSesion, Sesion } from '../entities/sesion.entity'

export type NuevaSesion = {
  modo: ModoProceso
  calibracionId: string | null
  usuarioId: string
  /** Sesión de un entrenador: de este grupo, o libre (null). */
  grupoId: string | null
  /** Los carriles que toma la sesión; nadadorId null = reservado sin nadador. */
  carriles: { carril: number; nadadorId: string | null }[]
}

/** Otro pedido tomó el carril (o el nadador) al mismo tiempo: lo impide la base. */
export class ConflictoCarriles extends Error {}

export interface SesionRepository {
  /** Crea la sesión con sus carriles. Lanza ConflictoCarriles si un carril o un nadador ya está en otra sesión activa. */
  iniciar(datos: NuevaSesion): Promise<Sesion>
  obtener(id: string): Promise<Sesion | null>
  /**
   * Una sesión activa. Con `visiblePara`, la de esa persona (la inició, o le asignaron un carril); sin él, cualquiera.
   */
  obtenerActiva(visiblePara?: string | null): Promise<Sesion | null>
  /** Todas las sesiones activas, con sus carriles. */
  obtenerActivas(): Promise<Sesion[]>
  /** La sesión activa que inició esa persona, o null. */
  activaIniciadaPor(usuarioId: string): Promise<Sesion | null>
  /** Si esa persona puede ver esa sesión (la inició, o le asignaron un carril). */
  puedeVer(sesionId: string, usuarioId: string): Promise<boolean>
  /** Pone un nadador en un carril de la sesión (el carril sin nadador, o uno libre que se suma). Lanza ConflictoCarriles. */
  asignarCarril(sesionId: string, carril: number, nadadorId: string): Promise<Sesion>
  /** Cierra la sesión y libera sus carriles. Si ya estaba cerrada la devuelve tal cual. null si no existe. */
  finalizar(id: string): Promise<Sesion | null>
  /** Las últimas `limite` sesiones (la más reciente primero), con el resumen de lo medido. */
  listarRecientes(limite: number, visiblePara?: string | null): Promise<ResumenSesion[]>
}

export const SESION_REPOSITORY = Symbol('SesionRepository')
