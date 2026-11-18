// El perfil deportivo del nadador: lo que contesta en el cuestionario inicial y los tiempos que declara.
// Acá están las reglas: qué respuestas son válidas, qué es obligatorio y cómo se resumen los tiempos.
// El nombre, el correo y el teléfono NO están acá: se piden al crear la cuenta (tabla usuarios).

export const ESTILOS = ['libre', 'espalda', 'pecho', 'mariposa'] as const
export type Estilo = (typeof ESTILOS)[number]

/** Distancias de prueba (los tiempos solo se registran en estas). */
export const DISTANCIAS_PRUEBA = [25, 50, 100, 200, 400, 800, 1500] as const
/** Distancias que suele nadar: las de prueba y "más de 1.500 m" (1501). */
export const DISTANCIAS_HABITUALES = [...DISTANCIAS_PRUEBA, 1501] as const
export const PISCINAS = [25, 50] as const

export const OPCIONES = {
  sexo: ['masculino', 'femenino', 'no_indica'],
  mano_dominante: ['derecha', 'izquierda', 'ambas'],
  tiempo_practicando: ['menos_6m', '6_12m', '1_2a', '3_5a', 'mas_5a'],
  nivel: ['principiante', 'intermedio', 'avanzado', 'competitivo'],
  competencias: ['nunca', 'locales', 'regionales', 'nacionales', 'internacionales'],
  conoce_tiempos: ['si', 'algunos', 'no'],
  metros_sin_parar: ['25', '50', '100', '200', '400', 'mas_400', 'no_se', 'otro'],
  minutos_continuos: ['menos_5', '5_15', '15_30', '30_45', 'mas_45', 'otro'],
  resistencia: ['baja', 'media', 'alta'],
  objetivos: ['tiempos', 'resistencia', 'velocidad', 'tecnica', 'estilos', 'competir', 'condicion', 'retomar', 'otro'],
  plazo: ['1m', '3m', '6m', '1a'],
  aspecto_mejorar: ['velocidad', 'resistencia', 'tecnica', 'respiracion', 'coordinacion', 'otro'],
  horario: ['manana', 'tarde', 'noche'],
  dias: ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'],
  minutos_sesion: [30, 45, 60, 90, 120],
  tiempo_sin_entrenar: ['menos_1m', '1_6m', '6_12m', 'mas_1a'],
  piscina_deseada: ['25', '50', 'ambas', 'no_definida'],
} as const

type De<K extends keyof typeof OPCIONES> = (typeof OPCIONES)[K][number]

/** Todas las respuestas son opcionales: el cuestionario se guarda de a poco y se puede saltar preguntas. */
export type RespuestasPerfil = {
  // 1. información personal (el nombre ya está en la cuenta)
  fecha_nacimiento?: string
  sexo?: De<'sexo'>
  estatura_cm?: number
  peso_kg?: number
  mano_dominante?: De<'mano_dominante'>
  // 2. experiencia
  tiene_experiencia?: boolean
  tiempo_practicando?: De<'tiempo_practicando'>
  nivel?: De<'nivel'>
  competencias?: De<'competencias'>
  entrena_actualmente?: boolean
  // 3. estilos ([] = no domina ninguno)
  estilos?: Estilo[]
  estilo_favorito?: Estilo
  estilo_fuerte?: Estilo
  estilo_dificil?: Estilo
  // 4. rendimiento
  distancias?: (number | 'otra')[]
  distancia_otra?: string
  conoce_tiempos?: De<'conoce_tiempos'>
  mejor_distancia?: number | 'otra'
  mejor_distancia_otra?: string
  metros_sin_parar?: De<'metros_sin_parar'>
  metros_sin_parar_otro?: string
  minutos_continuos?: De<'minutos_continuos'>
  minutos_continuos_otro?: string
  resistencia?: De<'resistencia'>
  // 5. objetivos
  objetivos?: De<'objetivos'>[]
  objetivo_otro?: string
  meta_tiempo?: boolean
  distancia_mejorar?: number | 'otra'
  distancia_mejorar_otra?: string
  plazo?: De<'plazo'>
  aspecto_mejorar?: De<'aspecto_mejorar'>
  aspecto_mejorar_otro?: string
  meta_libre?: string
  // 6. disponibilidad
  dias_semana?: number
  minutos_sesion?: De<'minutos_sesion'>
  horario?: De<'horario'>
  dias?: De<'dias'>[]
  tiene_entrenador?: boolean
  piscina_m?: (typeof PISCINAS)[number]
  piscina_deseada?: De<'piscina_deseada'>
  sesiones_semana?: number
  // 7. complementaria (opcional; nunca se usa para diagnosticar)
  tuvo_lesion?: boolean
  lesion_detalle?: string
  suspendio_entrenamiento?: boolean
  tiempo_sin_entrenar?: De<'tiempo_sin_entrenar'>
  usa_dispositivo?: boolean
  registra_tiempos?: boolean
  tiempo_objetivo?: string
  comentario_adicional?: string
}

