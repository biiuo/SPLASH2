// Calibración guiada: qué puntos de la piscina hay que marcar en la imagen y cómo evaluar si alcanzan
// ("marcá este", "te faltan N", "ya está completo"). Las medidas de la piscina salen de la configuración.
//
// Coordenadas en metros, solo para los carriles analizados:
//   x = distancia a lo largo del carril desde la pared de salida (0 m)
//   y = posición a lo ancho: 0 = cuerda del primer carril analizado, "ancho total" = la del otro lado
// Los nodos son las marcas de las cuerdas (cambios de color, banderines...).

import type { ArchivoCalibracion, Geometria } from '../entities/calibracion.entity'
import { Configuracion, type ConfigPiscina } from '../entities/configuracion.entity'
import {
  aplicar,
  corregir,
  erroresDeAjuste,
  erroresDeCuerdas,
  estimarCalibracion,
  invertir,
  rmse,
  validacionCruzada,
  type Distorsion,
  type Matriz3,
  type Par,
  type ParCuerda,
  type Punto,
} from './homografia'

export function geometriaDe(p: ConfigPiscina): Geometria {
  return {
    largo_m: p.largo_m,
    ancho_carril_m: p.ancho_m / p.n_carriles,
    n_carriles_piscina: p.n_carriles,
    primer_carril: p.primer_carril,
    n_carriles: p.n_carriles_analizados,
    nodos_m: [...p.nodos_m].sort((a, b) => a - b),
  }
}

/** Ancho de los carriles analizados, en metros. */
export function anchoTotal(g: Geometria): number {
  return g.ancho_carril_m * g.n_carriles
}

export const GEOMETRIA_POR_DEFECTO = geometriaDe(Configuracion.porDefecto().piscina)

// Valores por defecto como constantes (largo 25 m, carriles de 1,5625 m, carriles 4 a 6).
export const LARGO_M = GEOMETRIA_POR_DEFECTO.largo_m
export const ANCHO_CARRIL_M = GEOMETRIA_POR_DEFECTO.ancho_carril_m
export const N_CARRILES = GEOMETRIA_POR_DEFECTO.n_carriles
export const ANCHO_TOTAL_M = anchoTotal(GEOMETRIA_POR_DEFECTO)
export const NODOS_M = GEOMETRIA_POR_DEFECTO.nodos_m

/** Mínimo para poder calcular la homografía. */
export const MINIMO_PUNTOS = 4

// Umbrales iniciales de calidad. Son un punto de partida: hay que validarlos con la cámara real.
export const ERROR_BUENO_M = 0.1
export const ERROR_ACEPTABLE_M = 0.25
/** Para juzgar un clic: a cuántos píxeles de donde lo ubican los demás puntos (un clic cuidadoso queda a 1-3 px). */
export const ERROR_PX_BUENO = 3
export const ERROR_PX_ACEPTABLE = 6

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

export function idPunto(nodo: number, lado: Lado): string {
  return `n${String(nodo).padStart(2, '0')}_${lado === 'izquierda' ? 'izq' : 'der'}`
}

/** Cómo llamar a la línea del lado izquierdo o derecho de los carriles analizados. */
function nombreCuerda(g: Geometria, lado: Lado): string {
  if (lado === 'izquierda') {
    return g.primer_carril <= 1
      ? 'línea del borde de la piscina, junto al carril 1'
      : `cuerda entre los carriles ${g.primer_carril - 1} y ${g.primer_carril}`
  }
  const ultimo = g.primer_carril + g.n_carriles - 1
  return ultimo >= g.n_carriles_piscina
    ? `línea del borde de la piscina, junto al carril ${ultimo}`
    : `cuerda entre los carriles ${ultimo} y ${ultimo + 1}`
}

