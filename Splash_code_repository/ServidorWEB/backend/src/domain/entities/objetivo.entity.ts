export type TipoObjetivo = 'distancia' | 'velocidad' | 'tiempo_largo'
export const TIPOS_OBJETIVO: readonly TipoObjetivo[] = ['distancia', 'velocidad', 'tiempo_largo']

/**
 * Una meta de un nadador entre dos fechas (inclusive):
 *  - distancia: metros nadados en el período;
 *  - velocidad: mejor velocidad de largo detectado, en m/s;
 *  - tiempo_largo: mejor tiempo de largo detectado, en segundos (se cumple con ese tiempo o menos).
 */
export type Objetivo = {
  id: string
  nadador_id: string
  nadador: string
  /** La cuenta del nadador (para cruzar con sus sesiones). */
  usuario_id: string | null
  entrenador_id: string | null
  entrenador: string | null
  tipo: TipoObjetivo
  meta: number
  /** YYYY-MM-DD */
  desde: string
  hasta: string
  descripcion: string | null
  creado_en: string
}