export type ClaveRespuesta = keyof RespuestasPerfil

/** Lo mínimo para terminar el cuestionario (regla 1: los datos personales obligatorios). */
export const OBLIGATORIAS: ClaveRespuesta[] = ['fecha_nacimiento', 'sexo']

export type EstadoPerfil = 'nuevo' | 'en_progreso' | 'completo' | 'omitido'

export type TiempoPersonal = {
  id: string
  estilo: Estilo
  distancia_m: number
  piscina_m: number
  tiempo_ms: number
  /** AAAA-MM-DD */
  fecha: string
  creado_en: string
}

export type NuevoTiempo = Omit<TiempoPersonal, 'id' | 'creado_en'>

/** Mejor, promedio y último tiempo de UNA combinación de estilo, distancia y piscina (nunca se mezclan). */
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

export type PerfilGuardado = {
  nadador_id: string
  respuestas: RespuestasPerfil
  etapa: number
  omitido: boolean
  completado_en: string | null
  actualizado_en: string
}

// ---------------------------------------------------------------- validación

const FECHA = /^\d{4}-\d{2}-\d{2}$/

type Validador = (v: unknown) => unknown | Error

const una = (opciones: readonly (string | number)[]): Validador => (v) =>
  opciones.includes(v as string | number) ? v : new Error(`tiene que ser una de: ${opciones.join(', ')}`)
const varias = (opciones: readonly (string | number)[]): Validador => (v) => {
  if (!Array.isArray(v) || v.some((x) => !opciones.includes(x))) return new Error(`tiene que ser una lista de: ${opciones.join(', ')}`)
  return [...new Set(v)]
}
const siNo: Validador = (v) => (typeof v === 'boolean' ? v : new Error('tiene que ser sí o no'))
const numero = (min: number, max: number, entero = false): Validador => (v) => {
  const n = typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n) || n < min || n > max || (entero && !Number.isInteger(n))) return new Error(`tiene que ser un número entre ${min} y ${max}`)
  return entero ? n : Math.round(n * 10) / 10
}
const texto = (max: number): Validador => (v) => {
  if (typeof v !== 'string') return new Error('tiene que ser texto')
  const t = v.trim()
  return t.length > max ? new Error(`puede tener hasta ${max} caracteres`) : t
}
const fechaNacimiento: Validador = (v) => {
  if (typeof v !== 'string' || !FECHA.test(v) || Number.isNaN(Date.parse(v))) return new Error('tiene que ser una fecha AAAA-MM-DD')
  const anios = edadDe(v, new Date())
  if (anios === null || anios < 3 || anios > 100) return new Error('no es una fecha de nacimiento posible')
  return v
}

