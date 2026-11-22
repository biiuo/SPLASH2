// El contrato con la API (backend). Son solo tipos: la lógica de negocio (validar, evaluar, calcular la homografía)
// vive en el backend. Si cambia una respuesta de la API, se cambia acá.

import type { Distorsion, Matriz3, Punto } from '@/domain/calibracion/geometria'
export type { Distorsion, Matriz3, Punto } from '@/domain/calibracion/geometria'

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

export type Usuario = {
  id: string
  email: string
  nombre: string
  rol: Rol
  activo: boolean
  creado_en?: string
  telefono?: string | null
  /** Entrenador registrado que espera la aprobación del administrador. */
  pendiente?: boolean
}

// ---------------------------------------------------------------- sesiones y resultados

export type ModoProceso = 'celular' | 'servidor'

/** Un carril de una sesión, con su nadador (null = reservado, sin nadador todavía). */
export type AsignacionCarril = { carril: number; nadador_id: string | null; nadador: string | null; usuario_id: string | null }

export type Sesion = {
  id: string
  estado: 'activa' | 'finalizada' | 'cancelada'
  modo: ModoProceso
  calibracion_id: string | null
  /** Quién la inició: un entrenador (o administrador) o un nadador (su sesión personal). */
  iniciada_por_id: string | null
  iniciada_por: string | null
  iniciada_por_rol: Rol | null
  /** Sesión de un entrenador: de un grupo, o libre (null: cualquier nadador se puede sumar). */
  grupo_id: string | null
  grupo: string | null
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

/** Una sesión de un entrenador a la que me puedo sumar (de uno de mis grupos, o libre). */
export type SesionDisponible = { id: string; entrenador: string | null; grupo: string | null }

export type EstadoCarriles = { carriles: EstadoCarril[]; sesiones_disponibles: SesionDisponible[] }

/** Un nadador (perfil de una cuenta de nadador). */
export type Nadador = { id: string; usuario_id: string | null; nombre: string; email: string | null; telefono?: string | null }

/** Un grupo de un entrenador, con sus nadadores. Un entrenador puede tener varios. */
export type DiaSemana = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom'
export type NivelGrupo = 'principiante' | 'intermedio' | 'avanzado' | 'competitivo'
/** Cuándo entrena el grupo (horas HH:MM). */
export type HorarioGrupo = { dias: DiaSemana[]; inicio: string; fin: string }

export type Grupo = {
  id: string
  entrenador_id: string
  entrenador: string
  entrenador_email?: string | null
  entrenador_telefono?: string | null
  nombre: string
  descripcion?: string | null
  nivel?: NivelGrupo | null
  horario?: HorarioGrupo | null
  nadadores: Nadador[]
}

/** Un nadador de la lista de todos, con los ids de MIS grupos en los que ya está. */
export type NadadorDeLaLista = Nadador & { mis_grupos: string[] }

export type { EventoGuardado, TramoGuardado, Largo, ResultadosSesion } from '@/domain/sesion/resultados'

/** Una sesión del historial, con el resumen de lo medido (GET /api/sesiones). */
export type ResumenCarril = {
  carril: number
  /** Nombre del nadador de ese carril (null: carril sin nadador asignado). */
  nadador: string | null
  /** La cuenta de ese nadador (null: sin nadador o sin cuenta). */
  usuario_id: string | null
  tramos: number
  /** De esos tramos, cuántos son estimados. */
  tramos_estimados: number
  distancia_m: number
  velocidad_media_ms: number | null
  /** Largos completos y cuántos sin partes estimadas. */
  largos: number
  largos_medidos: number
  /** Récords de la sesión, solo con largos medidos. */
  mejor_largo_s: number | null
  velocidad_max_ms: number | null
}

export type ResumenSesion = Omit<Sesion, 'carriles'> & {
  carriles: number[]
  /** Totales de toda la sesión. */
  tramos: number
  distancia_m: number
  velocidad_media_ms: number | null
  /** Lo medido carril por carril, cada nadador por separado. */
  por_carril: ResumenCarril[]
}

export type { CalibracionResumen } from '@/domain/calibracion/calibracion-resumen'

// ---------------------------------------------------------------- administración

export type ResumenAdmin = {
  usuarios: Record<Rol, number>
  /** Entrenadores que esperan aprobación. */
  pendientes?: number
  sesiones: { activa: number; finalizada: number; cancelada: number; total: number; con_errores: number }
  por_dia: { dia: string; sesiones: number }[]
  recientes: ResumenSesion[]
  rendimiento: { distancia_m: number; velocidad_media_ms: number | null; largos: number; tramos: number; tramos_estimados: number }
}

/** Un componente que late (servidor de IA, celulares) y su último estado. */
export type EstadoComponente = {
  componente: string
  estado: {
    camara_conectada?: boolean
    procesando?: boolean
    fps?: number
    fps_camara?: number
    sesiones?: number
    identidades?: number
    pendientes_envio?: number
    errores_envio?: number
    zonas?: string
  }
  ultimo_latido: string
  hace_s: number
  vivo: boolean
}

export type Monitoreo = { componentes: EstadoComponente[]; activas: Sesion[] }

// ---------------------------------------------------------------- objetivos

export type TipoObjetivo = 'distancia' | 'velocidad' | 'tiempo_largo'

/** Una meta de un nadador entre dos fechas (YYYY-MM-DD, inclusive). */
export type Objetivo = {
  id: string
  nadador_id: string
  nadador: string
  usuario_id: string | null
  entrenador_id: string | null
  entrenador: string | null
  tipo: TipoObjetivo
  /** distancia: metros; velocidad: m/s; tiempo_largo: segundos (o menos). */
  meta: number
  desde: string
  hasta: string
  descripcion: string | null
  creado_en: string
}

// ---------------------------------------------------------------- perfil deportivo del nadador

export type Estilo = 'libre' | 'espalda' | 'pecho' | 'mariposa'
export type Sexo = 'masculino' | 'femenino' | 'no_indica'

/** Las respuestas del cuestionario (todas opcionales; el backend las valida). */
export type RespuestasPerfil = {
  fecha_nacimiento?: string
  sexo?: Sexo
  estatura_cm?: number
  peso_kg?: number
  mano_dominante?: 'derecha' | 'izquierda' | 'ambas'
  tiene_experiencia?: boolean
  tiempo_practicando?: 'menos_6m' | '6_12m' | '1_2a' | '3_5a' | 'mas_5a'
  nivel?: 'principiante' | 'intermedio' | 'avanzado' | 'competitivo'
  competencias?: 'nunca' | 'locales' | 'regionales' | 'nacionales' | 'internacionales'
  entrena_actualmente?: boolean
  estilos?: Estilo[]
  estilo_favorito?: Estilo
  estilo_fuerte?: Estilo
  estilo_dificil?: Estilo
  distancias?: (number | 'otra')[]
  distancia_otra?: string
  conoce_tiempos?: 'si' | 'algunos' | 'no'
  mejor_distancia?: number | 'otra'
  mejor_distancia_otra?: string
  metros_sin_parar?: '25' | '50' | '100' | '200' | '400' | 'mas_400' | 'no_se' | 'otro'
  metros_sin_parar_otro?: string
  minutos_continuos?: 'menos_5' | '5_15' | '15_30' | '30_45' | 'mas_45' | 'otro'
  minutos_continuos_otro?: string
  resistencia?: 'baja' | 'media' | 'alta'
  objetivos?: ('tiempos' | 'resistencia' | 'velocidad' | 'tecnica' | 'estilos' | 'competir' | 'condicion' | 'retomar' | 'otro')[]
  objetivo_otro?: string
  meta_tiempo?: boolean
  distancia_mejorar?: number | 'otra'
  distancia_mejorar_otra?: string
  plazo?: '1m' | '3m' | '6m' | '1a'
  aspecto_mejorar?: 'velocidad' | 'resistencia' | 'tecnica' | 'respiracion' | 'coordinacion' | 'otro'
  aspecto_mejorar_otro?: string
  meta_libre?: string
  dias_semana?: number
  minutos_sesion?: 30 | 45 | 60 | 90 | 120
  horario?: 'manana' | 'tarde' | 'noche'
  dias?: ('lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom')[]
  tiene_entrenador?: boolean
  piscina_m?: 25 | 50
  piscina_deseada?: '25' | '50' | 'ambas' | 'no_definida'
  sesiones_semana?: number
  tuvo_lesion?: boolean
  lesion_detalle?: string
  suspendio_entrenamiento?: boolean
  tiempo_sin_entrenar?: 'menos_1m' | '1_6m' | '6_12m' | 'mas_1a'
  usa_dispositivo?: boolean
  registra_tiempos?: boolean
  tiempo_objetivo?: string
  comentario_adicional?: string
}

export type TiempoPersonal = { id: string; estilo: Estilo; distancia_m: number; piscina_m: number; tiempo_ms: number; fecha: string; creado_en: string }

/** Mejor, promedio y último tiempo de una combinación de estilo + distancia + piscina. */
export type MarcaPersonal = {
  estilo: Estilo
  distancia_m: number
  piscina_m: number
  mejor_ms: number
  mejor_fecha: string
  promedio_ms: number
  ultimo_ms: number
  ultima_fecha: string
  registros: number
}

export type VistaPerfil = {
  nadador_id: string
  nombre: string
  /** nuevo: nunca lo abrió · en_progreso · omitido: "completar más tarde" · completo */
  estado: 'nuevo' | 'en_progreso' | 'omitido' | 'completo'
  etapa: number
  respuestas: RespuestasPerfil
  edad: number | null
  completado_en: string | null
  actualizado_en: string | null
  tiempos: TiempoPersonal[]
  marcas: MarcaPersonal[]
  historia: string[]
}
