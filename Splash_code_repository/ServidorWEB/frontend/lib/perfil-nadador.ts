// Las preguntas del cuestionario inicial del nadador y los textos para mostrar sus respuestas.
// Solo pantalla: qué es válido lo decide el backend (domain/entities/perfil-nadador.entity.ts).
// El nombre, el correo y el teléfono NO se preguntan: ya se pidieron al crear la cuenta.
import type { Estilo, MarcaPersonal, RespuestasPerfil } from './tipos'

export type Clave = keyof RespuestasPerfil
export type Valor = RespuestasPerfil[Clave]
export type Opcion = { valor: string | number | boolean; texto: string; detalle?: string }

export type Pregunta = {
  id: string
  etapa: number
  titulo: string
  ayuda?: string
  tipo: 'fecha' | 'numero' | 'opcion' | 'multiple' | 'texto' | 'tiempos'
  /** Dónde se guarda la respuesta (las de tipo "tiempos" se guardan aparte, una por una). */
  clave?: Clave
  opciones?: Opcion[] | ((r: RespuestasPerfil) => Opcion[])
  /** multiple: la opción que significa "ninguna" (se guarda como lista vacía y no se combina con otras). */
  ninguna?: string
  unidad?: string
  min?: number
  max?: number
  obligatoria?: boolean
  /** La pregunta aparece solo si esto da true. */
  mostrar?: (r: RespuestasPerfil) => boolean
}

export const ETAPAS = [
  { n: 1, titulo: 'Información personal', corto: 'Personal' },
  { n: 2, titulo: 'Experiencia en natación', corto: 'Experiencia' },
  { n: 3, titulo: 'Estilos de natación', corto: 'Estilos' },
  { n: 4, titulo: 'Rendimiento y resistencia', corto: 'Rendimiento' },
  { n: 5, titulo: 'Objetivos deportivos', corto: 'Objetivos' },
  { n: 6, titulo: 'Información complementaria', corto: 'Complementaria' },
] as const

export const ESTILOS: { valor: Estilo; texto: string; detalle: string }[] = [
  { valor: 'libre', texto: 'Libre (crol)', detalle: 'Boca abajo, con movimiento alternado de brazos.' },
  { valor: 'espalda', texto: 'Espalda', detalle: 'Nado boca arriba.' },
  { valor: 'pecho', texto: 'Pecho (braza)', detalle: 'Movimiento simétrico de brazos y piernas.' },
  { valor: 'mariposa', texto: 'Mariposa', detalle: 'Brazos simultáneos y patada de delfín.' },
]
export const NOMBRE_ESTILO: Record<Estilo, string> = { libre: 'Libre', espalda: 'Espalda', pecho: 'Pecho', mariposa: 'Mariposa' }

const SI_NO: Opcion[] = [
  { valor: true, texto: 'Sí' },
  { valor: false, texto: 'No' },
]
const op = (pares: [string | number, string, string?][]): Opcion[] => pares.map(([valor, texto, detalle]) => ({ valor, texto, detalle }))
const metros = (m: number) => (m > 1500 ? 'Más de 1.500 m' : `${m.toLocaleString('es-CO')} m`)
const DISTANCIAS_PRUEBA = [25, 50, 100, 200, 400, 800, 1500]

/** Con experiencia o sin contestar todavía: se muestran las preguntas de experiencia y tiempos. */
const conExperiencia = (r: RespuestasPerfil) => r.tiene_experiencia !== false
/** Estilos que nada (sin contestar = todos). */
const estilosDe = (r: RespuestasPerfil): Opcion[] =>
  ESTILOS.filter((e) => !r.estilos?.length || r.estilos.includes(e.valor)).map((e) => ({ valor: e.valor, texto: e.texto }))