const VALIDADORES: Record<ClaveRespuesta, Validador> = {
  fecha_nacimiento: fechaNacimiento,
  sexo: una(OPCIONES.sexo),
  estatura_cm: numero(80, 250),
  peso_kg: numero(15, 250),
  mano_dominante: una(OPCIONES.mano_dominante),
  tiene_experiencia: siNo,
  tiempo_practicando: una(OPCIONES.tiempo_practicando),
  nivel: una(OPCIONES.nivel),
  competencias: una(OPCIONES.competencias),
  entrena_actualmente: siNo,
  estilos: varias(ESTILOS),
  estilo_favorito: una(ESTILOS),
  estilo_fuerte: una(ESTILOS),
  estilo_dificil: una(ESTILOS),
  distancias: varias([...DISTANCIAS_HABITUALES, 'otra']),
  distancia_otra: texto(100),
  conoce_tiempos: una(OPCIONES.conoce_tiempos),
  mejor_distancia: (v) => v === 'otra' || (typeof v === 'number' && (DISTANCIAS_PRUEBA as readonly number[]).includes(v)) ? v : new Error('tiene que ser una distancia o "otra"'),
  mejor_distancia_otra: texto(100),
  metros_sin_parar: una(OPCIONES.metros_sin_parar),
  metros_sin_parar_otro: texto(100),
  minutos_continuos: una(OPCIONES.minutos_continuos),
  minutos_continuos_otro: texto(100),
  resistencia: una(OPCIONES.resistencia),
  objetivos: varias(OPCIONES.objetivos),
  objetivo_otro: texto(200),
  meta_tiempo: siNo,
  distancia_mejorar: (v) => v === 'otra' || (typeof v === 'number' && (DISTANCIAS_PRUEBA as readonly number[]).includes(v)) ? v : new Error('tiene que ser una distancia o "otra"'),
  distancia_mejorar_otra: texto(100),
  plazo: una(OPCIONES.plazo),
  aspecto_mejorar: una(OPCIONES.aspecto_mejorar),
  aspecto_mejorar_otro: texto(200),
  meta_libre: texto(500),
  dias_semana: numero(1, 7, true),
  minutos_sesion: una(OPCIONES.minutos_sesion),
  horario: una(OPCIONES.horario),
  dias: varias(OPCIONES.dias),
  tiene_entrenador: siNo,
  piscina_m: una(PISCINAS),
  piscina_deseada: una(OPCIONES.piscina_deseada),
  sesiones_semana: numero(0, 21, true),
  tuvo_lesion: siNo,
  lesion_detalle: texto(300),
  suspendio_entrenamiento: siNo,
  tiempo_sin_entrenar: una(OPCIONES.tiempo_sin_entrenar),
  usa_dispositivo: siNo,
  registra_tiempos: siNo,
  tiempo_objetivo: texto(20),
  comentario_adicional: texto(500),
}

export const CLAVES = Object.keys(VALIDADORES) as ClaveRespuesta[]

/**
 * Valida un lote de respuestas. `null` borra esa respuesta (por ejemplo, al saltar una pregunta ya contestada).
 * Devuelve los cambios limpios y la lista de problemas (vacía si todo está bien). Claves desconocidas = problema.
 */
export function validarRespuestas(entrada: unknown): { cambios: Partial<Record<ClaveRespuesta, unknown>>; problemas: string[] } {
  const problemas: string[] = []
  const cambios: Partial<Record<ClaveRespuesta, unknown>> = {}
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return { cambios, problemas: ['Las respuestas tienen que ser un objeto.'] }
  for (const [clave, valor] of Object.entries(entrada)) {
    const validar = VALIDADORES[clave as ClaveRespuesta]
    if (!validar) {
      problemas.push(`"${clave}" no es una pregunta del perfil.`)
      continue
    }
    if (valor === null) {
      cambios[clave as ClaveRespuesta] = null
      continue
    }
    const r = validar(valor)
    if (r instanceof Error) problemas.push(`"${clave}" ${r.message}.`)
    else cambios[clave as ClaveRespuesta] = r
  }
  return { cambios, problemas }
}