/** Los puntos (cada marca x 2 bordes), en el orden en que conviene marcarlos: de a pares, avanzando. */
export function puntosReferencia(g: Geometria = GEOMETRIA_POR_DEFECTO): PuntoRef[] {
  const lista: PuntoRef[] = []
  for (const nodo of g.nodos_m) {
    for (const lado of ['izquierda', 'derecha'] as Lado[]) {
      const nombre = nombreCuerda(g, lado)
      lista.push({
        id: idPunto(nodo, lado),
        nodo_m: nodo,
        lado,
        mundo: [nodo, lado === 'izquierda' ? 0 : anchoTotal(g)],
        etiqueta: `Nodo de ${nodo} m · ${nombre}`,
        ayuda: `Marcá el punto que está a ${nodo} m de la pared de salida, sobre la ${nombre}.`,
      })
    }
  }
  return lista
}

export type Marca = { id: string; px: Punto }

/** Una corchera (o borde) de los carriles analizados: una recta de la piscina a lo largo, a una "y" conocida. */
export type CuerdaRef = { indice: number; y_m: number; etiqueta: string }

/** Un punto marcado sobre una corchera, en cualquier lugar de su largo. `cuerda` es el índice (0 = la del borde izquierdo). */
export type MarcaCuerda = { cuerda: number; px: Punto }

/** Las corcheras de los carriles analizados, de izquierda a derecha (n carriles -> n + 1 corcheras). */
export function cuerdasReferencia(g: Geometria = GEOMETRIA_POR_DEFECTO): CuerdaRef[] {
  return Array.from({ length: g.n_carriles + 1 }, (_, k) => {
    const etiqueta =
      k === 0
        ? nombreCuerda(g, 'izquierda')
        : k === g.n_carriles
          ? nombreCuerda(g, 'derecha')
          : `cuerda entre los carriles ${g.primer_carril + k - 1} y ${g.primer_carril + k}`
    return { indice: k, y_m: k * g.ancho_carril_m, etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) }
  })
}

/** Con unos pocos puntos por corchera alcanza; más no mejora y hace lento el cálculo. */
export const MAX_PUNTOS_CUERDA = 200

export type Nivel = 'sin_puntos' | 'insuficiente' | 'parcial' | 'completo' | 'revisar'

export type Evaluacion = {
  total: number
  marcados: number
  /** Puntos que la persona marcó como "no se ve en la imagen". */
  omitidos: number
  faltan: number
  minimo: number
  /** 0 a 1 (los omitidos cuentan como resueltos). */
  progreso: number
  nivel: Nivel
  titulo: string
  mensaje: string
  /** El próximo punto a marcar (el primero pendiente, en orden). */
  siguiente: PuntoRef | null
  pendientes: PuntoRef[]
  /** Hasta qué metro llegan los nodos ya marcados (con sus dos bordes), o null. */
  hastaM: number | null
  /** Homografía píxeles -> metros, o null si todavía no se puede calcular. */
  H: Matriz3 | null
  rmse_m: number | null
  /** Error de validación cruzada: el más realista. Solo desde 5 puntos. */
  cruzado_m: number | null
  /** Error por punto (m), para marcar cuál está mal puesto. */
  errorPorPunto: Record<string, number>
  /**
   * Error por punto en PÍXELES: a cuántos píxeles de donde lo marcaste lo pone la calibración. Es lo que sirve para
   * juzgar un clic: lejos, 1 px son 20 o 30 cm, y un nodo lejano siempre tendría mucho error en metros aunque el
   * clic sea perfecto.
   */
  errorPxPorPunto: Record<string, number>
  /** El punto peor marcado (el de más error en píxeles). */
  peor: { id: string; etiqueta: string; error_m: number; error_px: number | null } | null
  /** Por corchera marcada: cuántos puntos tiene y a qué distancia promedio (m, a lo ancho) quedan de donde deberían. */
  cuerdas: { indice: number; etiqueta: string; puntos: number; error_m: number | null }[]
  /** Error de cada punto de corchera (m), en el mismo orden en que llegaron. */
  errorPorPuntoCuerda: number[]
  /** Curvatura del lente estimada (null = no se corrige). H trabaja sobre puntos corregidos: metros = H · corregir(px). */
  distorsion: Distorsion | null
  advertencias: string[]
}

