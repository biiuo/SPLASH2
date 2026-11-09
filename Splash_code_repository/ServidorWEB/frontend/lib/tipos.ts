// El contrato con la API (backend). Son solo tipos: la lógica de negocio (validar, evaluar, calcular la homografía)
// vive en el backend. Si cambia una respuesta de la API, se cambia acá.

export type Punto = [number, number]
export type Matriz3 = [[number, number, number], [number, number, number], [number, number, number]]

// ---------------------------------------------------------------- configuración

export type ConfigPiscina = {
  largo_m: number
  ancho_m: number
  n_carriles: number
  primer_carril: number
  n_carriles_analizados: number
  /** Distancias, desde la pared de salida, donde hay marcas en las cuerdas. */
  nodos_m: number[]
}

export type ConfigCamara = {
  modelo: string
  sensor_ancho_mm: number
  sensor_alto_mm: number
  ancho_px: number
  alto_px: number
  focal_mm: number
  altura_m: number
  distancia_borde_m: number
  inclinacion_grados: number | null
}

/** Dónde se procesan las sesiones nuevas. null = el que diga PROCESAR_EN en el .env del backend. */
export type ConfigProcesamiento = { modo: ModoProceso | null }

export type Configuracion = { piscina: ConfigPiscina; camara: ConfigCamara; procesamiento: ConfigProcesamiento }

export type ConfiguracionEfectiva = {
  configuracion: Configuracion
  guardada: boolean
  /** Los valores de fábrica, para poder volver a ellos. */
  fabrica: Configuracion
  /** El modo que se usa de verdad (lo elegido, o el del .env). */
  modo_procesamiento: ModoProceso
  /** PROCESAR_EN del .env del backend. */
  modo_por_defecto: ModoProceso
}

export type Derivados = {
  anchoCarril_m: number
  anchoAnalizado_m: number
  focalPx: number
  fovHorizontal: number
  fovVertical: number
}

export type PrecisionNodo = {
  nodo_m: number
  distancia_m: number
  cm_por_px: number
  s_por_px: number
  ancho_visible_m: number
}

export type AnalisisConfiguracion = {
  errores: string[]
  derivados: Derivados | null
  precision: PrecisionNodo[]
  avisos: string[]
}

// ---------------------------------------------------------------- calibración

export type Lado = 'izquierda' | 'derecha'

export type PuntoRef = {
  id: string
  nodo_m: number
  lado: Lado
  /** Posición real en la piscina, en metros. */
  mundo: Punto
  etiqueta: string
  ayuda: string
}

export type Geometria = {
  largo_m: number
  ancho_carril_m: number
  n_carriles_piscina: number
  primer_carril: number
  n_carriles: number
  nodos_m: number[]
}

/** Una corchera (o borde) de los carriles analizados. `indice` 0 = la del borde izquierdo. */
export type CuerdaRef = { indice: number; y_m: number; etiqueta: string }

export type PuntosReferencia = {
  geometria: Geometria
  anchoTotal_m: number
  puntos: PuntoRef[]
  cuerdas: CuerdaRef[]
  umbrales_error_m: { bueno: number; aceptable: number }
  /** Para juzgar cada clic, en píxeles. */
  umbrales_error_px: { bueno: number; aceptable: number }
}

/** Curvatura del lente (la estima el backend): para dibujar la rejilla como la ve la cámara. */
export type Distorsion = { k1: number; centro: Punto; escala: number }

/** Dónde se cuenta la llegada a cada pared (m desde la de salida) si la cámara no la ve. null = en la pared. */
export type Llegada = { inicio_m: number | null; fin_m: number | null }

/** Un punto marcado en la imagen. */
export type Marca = { id: string; px: Punto }

/** Un punto marcado sobre una corchera, en cualquier lugar de su largo. */
export type MarcaCuerda = { cuerda: number; px: Punto }

export type Nivel = 'sin_puntos' | 'insuficiente' | 'parcial' | 'completo' | 'revisar'