/** Junta las respuestas guardadas con los cambios (null borra) y quita lo que dejó de tener sentido. */
export function aplicarCambios(actuales: RespuestasPerfil, cambios: Partial<Record<ClaveRespuesta, unknown>>): RespuestasPerfil {
  const r: Record<string, unknown> = { ...actuales }
  for (const [k, v] of Object.entries(cambios)) {
    if (v === null) delete r[k]
    else r[k] = v
  }
  const p = r as RespuestasPerfil
  // sin experiencia: arranca como principiante y no se le piden tiempos competitivos
  if (p.tiene_experiencia === false) {
    p.nivel = 'principiante'
    for (const k of [
      'tiempo_practicando', 'competencias', 'conoce_tiempos', 'distancias',
      'mejor_distancia', 'metros_sin_parar', 'minutos_continuos', 'resistencia',
      'suspendio_entrenamiento', 'tiempo_sin_entrenar', 'registra_tiempos',
    ] as const) delete p[k]
  }
  // el favorito, el más fuerte y el más difícil tienen que ser estilos que nada
  if (p.estilos) {
    if (p.estilos.length === 0) {
      delete p.estilo_favorito
      delete p.estilo_fuerte
      delete p.estilo_dificil
    } else if (p.estilos.length === 1) {
      p.estilo_fuerte = p.estilos[0]
      delete p.estilo_favorito
      delete p.estilo_dificil
    } else {
      for (const k of ['estilo_favorito', 'estilo_fuerte', 'estilo_dificil'] as const) {
        if (p[k] && !p.estilos.includes(p[k])) delete p[k]
      }
    }
  }
  if (p.distancias) {
    const numericas = p.distancias.filter((d): d is number => typeof d === 'number')
    if (!p.distancias.includes('otra')) delete p.distancia_otra
    if (numericas.length === 1 && !p.distancias.includes('otra')) p.mejor_distancia = numericas[0]
    if (numericas.length > 1 && typeof p.mejor_distancia === 'number' && !numericas.includes(p.mejor_distancia)) delete p.mejor_distancia
  }
  if (p.metros_sin_parar !== 'otro') delete p.metros_sin_parar_otro
  if (p.minutos_continuos !== 'otro') delete p.minutos_continuos_otro
  if (p.meta_tiempo === false) {
    delete p.distancia_mejorar
    delete p.plazo
    delete p.tiempo_objetivo
    delete p.distancia_mejorar_otra
  } else if (p.distancia_mejorar !== 'otra') {
    delete p.distancia_mejorar_otra
  }
  if (!p.objetivos?.includes('otro')) delete p.objetivo_otro
  if (p.aspecto_mejorar !== 'otro') delete p.aspecto_mejorar_otro
  if (p.tuvo_lesion === false) delete p.lesion_detalle
  if (p.entrena_actualmente === true) {
    delete p.tiempo_sin_entrenar
  } else if (p.entrena_actualmente === false) {
    delete p.piscina_m
    delete p.sesiones_semana
  } else {
    delete p.piscina_deseada
  }
  if (p.suspendio_entrenamiento !== true) delete p.tiempo_sin_entrenar
  return p
}

/** Lo que falta para poder terminar el cuestionario. */
export function faltantes(r: RespuestasPerfil): string[] {
  const nombres: Partial<Record<ClaveRespuesta, string>> = { fecha_nacimiento: 'la fecha de nacimiento', sexo: 'el sexo' }
  return OBLIGATORIAS.filter((k) => r[k] === undefined).map((k) => `Falta ${nombres[k] ?? k}.`)
}

