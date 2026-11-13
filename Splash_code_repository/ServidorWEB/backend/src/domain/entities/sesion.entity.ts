// Una sesión de entrenamiento y lo que se midió en ella.

/** Un carril de una sesión, con su nadador (o sin nadador: el entrenador lo reservó para alguien que llega después). */
export type AsignacionCarril = {
  carril: number
  nadador_id: string | null
  /** Nombre del nadador asignado. null = carril reservado, sin nadador todavía. */
  nadador: string | null
  /** La cuenta del nadador (para saber qué carril es de quién). */
  usuario_id: string | null
}

/**
 * Cómo ve un carril quien pregunta:
 *   libre    nadie lo usa: se puede empezar una sesión en él
 *   mio      está en una sesión que inicié, o es el carril que me asignaron
 *   grupo    está en una sesión de un entrenador a la que me puedo sumar (de uno de mis grupos, o libre)
 *   ocupado  lo usa otra sesión
 */
export type EstadoCarril = {
  carril: number
  estado: 'libre' | 'mio' | 'grupo' | 'ocupado'
  /** La sesión, solo si es mía o una a la que me puedo sumar ("grupo"). */
  sesion_id: string | null
  /** Si ya tiene un nadador asignado. */
  con_nadador: boolean
  /** Nombre del nadador, solo para quien inició esa sesión (o el propio nadador). */
  nadador: string | null
}

/** Dónde se procesa el video. Es un dato interno: el usuario nunca lo ve. */
export type ModoProceso = 'celular' | 'servidor'

export type EstadoSesion = 'activa' | 'finalizada' | 'cancelada'

export const MODOS_PROCESO: readonly ModoProceso[] = ['celular', 'servidor']

export type Sesion = {
  id: string
  estado: EstadoSesion
  modo: ModoProceso
  /** La calibración con la que se mide esta sesión (queda fija aunque después se active otra). */
  calibracion_id: string | null
  /** Quién la inició: un entrenador (o administrador) o un nadador (su sesión personal). */
  iniciada_por_id: string | null
  /** Nombre y rol de quien la inició. */
  iniciada_por: string | null
  iniciada_por_rol: 'administrador' | 'entrenador' | 'nadador' | null
  /** Sesión de un entrenador: de un grupo, o libre (null: cualquier nadador se puede sumar). */
  grupo_id: string | null
  grupo: string | null
  /** Los carriles de la sesión, con su nadador. */
  carriles: AsignacionCarril[]
  inicio: string
  fin: string | null
}

/** Lo medido en un carril de una sesión (una fila del historial: cada nadador por separado, sin promediar con los demás). */
export type ResumenCarril = {
  carril: number
  /** Nombre del nadador de ese carril. null = carril sin nadador asignado. */
  nadador: string | null
  tramos: number
  distancia_m: number
  /** Distancia / tiempo de los tramos de ESE carril. null si no hubo tramos. */
  velocidad_media_ms: number | null
}

/** Una sesión con el resumen de lo que se midió (para el historial). */
export type ResumenSesion = Omit<Sesion, 'carriles'> & {
  /** Carriles en los que se midió algo. */
  carriles: number[]
  /** Totales de toda la sesión (suma de todos los carriles). */
  tramos: number
  distancia_m: number
  /** Distancia total / tiempo total de los tramos. null si no hubo tramos. */
  velocidad_media_ms: number | null
  /** Lo mismo, carril por carril (ordenado por carril): para mostrar a cada nadador por separado. */
  por_carril: ResumenCarril[]
}

export type EventoGuardado = {
  id: string
  carril: number
  identidad: number | null
  tipo: 'cruce_nodo' | 'viraje' | 'inicio_descanso' | 'fin_descanso'
  nodo_m: number | null
  ts_captura: string
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

export type ResultadosSesion = {
  eventos: EventoGuardado[]
  tramos: TramoGuardado[]
}