export type Evaluacion = {
  total: number
  marcados: number
  omitidos: number
  faltan: number
  minimo: number
  /** 0 a 1. */
  progreso: number
  nivel: Nivel
  titulo: string
  mensaje: string
  siguiente: PuntoRef | null
  pendientes: PuntoRef[]
  hastaM: number | null
  /** Homografía píxeles -> metros, o null si todavía no se puede calcular. */
  H: Matriz3 | null
  /** Su inversa (metros -> píxeles): sirve para dibujar la rejilla sobre la imagen. */
  Hinv: Matriz3 | null
  rmse_m: number | null
  cruzado_m: number | null
  errorPorPunto: Record<string, number>
  /** Error de cada clic en píxeles (con esto se colorean los puntos). */
  errorPxPorPunto: Record<string, number>
  peor: { id: string; etiqueta: string; error_m: number; error_px: number | null } | null
  /** Por corchera marcada: cuántos puntos y a qué distancia promedio (m, a lo ancho) quedan. */
  cuerdas: { indice: number; etiqueta: string; puntos: number; error_m: number | null }[]
  /** Error (m) de cada punto de corchera, en el orden en que se mandaron. */
  errorPorPuntoCuerda: number[]
  /** Curvatura del lente estimada, o null. Para dibujar: imagen = curvar(Hinv · metros). */
  distorsion: Distorsion | null
  advertencias: string[]
}

export type ArchivoCalibracion = {
  image_size: [number, number]
  puntos: { id: string; px: Punto; mundo: Punto }[]
  cuerdas: { cuerda: number; px: Punto; y_m: number }[]
  H: Matriz3
  distorsion: Distorsion | null
  rmse_m: number | null
  cruzado_m: number | null
  completa: boolean
  geometria: Geometria
  omitidos: string[]
  creada: string
}

export type ResultadoEvaluacion = { evaluacion: Evaluacion; archivo: ArchivoCalibracion | null }

export type CalibracionGuardada = {
  id: string
  nombre: string | null
  /** Nombres de las zonas guardadas con la calibración. */
  zonas: string[]
  llegada: Llegada | null
  completa: boolean
  rmse_m: number | null
  cruzado_m: number | null
}

// ---------------------------------------------------------------- cuentas

export type Rol = 'administrador' | 'entrenador' | 'nadador'

export type Usuario = { id: string; email: string; nombre: string; rol: Rol; activo: boolean }

// ---------------------------------------------------------------- sesiones y resultados

export type ModoProceso = 'celular' | 'servidor'

/** Un carril de una sesión, con su nadador (null = reservado, sin nadador todavía). */
export type AsignacionCarril = { carril: number; nadador_id: string | null; nadador: string | null; usuario_id: string | null }

export type Sesion = {
  id: string
  estado: 'activa' | 'finalizada' | 'cancelada'
  modo: ModoProceso
  calibracion_id: string | null
  /** Quién la inició: un entrenador (su grupo) o un nadador (su sesión libre). */
  iniciada_por_id: string | null
  carriles: AsignacionCarril[]
  inicio: string
  fin: string | null
}

/** Cómo ve un carril quien pregunta: libre, mío, en la sesión de mi entrenador (grupo) u ocupado por otra sesión. */
export type EstadoCarril = {
  carril: number
  estado: 'libre' | 'mio' | 'grupo' | 'ocupado'
  sesion_id: string | null
  con_nadador: boolean
  nadador: string | null
}

export type EstadoCarriles = { carriles: EstadoCarril[]; sesion_de_mi_entrenador: string | null }

/** Un nadador del grupo de un entrenador. */
export type NadadorDelGrupo = { id: string; usuario_id: string | null; entrenador_id: string | null; nombre: string; email: string | null }

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

export type ResultadosSesion = { eventos: EventoGuardado[]; tramos: TramoGuardado[] }

/** Una sesión del historial, con el resumen de lo medido (GET /api/sesiones). */
export type ResumenSesion = Omit<Sesion, 'carriles'> & {
  iniciada_por: string | null
  carriles: number[]
  tramos: number
  distancia_m: number
  velocidad_media_ms: number | null
}

/** Una calibración del historial. Cada una es una posición de la cámara, con sus zonas. */
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
  /** Si se guardó la imagen sobre la que se calibró. */
  tiene_imagen: boolean
}