export const PREGUNTAS: Pregunta[] = [
  // ---------------------------------------------------------------- 1. información personal
  { id: 'fecha_nacimiento', etapa: 1, clave: 'fecha_nacimiento', tipo: 'fecha', titulo: '¿Cuál es tu fecha de nacimiento?', obligatoria: true },
  {
    id: 'sexo', etapa: 1, clave: 'sexo', tipo: 'opcion', titulo: '¿Cuál es tu sexo?', obligatoria: true,
    ayuda: 'Lo usamos para elegir el personaje que te acompaña.',
    opciones: op([['masculino', 'Masculino'], ['femenino', 'Femenino'], ['no_indica', 'Prefiero no indicarlo']]),
  },
  { id: 'estatura_cm', etapa: 1, clave: 'estatura_cm', tipo: 'numero', titulo: '¿Cuál es tu estatura?', unidad: 'cm', min: 80, max: 250 },
  { id: 'peso_kg', etapa: 1, clave: 'peso_kg', tipo: 'numero', titulo: '¿Cuál es tu peso actual?', unidad: 'kg', min: 15, max: 250 },
  {
    id: 'mano_dominante', etapa: 1, clave: 'mano_dominante', tipo: 'opcion', titulo: '¿Cuál es tu mano dominante?',
    opciones: op([['derecha', 'Derecha'], ['izquierda', 'Izquierda'], ['ambas', 'Ambas']]),
  },

  // ---------------------------------------------------------------- 2. experiencia
  {
    id: 'tiene_experiencia', etapa: 2, clave: 'tiene_experiencia', tipo: 'opcion', titulo: '¿Tienes experiencia nadando?', opciones: SI_NO,
    ayuda: 'Si estás empezando, no te preguntaremos por tiempos de competencia.',
  },
  {
    id: 'tiempo_practicando', etapa: 2, clave: 'tiempo_practicando', tipo: 'opcion', titulo: '¿Cuánto tiempo llevas practicando natación?', mostrar: conExperiencia,
    opciones: op([['menos_6m', 'Menos de 6 meses'], ['6_12m', '6 a 12 meses'], ['1_2a', '1 a 2 años'], ['3_5a', '3 a 5 años'], ['mas_5a', 'Más de 5 años']]),
  },
  {
    id: 'nivel', etapa: 2, clave: 'nivel', tipo: 'opcion', titulo: '¿Cómo describirías tu nivel de natación?', mostrar: conExperiencia,
    opciones: op([
      ['principiante', 'Principiante', 'Estoy aprendiendo o mejorando lo básico.'],
      ['intermedio', 'Intermedio', 'Nado con soltura al menos un estilo.'],
      ['avanzado', 'Avanzado', 'Domino varios estilos y entreno con regularidad.'],
      ['competitivo', 'Competitivo', 'Entreno para competir.'],
    ]),
  },
  {
    id: 'competencias', etapa: 2, clave: 'competencias', tipo: 'opcion', titulo: '¿Has participado en competencias?', mostrar: conExperiencia,
    opciones: op([['nunca', 'Nunca'], ['locales', 'Locales'], ['regionales', 'Regionales'], ['nacionales', 'Nacionales'], ['internacionales', 'Internacionales']]),
  },
  { id: 'entrena_actualmente', etapa: 2, clave: 'entrena_actualmente', tipo: 'opcion', titulo: '¿Actualmente entrenas natación?', opciones: SI_NO },

  // ---------------------------------------------------------------- 3. estilos
  {
    id: 'estilos', etapa: 3, clave: 'estilos', tipo: 'multiple', titulo: '¿Qué estilos de natación sabes nadar?', ayuda: 'Puedes elegir varios.',
    ninguna: 'ninguno',
    opciones: [...ESTILOS, { valor: 'ninguno', texto: 'No domino ningún estilo', detalle: 'Estoy empezando.' }],
  },
  { id: 'estilo_favorito', etapa: 3, clave: 'estilo_favorito', tipo: 'opcion', titulo: '¿Cuál es tu estilo favorito?', opciones: estilosDe, mostrar: (r) => (r.estilos?.length ?? 0) > 1 },
  { id: 'estilo_fuerte', etapa: 3, clave: 'estilo_fuerte', tipo: 'opcion', titulo: '¿Cuál consideras que es tu estilo más fuerte?', ayuda: 'Será tu estilo principal.', opciones: estilosDe, mostrar: (r) => r.estilos?.length !== 0 && r.estilos?.length !== 1 },
  { id: 'estilo_dificil', etapa: 3, clave: 'estilo_dificil', tipo: 'opcion', titulo: '¿Cuál te cuesta más trabajo?', opciones: estilosDe, mostrar: (r) => r.estilos?.length !== 0 && r.estilos?.length !== 1 },

  // ---------------------------------------------------------------- 4. rendimiento
  {
    id: 'distancias', etapa: 4, clave: 'distancias', tipo: 'multiple', titulo: '¿Qué distancias sueles nadar?', ayuda: 'Puedes elegir varias.',
    mostrar: conExperiencia,
    opciones: [...[...DISTANCIAS_PRUEBA, 1501].map((d) => ({ valor: d, texto: metros(d) })), { valor: 'otra', texto: 'Otra distancia' }],
  },
  { id: 'distancia_otra', etapa: 4, clave: 'distancia_otra', tipo: 'texto', titulo: '¿Qué otra distancia sueles nadar?', ayuda: 'Opcional.', mostrar: (r) => (r.distancias as unknown[] | undefined)?.includes('otra') === true, max: 100 },
  {
    id: 'conoce_tiempos', etapa: 4, clave: 'conoce_tiempos', tipo: 'opcion', titulo: '¿Conoces tus tiempos actuales de natación?', mostrar: conExperiencia,
    opciones: op([['si', 'Sí, conozco mis tiempos'], ['algunos', 'Tengo algunos tiempos registrados'], ['no', 'No conozco mis tiempos']]),
  },
  {
    id: 'tiempos', etapa: 4, tipo: 'tiempos', titulo: 'Registra tus tiempos',
    ayuda: 'Agrega los que recuerdes. Calculamos tu mejor marca, tu promedio y tu último tiempo, sin mezclar estilos, distancias ni piscinas.',
    mostrar: (r) => conExperiencia(r) && (r.conoce_tiempos === 'si' || r.conoce_tiempos === 'algunos'),
  },
  {
    id: 'mejor_distancia', etapa: 4, clave: 'mejor_distancia', tipo: 'opcion', titulo: '¿Cuál consideras que es tu mejor distancia?',
    mostrar: (r) => conExperiencia(r) && (r.distancias?.length ?? 0) > 1,
    opciones: (r) => [...(r.distancias ?? DISTANCIAS_PRUEBA).filter((d) => typeof d === 'number').map((d) => ({ valor: d, texto: metros(d) })), { valor: 'otra', texto: 'Otra distancia' }],
  },
  { id: 'mejor_distancia_otra', etapa: 4, clave: 'mejor_distancia_otra', tipo: 'texto', titulo: '¿Cuál es tu otra mejor distancia?', ayuda: 'Indica la distancia en metros.', mostrar: (r) => r.mejor_distancia === ('otra' as never), max: 100 },
  {
    id: 'metros_sin_parar', etapa: 4, clave: 'metros_sin_parar', tipo: 'opcion', titulo: '¿Cuántos metros puedes nadar sin detenerte?',
    mostrar: conExperiencia,
    opciones: op([['25', '25 m'], ['50', '50 m'], ['100', '100 m'], ['200', '200 m'], ['400', '400 m'], ['mas_400', 'Más de 400 m'], ['no_se', 'No lo sé'], ['otro', 'Otra cantidad']]),
  },
  { id: 'metros_sin_parar_otro', etapa: 4, clave: 'metros_sin_parar_otro', tipo: 'texto', titulo: '¿Cuántos metros puedes nadar sin detenerte?', ayuda: 'Indica una cantidad aproximada.', mostrar: (r) => r.metros_sin_parar === 'otro', max: 100 },
  {
    id: 'minutos_continuos', etapa: 4, clave: 'minutos_continuos', tipo: 'opcion', titulo: '¿Cuánto tiempo puedes mantenerte nadando sin parar?',
    mostrar: conExperiencia,
    opciones: op([['menos_5', 'Menos de 5 minutos'], ['5_15', '5 a 15 minutos'], ['15_30', '15 a 30 minutos'], ['30_45', '30 a 45 minutos'], ['mas_45', 'Más de 45 minutos'], ['otro', 'Otro tiempo']]),
  },
  { id: 'minutos_continuos_otro', etapa: 4, clave: 'minutos_continuos_otro', tipo: 'texto', titulo: '¿Cuánto tiempo puedes mantenerte nadando?', ayuda: 'Indica una duración aproximada.', mostrar: (r) => r.minutos_continuos === 'otro', max: 100 },
  {
    id: 'resistencia', etapa: 4, clave: 'resistencia', tipo: 'opcion', titulo: '¿Cómo calificas tu resistencia en el agua?',
    mostrar: conExperiencia,
    opciones: op([['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']]),
  },

  // ---------------------------------------------------------------- 5. objetivos
  {
    id: 'objetivos', etapa: 5, clave: 'objetivos', tipo: 'multiple', titulo: '¿Cuál es tu principal objetivo en natación?', ayuda: 'Puedes elegir varios.',
    opciones: op([
      ['tiempos', 'Mejorar mis tiempos'], ['resistencia', 'Mejorar mi resistencia'], ['velocidad', 'Aumentar mi velocidad'], ['tecnica', 'Mejorar mi técnica'],
      ['estilos', 'Aprender nuevos estilos'], ['competir', 'Prepararme para competencias'], ['condicion', 'Mejorar mi condición física'], ['retomar', 'Retomar la natación'], ['otro', 'Otro objetivo'],
    ]),
  },
  { id: 'objetivo_otro', etapa: 5, clave: 'objetivo_otro', tipo: 'texto', titulo: '¿Cuál es tu otro objetivo?', ayuda: 'Cuéntanos cuál es tu objetivo.', mostrar: (r) => r.objetivos?.includes('otro' as never) === true, max: 200 },
  { id: 'meta_tiempo', etapa: 5, clave: 'meta_tiempo', tipo: 'opcion', titulo: '¿Tienes alguna meta de tiempo?', opciones: SI_NO },
  {
    id: 'distancia_mejorar', etapa: 5, clave: 'distancia_mejorar', tipo: 'opcion', titulo: '¿Qué distancia quieres mejorar?',
    mostrar: (r) => r.meta_tiempo === true,
    opciones: [...[50, 100, 200, 400, 800, 1500].map((d) => ({ valor: d, texto: metros(d) })), { valor: 'otra', texto: 'Otra distancia' }],
  },
  { id: 'distancia_mejorar_otra', etapa: 5, clave: 'distancia_mejorar_otra', tipo: 'texto', titulo: '¿Qué otra distancia quieres mejorar?', ayuda: 'Indica la distancia en metros.', mostrar: (r) => r.distancia_mejorar === ('otra' as never), max: 100 },
  { id: 'tiempo_objetivo', etapa: 5, clave: 'tiempo_objetivo', tipo: 'texto', titulo: '¿Cuál es el tiempo que deseas alcanzar?', ayuda: 'Por ejemplo: 1:10 en 100 m.', mostrar: (r) => r.meta_tiempo === true, max: 20 },
  { id: 'plazo', etapa: 5, clave: 'plazo', tipo: 'opcion', titulo: '¿En cuánto tiempo quieres alcanzar tu objetivo?', mostrar: (r) => r.meta_tiempo === true, opciones: op([['1m', '1 mes'], ['3m', '3 meses'], ['6m', '6 meses'], ['1a', '1 año']]) },
  {
    id: 'aspecto_mejorar', etapa: 5, clave: 'aspecto_mejorar', tipo: 'opcion', titulo: '¿Qué aspecto consideras que necesitas mejorar?',
    opciones: op([['velocidad', 'Velocidad'], ['resistencia', 'Resistencia'], ['tecnica', 'Técnica'], ['respiracion', 'Respiración'], ['coordinacion', 'Coordinación'], ['otro', 'Otro aspecto']]),
  },
  { id: 'aspecto_mejorar_otro', etapa: 5, clave: 'aspecto_mejorar_otro', tipo: 'texto', titulo: '¿Qué otro aspecto necesitas mejorar?', ayuda: 'Cuéntanos cuál.', mostrar: (r) => r.aspecto_mejorar === 'otro', max: 200 },
  { id: 'meta_libre', etapa: 5, clave: 'meta_libre', tipo: 'texto', titulo: '¿Qué te gustaría conseguir con tu entrenamiento?', ayuda: 'Cuéntalo con tus palabras.', max: 500 },

  // ---------------------------------------------------------------- 6. complementaria (todo opcional)
  {
    id: 'tuvo_lesion', etapa: 6, clave: 'tuvo_lesion', tipo: 'opcion', titulo: '¿Has tenido alguna lesión que haya afectado tu entrenamiento?', opciones: SI_NO,
    ayuda: 'Es opcional. Solo sirve para que tu entrenador tenga contexto; no se usa para diagnósticos médicos.',
  },
  { id: 'lesion_detalle', etapa: 6, clave: 'lesion_detalle', tipo: 'texto', titulo: '¿Qué tipo de lesión, enfermedad o limitación tienes?', ayuda: 'Describe brevemente cómo afecta tu entrenamiento. Opcional.', max: 300, mostrar: (r) => r.tuvo_lesion === true },
  { id: 'suspendio_entrenamiento', etapa: 6, clave: 'suspendio_entrenamiento', tipo: 'opcion', titulo: '¿Has tenido que suspender tus entrenamientos durante algún período?', mostrar: conExperiencia, opciones: SI_NO },
  {
    id: 'tiempo_sin_entrenar', etapa: 6, clave: 'tiempo_sin_entrenar', tipo: 'opcion', titulo: '¿Cuánto tiempo llevas sin entrenar?', mostrar: (r) => r.suspendio_entrenamiento === true,
    opciones: op([['menos_1m', 'Menos de 1 mes'], ['1_6m', '1 a 6 meses'], ['6_12m', '6 a 12 meses'], ['mas_1a', 'Más de 1 año']]),
  },
  { id: 'usa_dispositivo', etapa: 6, clave: 'usa_dispositivo', tipo: 'opcion', titulo: '¿Utilizas algún dispositivo para registrar tus entrenamientos?', opciones: SI_NO },
  { id: 'registra_tiempos', etapa: 6, clave: 'registra_tiempos', tipo: 'opcion', titulo: '¿Llevas un registro de tus tiempos?', mostrar: conExperiencia, opciones: SI_NO },
  { id: 'comentario_adicional', etapa: 6, clave: 'comentario_adicional', tipo: 'texto', titulo: '¿Hay algo más que debamos conocer sobre tu entrenamiento?', ayuda: 'Opcional.', max: 500 },
]