/** Valida un tiempo nuevo. Los tiempos se guardan en milisegundos (regla 2). */
export function validarTiempo(d: Record<string, unknown> | null | undefined, hoy: Date): { tiempo?: NuevoTiempo; problemas: string[] } {
  const problemas: string[] = []
  const estilo = d?.estilo
  const distancia = Number(d?.distancia_m)
  const piscina = Number(d?.piscina_m)
  const ms = Number(d?.tiempo_ms)
  const fecha = d?.fecha
  if (!ESTILOS.includes(estilo as Estilo)) problemas.push(`El estilo tiene que ser ${ESTILOS.join(', ')}.`)
  if (!(DISTANCIAS_PRUEBA as readonly number[]).includes(distancia)) problemas.push(`La distancia tiene que ser ${DISTANCIAS_PRUEBA.join(', ')} m.`)
  if (!(PISCINAS as readonly number[]).includes(piscina)) problemas.push('La piscina tiene que ser de 25 o de 50 m.')
  else if (piscina === 50 && distancia === 25) problemas.push('En una piscina de 50 m no hay pruebas de 25 m.')
  if (!Number.isInteger(ms) || ms <= 0 || ms >= 7_200_000) problemas.push('El tiempo no es válido.')
  if (typeof fecha !== 'string' || !FECHA.test(fecha) || Number.isNaN(Date.parse(fecha))) problemas.push('La fecha no es válida (AAAA-MM-DD).')
  else if (fecha > hoy.toISOString().slice(0, 10)) problemas.push('La fecha no puede ser futura.')
  if (problemas.length) return { problemas }
  // centésimas: múltiplos de 10 ms
  return { tiempo: { estilo: estilo as Estilo, distancia_m: distancia, piscina_m: piscina, tiempo_ms: Math.round(ms / 10) * 10, fecha: fecha as string }, problemas }
}

// ---------------------------------------------------------------- cálculos

/** Años cumplidos a esa fecha, o null si la fecha no sirve. */
export function edadDe(nacimiento: string | undefined, hoy: Date): number | null {
  if (!nacimiento || !FECHA.test(nacimiento)) return null
  const [a, m, d] = nacimiento.split('-').map(Number)
  let edad = hoy.getUTCFullYear() - a
  if (hoy.getUTCMonth() + 1 < m || (hoy.getUTCMonth() + 1 === m && hoy.getUTCDate() < d)) edad--
  return Number.isFinite(edad) ? edad : null
}

/**
 * Mejor marca, promedio y último tiempo por estilo + distancia + piscina (regla 5: nunca se mezclan).
 * Ordenado por estilo y distancia.
 */
export function marcasPersonales(tiempos: TiempoPersonal[]): MarcaPersonal[] {
  const grupos = new Map<string, TiempoPersonal[]>()
  for (const t of tiempos) {
    const k = `${t.estilo}|${t.distancia_m}|${t.piscina_m}`
    grupos.set(k, [...(grupos.get(k) ?? []), t])
  }
  const marcas = [...grupos.values()].map((ts): MarcaPersonal => {
    const mejor = ts.reduce((a, t) => (t.tiempo_ms < a.tiempo_ms ? t : a))
    const ultimo = ts.reduce((a, t) => (t.fecha > a.fecha || (t.fecha === a.fecha && t.creado_en > a.creado_en) ? t : a))
    return {
      estilo: ts[0].estilo,
      distancia_m: ts[0].distancia_m,
      piscina_m: ts[0].piscina_m,
      mejor_ms: mejor.tiempo_ms,
      mejor_fecha: mejor.fecha,
      promedio_ms: Math.round(ts.reduce((a, t) => a + t.tiempo_ms, 0) / ts.length / 10) * 10,
      ultimo_ms: ultimo.tiempo_ms,
      ultima_fecha: ultimo.fecha,
      registros: ts.length,
    }
  })
  return marcas.sort((a, b) => ESTILOS.indexOf(a.estilo) - ESTILOS.indexOf(b.estilo) || a.distancia_m - b.distancia_m || a.piscina_m - b.piscina_m)
}

export function estadoDe(p: PerfilGuardado | null): EstadoPerfil {
  if (!p) return 'nuevo'
  if (p.completado_en) return 'completo'
  if (p.omitido) return 'omitido'
  return 'en_progreso'
}