export function evaluar(
  marcas: Marca[],
  omitidos: string[] = [],
  g: Geometria = GEOMETRIA_POR_DEFECTO,
  marcasCuerda: MarcaCuerda[] = [],
  /** Tamaño de la imagen: hace falta para estimar la curvatura del lente (si no viene, no se corrige). */
  tam?: [number, number],
): Evaluacion {
  const refsCuerda = cuerdasReferencia(g)
  const enCuerda = marcasCuerda.filter((m) => refsCuerda.some((c) => c.indice === m.cuerda))
  const paresCuerda: ParCuerda[] = enCuerda.map((m) => ({ px: m.px, y: refsCuerda[m.cuerda].y_m }))
  const refs = puntosReferencia(g)
  const primerNodo = Math.min(...g.nodos_m)
  const ultimoNodo = Math.max(...g.nodos_m)
  const porId = new Map(refs.map((r) => [r.id, r]))
  const validas = marcas.filter((m) => porId.has(m.id))
  const marcadosIds = new Set(validas.map((m) => m.id))
  const omitidosIds = new Set(omitidos.filter((id) => porId.has(id) && !marcadosIds.has(id)))
  const pendientes = refs.filter((r) => !marcadosIds.has(r.id) && !omitidosIds.has(r.id))
  const siguiente = pendientes[0] ?? null
  const total = refs.length
  const marcados = validas.length
  const faltan = total - marcados - omitidosIds.size

  const pares: Par[] = validas.map((m) => ({ px: m.px, mundo: porId.get(m.id)!.mundo }))
  const advertencias: string[] = []

  // ¿hasta dónde llegó? Cuenta solo los nodos con sus dos bordes marcados.
  const nodosCompletos = g.nodos_m.filter((n) => marcadosIds.has(idPunto(n, 'izquierda')) && marcadosIds.has(idPunto(n, 'derecha')))
  const hastaM = nodosCompletos.length > 0 ? Math.max(...nodosCompletos) : null

  const maxNodo = validas.length > 0 ? Math.max(...validas.map((m) => porId.get(m.id)!.nodo_m)) : null
  const minNodo = validas.length > 0 ? Math.min(...validas.map((m) => porId.get(m.id)!.nodo_m)) : null
  const sinVer = (nodo: number) => refs.filter((r) => r.nodo_m === nodo).every((r) => omitidosIds.has(r.id))
  const hayIzq = validas.some((m) => porId.get(m.id)!.lado === 'izquierda')
  const hayDer = validas.some((m) => porId.get(m.id)!.lado === 'derecha')

  let H: Matriz3 | null = null
  let rmseM: number | null = null
  let cruzadoM: number | null = null
  const errorPorPunto: Record<string, number> = {}
  const errorPxPorPunto: Record<string, number> = {}
  let peor: Evaluacion['peor'] = null
  let errorPorPuntoCuerda: number[] = []
  let distorsion: Distorsion | null = null

  if (marcados >= MINIMO_PUNTOS) {
    const calib = estimarCalibracion(pares, paresCuerda, tam)
    H = calib?.H ?? null
    distorsion = calib?.distorsion ?? null
    if (!H) {
      advertencias.push(
        'Los puntos marcados están casi en línea, y así no se puede calcular. Marcá puntos de los dos bordes (izquierdo y derecho).',
      )
    } else {
      // todos los errores se miden sobre los puntos ya corregidos por la curvatura del lente
      const pc: Par[] = pares.map((p) => ({ px: corregir(distorsion, p.px), mundo: p.mundo }))
      const cc: ParCuerda[] = paresCuerda.map((c) => ({ px: corregir(distorsion, c.px), y: c.y }))
      const ajuste = erroresDeAjuste(H, pc)
      rmseM = rmse(ajuste)
      errorPorPuntoCuerda = erroresDeCuerdas(H, cc)
      const cv = validacionCruzada(pc, cc)
      if (cv && cv.every((e) => e !== null)) cruzadoM = rmse(cv as number[])
      validas.forEach((m, i) => {
        errorPorPunto[m.id] = cv && cv[i] !== null ? (cv[i] as number) : ajuste[i]
      })
      const Hinv = invertir(H)
      if (Hinv) {
        validas.forEach((m, i) => {
          const q = aplicar(Hinv, porId.get(m.id)!.mundo)
          if (q) errorPxPorPunto[m.id] = Math.hypot(q[0] - pc[i].px[0], q[1] - pc[i].px[1])
        })
      }
      // el peor clic se juzga en píxeles (en metros, el más lejano siempre parecería el peor)
      const enPx = Object.keys(errorPxPorPunto).length > 0
      const errores = enPx ? errorPxPorPunto : errorPorPunto
      const ids = Object.keys(errores)
      const idPeor = ids.reduce((a, b) => (errores[a] >= errores[b] ? a : b))
      peor = { id: idPeor, etiqueta: porId.get(idPeor)!.etiqueta, error_m: errorPorPunto[idPeor], error_px: errorPxPorPunto[idPeor] ?? null }
    }
  }

  // Cobertura: la homografía extrapola mal fuera de donde hay puntos.
  if (marcados >= MINIMO_PUNTOS) {
    if (maxNodo !== null && maxNodo < ultimoNodo) {
      advertencias.push(
        sinVer(ultimoNodo)
          ? `El extremo de ${ultimoNodo} m no se ve en la imagen: las medidas cerca de ese extremo no van a ser confiables.`
          : `Todavía no marcaste el extremo de ${ultimoNodo} m: más allá de los ${maxNodo} m las medidas van a ser imprecisas.`,
      )
    }
    if (minNodo !== null && minNodo > primerNodo && sinVer(primerNodo)) {
      advertencias.push(`El extremo de ${primerNodo} m no se ve en la imagen: las medidas cerca de ese extremo no van a ser confiables.`)
    }
    if (!hayIzq || !hayDer) {
      advertencias.push('Faltan puntos de uno de los bordes: marcá los dos lados de la piscina.')
    }
  }

  // Resumen por corchera, y aviso si una no coincide (probablemente se marcó sobre otra corchera).
  const cuerdas = refsCuerda
    .map((c) => {
      const errores = enCuerda.flatMap((m, i) => (m.cuerda === c.indice && errorPorPuntoCuerda[i] !== undefined ? [errorPorPuntoCuerda[i]] : []))
      const puntos = enCuerda.filter((m) => m.cuerda === c.indice).length
      return { indice: c.indice, etiqueta: c.etiqueta, puntos, error_m: errores.length > 0 ? rmse(errores) : null }
    })
    .filter((c) => c.puntos > 0)
  for (const c of cuerdas) {
    if (c.error_m !== null && c.error_m > ERROR_ACEPTABLE_M) {
      advertencias.push(
        `Los puntos de la ${c.etiqueta.toLowerCase()} quedan a ${(c.error_m * 100).toFixed(0)} cm de donde debería estar: ` +
          'revisá que estén sobre esa corchera y no sobre la de al lado.',
      )
    }
  }

  const calidad = cruzadoM ?? rmseM
  const cuantos = (n: number) => (n === 1 ? '1 punto' : `${n} puntos`)
  let nivel: Nivel
  let titulo: string
  let mensaje: string

  if (marcados === 0) {
    nivel = 'sin_puntos'
    titulo = 'Empecemos'
    mensaje = `Hay que marcar ${total} puntos. El primero: ${siguiente?.etiqueta}.`
  } else if (marcados < MINIMO_PUNTOS) {
    nivel = 'insuficiente'
    titulo = 'Faltan puntos para calcular'
    mensaje =
      faltan === 0
        ? `No alcanzan los puntos que se ven: hacen falta al menos ${MINIMO_PUNTOS} para calcular.`
        : `Con ${cuantos(MINIMO_PUNTOS - marcados)} más ya se puede calcular. Para que quede completo faltan ${cuantos(faltan)}.`
  } else if (faltan > 0) {
    nivel = 'parcial'
    titulo = 'Se puede calcular, pero no está completo'
    mensaje =
      `Marcaste ${marcados} de ${total}` +
      (omitidosIds.size > 0 ? ` (${omitidosIds.size} no se ven en la imagen)` : '') +
      `. Faltan ${cuantos(faltan)}` +
      (hastaM !== null && hastaM < ultimoNodo ? ` y llegaste hasta los ${hastaM} m: seguí hasta los ${ultimoNodo} m` : '') +
      '.'
  } else if (peor?.error_px != null && peor.error_px > ERROR_PX_ACEPTABLE) {
    // un clic corrido: eso sí se arregla marcando de nuevo
    nivel = 'revisar'
    titulo = 'Completo, pero hay que revisar'
    mensaje = `"${peor.etiqueta}" quedó a ${peor.error_px.toFixed(0)} px de donde lo ubican los demás puntos. Ampliá la imagen y volvé a marcarlo.`
  } else if (calidad !== null && calidad > ERROR_ACEPTABLE_M) {
    // los clics están bien: el error en metros viene de que lo lejano ocupa pocos píxeles (límite de la cámara)
    nivel = 'completo'
    titulo = 'Calibración completa'
    mensaje =
      `Los clics están bien (ninguno a más de ${ERROR_PX_ACEPTABLE} px), pero el error es de ${(calidad * 100).toFixed(0)} cm: ` +
      'lo lejano ocupa pocos píxeles y cada píxel vale mucho. Es un límite de la posición de la cámara, no de la calibración.'
  } else {
    nivel = 'completo'
    titulo = 'Calibración completa'
    const base =
      omitidosIds.size > 0
        ? `Marcaste los ${marcados} puntos que se ven (${omitidosIds.size} no se ven en la imagen)`
        : `Los ${total} puntos están marcados`
    mensaje =
      calidad !== null && calidad <= ERROR_BUENO_M
        ? `${base} y el error es de ${(calidad * 100).toFixed(1)} cm.`
        : `${base}. El error es de ${((calidad ?? 0) * 100).toFixed(0)} cm (aceptable).`
  }

  if (nivel !== 'completo' && nivel !== 'revisar' && siguiente && marcados > 0) {
    mensaje += ` Siguiente: ${siguiente.etiqueta}.`
  }

  return {
    total,
    marcados,
    omitidos: omitidosIds.size,
    faltan,
    minimo: MINIMO_PUNTOS,
    progreso: (marcados + omitidosIds.size) / total,
    nivel,
    titulo,
    mensaje,
    siguiente,
    pendientes,
    hastaM,
    H,
    rmse_m: rmseM,
    cruzado_m: cruzadoM,
    errorPorPunto,
    errorPxPorPunto,
    peor,
    cuerdas,
    errorPorPuntoCuerda,
    distorsion,
    advertencias,
  }
}

