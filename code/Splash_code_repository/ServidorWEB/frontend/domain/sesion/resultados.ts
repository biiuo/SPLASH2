export type EventoGuardado = {
  id: string
  carril: number
  identidad: number | null
  tipo: 'cruce_nodo' | 'viraje' | 'inicio_descanso' | 'fin_descanso'
  nodo_m: number | null
  ts_captura: string
  /** false = inferido (no se estaba viendo al nadador). */
  observado: boolean
}

export type TramoGuardado = {
  id: string
  carril: number
  identidad: number | null
  nodo_desde_m: number
  nodo_hasta_m: number
  t_inicio: string
  t_fin: string
  distancia_m: number
  velocidad_ms: number
  observado: boolean
}

/**
 * Un largo completo (de pared a pared), armado por el backend a partir de los tramos. `estimado` = alguno de sus
 * tramos no se vio: no es una medición confirmada.
 */
export type Largo = {
  numero: number
  carril: number
  desde_m: number
  hasta_m: number
  t_inicio: string
  t_fin: string
  duracion_s: number
  velocidad_ms: number
  estimado: boolean
  /** Viraje + pausa desde el largo anterior (null en el primero). */
  pausa_previa_s: number | null
  /** Ids de los tramos que lo forman. */
  tramos: string[]
}

export type ResultadosSesion = { eventos: EventoGuardado[]; tramos: TramoGuardado[]; largos: Largo[]; largo_m: number }
