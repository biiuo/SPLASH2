// La historia deportiva: un texto corto armado SOLO con lo que el nadador contestó y con sus tiempos.
// Si falta un dato, la frase que lo usaría no se escribe (nunca se inventa información).
import {
  edadDe,
  type Estilo,
  type MarcaPersonal,
  type RespuestasPerfil,
} from '../entities/perfil-nadador.entity'

const ESTILO: Record<Estilo, string> = { libre: 'libre', espalda: 'espalda', pecho: 'pecho', mariposa: 'mariposa' }
const NIVEL = { principiante: 'principiante', intermedio: 'intermedio', avanzado: 'avanzado', competitivo: 'competitivo' } as const
const EXPERIENCIA = {
  menos_6m: 'menos de seis meses',
  '6_12m': 'entre seis meses y un año',
  '1_2a': 'entre uno y dos años',
  '3_5a': 'entre tres y cinco años',
  mas_5a: 'más de cinco años',
} as const
const COMPETENCIAS = {
  nunca: 'Todavía no ha participado en competencias',
  locales: 'Ha participado en competencias locales',
  regionales: 'Ha participado en competencias regionales',
  nacionales: 'Ha participado en competencias nacionales',
  internacionales: 'Ha participado en competencias internacionales',
} as const
const OBJETIVO = {
  tiempos: 'mejorar sus tiempos',
  resistencia: 'mejorar su resistencia',
  velocidad: 'aumentar su velocidad',
  tecnica: 'mejorar su técnica',
  estilos: 'aprender nuevos estilos',
  competir: 'prepararse para competencias',
  condicion: 'mejorar su condición física',
  retomar: 'retomar la natación',
} as const
const ASPECTO = {
  velocidad: 'la velocidad',
  resistencia: 'la resistencia',
  tecnica: 'la técnica',
  respiracion: 'la respiración',
  coordinacion: 'la coordinación',
} as const
const PLAZO = { '1m': 'un mes', '3m': 'tres meses', '6m': 'seis meses', '1a': 'un año' } as const
const HORARIO = { manana: 'en la mañana', tarde: 'en la tarde', noche: 'en la noche' } as const
const RESISTENCIA = { baja: 'baja', media: 'media', alta: 'alta' } as const
const SIN_PARAR: Record<string, string> = { '25': '25 m', '50': '50 m', '100': '100 m', '200': '200 m', '400': '400 m', mas_400: 'más de 400 m' }