/** Convierte un punto de la imagen en metros dentro de la piscina (o null si no hay calibración). */
export function pxAMetros(H: Matriz3 | null, px: Punto, distorsion: Distorsion | null = null): Punto | null {
  return H ? aplicar(H, corregir(distorsion, px)) : null
}

/** Arma el archivo calibracion.json, o devuelve null si todavía no se puede calcular. */
export function aArchivoCalibracion(
  marcas: Marca[],
  ancho: number,
  alto: number,
  omitidos: string[] = [],
  g: Geometria = GEOMETRIA_POR_DEFECTO,
  marcasCuerda: MarcaCuerda[] = [],
): ArchivoCalibracion | null {
  const ev = evaluar(marcas, omitidos, g, marcasCuerda, [ancho, alto])
  if (!ev.H) return null
  const refs = new Map(puntosReferencia(g).map((r) => [r.id, r]))
  const refsCuerda = cuerdasReferencia(g)
  return {
    image_size: [ancho, alto],
    puntos: marcas
      .filter((m) => refs.has(m.id))
      .map((m) => ({ id: m.id, px: [Math.round(m.px[0]), Math.round(m.px[1])], mundo: refs.get(m.id)!.mundo })),
    cuerdas: marcasCuerda
      .filter((m) => refsCuerda[m.cuerda] !== undefined)
      .map((m) => ({ cuerda: m.cuerda, px: [Math.round(m.px[0]), Math.round(m.px[1])], y_m: refsCuerda[m.cuerda].y_m })),
    H: ev.H,
    distorsion: ev.distorsion,
    rmse_m: ev.rmse_m,
    cruzado_m: ev.cruzado_m,
    completa: ev.nivel === 'completo',
    geometria: g,
    omitidos: omitidos.filter((id) => refs.has(id)),
    creada: new Date().toISOString(),
  }
}
