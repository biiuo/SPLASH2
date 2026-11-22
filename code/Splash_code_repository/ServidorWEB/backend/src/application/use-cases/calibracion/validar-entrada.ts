import type { Geometria, Llegada, Zona } from '../../../domain/entities/calibracion.entity'
import { MAX_PUNTOS_CUERDA, type Marca, type MarcaCuerda } from '../../../domain/services/evaluador-calibracion'
import { normalizarZonas, problemasDeZonas } from '../../../domain/services/zonas'
import { ValidacionException } from '../../exceptions/aplicacion.exceptions'

export const MAX_LARGO_NOMBRE = 80

/** undefined = no vino (no tocar); null o texto vacío = sin nombre. */
export const MAX_IMAGEN_BYTES = 6 * 1024 * 1024
const PREFIJO_JPEG = 'data:image/jpeg;base64,'

/**
 * La imagen sobre la que se calibró, como data URL JPEG ("data:image/jpeg;base64,..."). undefined = no vino;
 * null = borrarla. Se comprueba que de verdad sea un JPEG y que no sea demasiado grande.
 */
export function validarImagen(imagen: unknown): Uint8Array | null | undefined {
  if (imagen === undefined) return undefined
  if (imagen === null) return null
  if (typeof imagen !== 'string' || !imagen.startsWith(PREFIJO_JPEG)) {
    throw new ValidacionException('imagen tiene que ser una imagen JPEG en base64 ("data:image/jpeg;base64,...").')
  }
  const bytes = Buffer.from(imagen.slice(PREFIJO_JPEG.length), 'base64')
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new ValidacionException('imagen no es un JPEG válido.')
  if (bytes.length > MAX_IMAGEN_BYTES) {
    throw new ValidacionException(`La imagen es demasiado grande (máximo ${MAX_IMAGEN_BYTES / 1024 / 1024} MB).`)
  }
  return new Uint8Array(bytes)
}

export function validarNombre(nombre: unknown): string | null | undefined {
  if (nombre === undefined) return undefined
  if (nombre === null) return null
  if (typeof nombre !== 'string') throw new ValidacionException('"nombre" tiene que ser un texto.')
  const limpio = nombre.trim()
  if (limpio.length > MAX_LARGO_NOMBRE) throw new ValidacionException(`El nombre puede tener hasta ${MAX_LARGO_NOMBRE} letras.`)
  return limpio || null
}

/** undefined = no vino (no tocar); null o lista vacía = sin zonas. Los carriles tienen que ser los que se analizan. */
export function validarZonas(zonas: unknown, tam: [number, number], geometria: Geometria): Zona[] | null | undefined {
  if (zonas === undefined) return undefined
  if (zonas === null || (Array.isArray(zonas) && zonas.length === 0)) return null
  const carriles = Array.from({ length: geometria.n_carriles }, (_, i) => geometria.primer_carril + i)
  const errores = problemasDeZonas(zonas, tam, carriles)
  if (errores.length > 0) throw new ValidacionException('Las zonas no son válidas.', errores)
  return normalizarZonas(zonas as Zona[])
}

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Valida las marcas y los puntos omitidos que llegan de afuera. Lanza ValidacionException con el detalle. */
export function validarMarcas(marcas: unknown, omitidos: unknown): { marcas: Marca[]; omitidos: string[] } {
  const errores: string[] = []
  if (!Array.isArray(marcas)) errores.push('"marcas" tiene que ser una lista.')
  else if (!marcas.every((m) => m && typeof m.id === 'string' && Array.isArray(m.px) && m.px.length === 2 && m.px.every(esNumero))) {
    errores.push('Cada marca necesita un "id" y un "px" con [x, y] numéricos.')
  }
  if (omitidos !== undefined && !(Array.isArray(omitidos) && omitidos.every((o) => typeof o === 'string'))) {
    errores.push('"omitidos" tiene que ser una lista de ids.')
  }
  if (errores.length > 0) throw new ValidacionException('Los datos de la calibración no son válidos.', errores)
  return { marcas: marcas as Marca[], omitidos: (omitidos as string[] | undefined) ?? [] }
}

/**
 * undefined = no vino; null = en las paredes. Cada lado tiene que quedar entre su pared y la marca siguiente
 * (dejando medio metro), porque si no se confundiría con el cruce de esa marca.
 */
export function validarLlegada(llegada: unknown, g: Geometria): Llegada | null | undefined {
  if (llegada === undefined) return undefined
  if (llegada === null) return null
  const l = llegada as { inicio_m?: unknown; fin_m?: unknown }
  if (typeof l !== 'object' || Array.isArray(l)) throw new ValidacionException('"llegada" tiene que ser { inicio_m, fin_m }.')
  const nodos = [...g.nodos_m].sort((a, b) => a - b)
  const [primero, segundo] = [nodos[0], nodos[1]]
  const [penultimo, ultimo] = [nodos[nodos.length - 2], nodos[nodos.length - 1]]
  const errores: string[] = []
  const lado = (v: unknown, min: number, max: number, nombre: string): number | null => {
    if (v === undefined || v === null) return null
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      errores.push(`La llegada a la ${nombre} tiene que estar entre ${min} y ${max} m.`)
      return null
    }
    return Math.round(v * 100) / 100
  }
  const r = {
    inicio_m: lado(l.inicio_m, primero, segundo - 0.5, 'pared de salida'),
    fin_m: lado(l.fin_m, penultimo + 0.5, ultimo, 'pared del fondo'),
  }
  if (errores.length > 0) throw new ValidacionException('La línea de llegada no es válida.', errores)
  return r.inicio_m === null && r.fin_m === null ? null : r
}

/** Valida los puntos sobre corcheras. `cuerda` tiene que ser una de las de los carriles analizados (0..n). */
export function validarCuerdas(cuerdas: unknown, geometria: Geometria): MarcaCuerda[] {
  if (cuerdas === undefined || cuerdas === null) return []
  if (!Array.isArray(cuerdas)) throw new ValidacionException('"cuerdas" tiene que ser una lista.')
  if (cuerdas.length > MAX_PUNTOS_CUERDA) {
    throw new ValidacionException(`Hay ${cuerdas.length} puntos sobre corcheras; el máximo es ${MAX_PUNTOS_CUERDA}.`)
  }
  const ok = cuerdas.every(
    (c) =>
      c &&
      Number.isInteger(c.cuerda) &&
      c.cuerda >= 0 &&
      c.cuerda <= geometria.n_carriles &&
      Array.isArray(c.px) &&
      c.px.length === 2 &&
      c.px.every(esNumero),
  )
  if (!ok) {
    throw new ValidacionException('Los puntos sobre corcheras no son válidos.', [
      `Cada uno necesita "cuerda" (de 0 a ${geometria.n_carriles}) y "px" con [x, y] numéricos.`,
    ])
  }
  return cuerdas as MarcaCuerda[]
}

export function validarTamanoImagen(tam: unknown): [number, number] {
  if (!Array.isArray(tam) || tam.length !== 2 || tam.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new ValidacionException('Falta "image_size": [ancho, alto] en píxeles enteros.')
  }
  return [tam[0], tam[1]]
}