/** "a", "a y b", "a, b y c" */
export function enumerar(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`
}

const metros = (m: number) => `${m.toLocaleString('es-CO')} metros`
const numeroEnLetras = (n: number) => ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete'][n] ?? String(n)

/** m:ss.cc o s.cc */
export function formatearTiempo(ms: number): string {
  const cs = Math.round(ms / 10)
  const min = Math.floor(cs / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  const sc = `${String(s).padStart(min ? 2 : 1, '0')}.${String(c).padStart(2, '0')}`
  return min ? `${min}:${sc}` : `${sc} s`
}

/**
 * Párrafos de la historia. `sexo` decide "Nadador" / "Nadadora" (sin sexo indicado: "Deportista").
 * Devuelve [] si todavía no hay nada que contar.
 */
export function generarHistoria(r: RespuestasPerfil, marcas: MarcaPersonal[], hoy: Date): string[] {
  const parrafos: string[] = []
  const sujeto = r.sexo === 'masculino' ? 'Nadador' : r.sexo === 'femenino' ? 'Nadadora' : 'Deportista'

  // 1. quién es y su experiencia
  const p1: string[] = []
  const edad = edadDe(r.fecha_nacimiento, hoy)
  let inicio = sujeto
  if (edad !== null) inicio += ` de ${edad} años`
  if (r.tiene_experiencia === false) {
    p1.push(`${inicio} que está comenzando en la natación, con nivel inicial principiante.`)
  } else if (r.nivel || r.tiempo_practicando) {
    const partes = [r.nivel ? `con nivel ${NIVEL[r.nivel]}` : null, r.tiempo_practicando ? `${EXPERIENCIA[r.tiempo_practicando]} de experiencia` : null].filter(Boolean)
    p1.push(`${inicio} ${enumerar(partes as string[])} en natación.`)
  } else if (edad !== null) {
    p1.push(`${inicio}.`)
  }
  if (r.competencias) p1.push(`${COMPETENCIAS[r.competencias]}.`)
  if (r.entrena_actualmente === true) p1.push('Actualmente entrena natación.')
  else if (r.entrena_actualmente === false) p1.push('Actualmente no está entrenando.')

  // estilos
  if (r.estilos) {
    if (r.estilos.length === 0) p1.push('Todavía no domina ningún estilo.')
    else if (r.estilos.length === 4) p1.push(`Nada los cuatro estilos${r.estilo_fuerte ? `, siendo ${ESTILO[r.estilo_fuerte]} su especialidad` : ''}.`)
    else p1.push(`Domina ${r.estilos.length === 1 ? 'el estilo' : 'los estilos'} ${enumerar(r.estilos.map((e) => ESTILO[e]))}${r.estilo_fuerte ? `, siendo ${ESTILO[r.estilo_fuerte]} su especialidad` : ''}.`)
  }
  if (r.estilo_favorito && r.estilo_favorito !== r.estilo_fuerte) p1.push(`Su estilo favorito es ${ESTILO[r.estilo_favorito]}.`)
  if (r.estilo_dificil) p1.push(`El estilo que más le cuesta es ${ESTILO[r.estilo_dificil]}.`)
  if (p1.length) parrafos.push(p1.join(' '))

  // 2. rendimiento
  const p2: string[] = []
  if (r.mejor_distancia === 'otra') p2.push(r.mejor_distancia_otra ? `Su otra mejor distancia es ${r.mejor_distancia_otra}.` : 'Tiene una mejor distancia distinta a las opciones habituales.')
  else if (r.mejor_distancia) p2.push(`Su mejor distancia es ${metros(r.mejor_distancia)}.`)
  else if (r.distancias?.length) {
    const ds = r.distancias.map((d) => d === 'otra' ? (r.distancia_otra ? `otra distancia: ${r.distancia_otra}` : 'otra distancia') : d > 1500 ? 'más de 1.500 metros' : metros(d))
    p2.push(`Suele nadar ${enumerar(ds)}.`)
  }
  const mejor = elegirMarcaDestacada(marcas, r.estilo_fuerte ?? r.estilo_favorito)
  if (mejor) {
    p2.push(
      `Su mejor marca registrada es ${formatearTiempo(mejor.mejor_ms)} en ${mejor.distancia_m} m ${ESTILO[mejor.estilo]} (piscina de ${mejor.piscina_m} m)` +
        (mejor.registros > 1 ? `, con un promedio de ${formatearTiempo(mejor.promedio_ms)} en ${mejor.registros} registros.` : '.'),
    )
  }
  if (r.metros_sin_parar && r.metros_sin_parar !== 'no_se') p2.push(`Puede nadar ${SIN_PARAR[r.metros_sin_parar]} sin detenerse.`)
  if (r.resistencia) p2.push(`Califica su resistencia en el agua como ${RESISTENCIA[r.resistencia]}.`)
  if (p2.length) parrafos.push(p2.join(' '))

  // 3. objetivos
  const p3: string[] = []
  if (r.objetivos?.length) p3.push(`Busca ${enumerar(r.objetivos.map((o) => o === 'otro' ? (r.objetivo_otro ? `otro objetivo: ${r.objetivo_otro}` : 'otro objetivo') : OBJETIVO[o]))}.`)
  if (r.aspecto_mejorar) p3.push(`Considera que necesita mejorar ${r.aspecto_mejorar === 'otro' ? (r.aspecto_mejorar_otro ?? 'otro aspecto') : ASPECTO[r.aspecto_mejorar]}.`)
  if (r.distancia_mejorar || r.plazo) {
    const que = r.distancia_mejorar === 'otra' ? `mejorar en ${r.distancia_mejorar_otra || 'otra distancia'}` : r.distancia_mejorar ? `mejorar en ${metros(r.distancia_mejorar)}` : 'alcanzar su objetivo'
    p3.push(`Quiere ${que}${r.plazo ? ` en ${PLAZO[r.plazo]}` : ''}.`)
  }
  if (r.meta_libre) p3.push(`En sus palabras: «${r.meta_libre}».`)
  if (p3.length) parrafos.push(p3.join(' '))

  // 4. disponibilidad
  const p4: string[] = []
  if (r.dias_semana) {
    const dia = r.dias_semana === 1 ? 'día' : 'días'
    p4.push(
      `Tiene disponibilidad para entrenar ${numeroEnLetras(r.dias_semana)} ${dia} por semana` +
        (r.minutos_sesion ? `, con sesiones de ${r.minutos_sesion} minutos` : '') +
        (r.horario ? `, preferiblemente ${HORARIO[r.horario]}` : '') +
        '.',
    )
  } else if (r.minutos_sesion) p4.push(`Puede dedicar ${r.minutos_sesion} minutos a cada entrenamiento.`)
  if (r.piscina_m) p4.push(`Entrena en piscina de ${r.piscina_m} metros.`)
  if (r.tiene_entrenador === true) p4.push('Cuenta con entrenador.')
  if (p4.length) parrafos.push(p4.join(' '))

  return parrafos
}

/** La marca que se destaca en la historia: la del estilo más fuerte o favorito, si hay; si no, la de más registros. */
function elegirMarcaDestacada(marcas: MarcaPersonal[], preferido: Estilo | undefined): MarcaPersonal | null {
  const delPreferido = preferido ? marcas.filter((m) => m.estilo === preferido) : []
  const candidatas = delPreferido.length ? delPreferido : marcas
  if (!candidatas.length) return null
  return [...candidatas].sort((a, b) => b.registros - a.registros || a.distancia_m - b.distancia_m)[0]
}
