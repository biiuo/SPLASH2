import type { ResultadosSesion } from '../entities/sesion.entity'
import type { EventoDetectado, TramoDetectado } from '../services/motor-eventos'

export type EventoParaGuardar = EventoDetectado & { id: string }
export type TramoParaGuardar = TramoDetectado & { id: string }

export interface ResultadosRepository {
  /** Guarda eventos y tramos. Lo que ya estaba guardado (mismo id) se ignora: reenviar un lote no duplica nada. */
  guardar(sesionId: string, eventos: EventoParaGuardar[], tramos: TramoParaGuardar[]): Promise<void>
  listar(sesionId: string): Promise<ResultadosSesion>
}

export const RESULTADOS_REPOSITORY = Symbol('ResultadosRepository')