export const opcionesDe = (p: Pregunta, r: RespuestasPerfil): Opcion[] => (typeof p.opciones === 'function' ? p.opciones(r) : (p.opciones ?? []))
export const visibles = (r: RespuestasPerfil, etapa?: number) => PREGUNTAS.filter((p) => (etapa === undefined || p.etapa === etapa) && (!p.mostrar || p.mostrar(r)))

/** El texto de una respuesta, tal como se ve en las opciones (o null si no está contestada). */
export function textoRespuesta(clave: Clave, r: RespuestasPerfil): string | null {
  const v = r[clave]
  if (v === undefined || v === null) return null
  const p = PREGUNTAS.find((x) => x.clave === clave)
  if (!p) return String(v)
  if (p.tipo === 'fecha') return new Date(`${v}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  if (p.tipo === 'numero') return `${v} ${p.unidad ?? ''}`.trim()
  if (p.tipo === 'texto') return String(v)
  const ops = opcionesDe(p, {})
  const de = (x: unknown) => ops.find((o) => o.valor === x)?.texto ?? String(x)
  if (Array.isArray(v)) return v.length ? v.map(de).join(', ') : (ops.find((o) => o.valor === p.ninguna)?.texto ?? 'Ninguno')
  return de(v)
}

/** m:ss.cc (o ss.cc s) */
export function formatearTiempo(ms: number): string {
  const cs = Math.round(ms / 10)
  const min = Math.floor(cs / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = String(cs % 100).padStart(2, '0')
  return min ? `${min}:${String(s).padStart(2, '0')}.${c}` : `${s}.${c} s`
}

/** La marca que se destaca: la del estilo más fuerte o favorito, si hay; si no, la de más registros. */
export function marcaDestacada(marcas: MarcaPersonal[], r: RespuestasPerfil): MarcaPersonal | null {
  const preferido = r.estilo_fuerte ?? r.estilo_favorito
  const delPreferido = preferido ? marcas.filter((m) => m.estilo === preferido) : []
  const candidatas = delPreferido.length ? delPreferido : marcas
  return [...candidatas].sort((a, b) => b.registros - a.registros || a.distancia_m - b.distancia_m)[0] ?? null
}
