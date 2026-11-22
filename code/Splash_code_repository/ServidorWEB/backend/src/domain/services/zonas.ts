// Reglas de las zonas de análisis. Son las mismas que aplica el servidor de IA (ServidorIA/ProcesamientoServidor/src/zones.py, trayectoria.py).
import type { Zona } from '../entities/calibracion.entity'

export const MAX_ZONAS = 20
export const MAX_PUNTOS_POR_ZONA = 100
export const MAX_LARGO_NOMBRE_ZONA = 40

const PREFIJOS_CARRIL = ['lane', 'carril']

export function esCarril(nombre: string): boolean {
  const n = nombre.toLowerCase()
  return PREFIJOS_CARRIL.some((p) => n.startsWith(p))
}

/** 'lane5' o 'carril_5' -> 5; null si el nombre no termina en número. Igual que numero_de_carril() de trayectoria.py. */
export function numeroDeCarril(nombre: string): number | null {
  const m = /(\d+)\D*$/.exec(nombre)
  return m ? Number(m[1]) : null
}

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Revisa unas zonas que llegan de afuera. Devuelve la lista de problemas (vacía si están bien).
 *
 * @param tam       tamaño de la imagen de la calibración: los puntos tienen que caer dentro.
 * @param carriles  carriles que se analizan (los de la geometría de la calibración): un carril con otro número no
 *                  podría enviar posiciones, porque el backend las rechazaría.
 */
export function problemasDeZonas(zonas: unknown, tam: [number, number], carriles: number[]): string[] {
  if (!Array.isArray(zonas)) return ['"zonas" tiene que ser una lista.']
  if (zonas.length > MAX_ZONAS) return [`Hay ${zonas.length} zonas; el máximo es ${MAX_ZONAS}.`]

  const errores: string[] = []
  const vistos = new Set<string>()
  const [ancho, alto] = tam
  zonas.forEach((z: { name?: unknown; polygon?: unknown } | null, i) => {
    const nombre = typeof z?.name === 'string' ? z.name.trim() : ''
    const quien = nombre ? `La zona "${nombre}"` : `La zona ${i + 1}`
    if (!nombre || nombre.length > MAX_LARGO_NOMBRE_ZONA) {
      errores.push(`${quien} necesita un nombre de 1 a ${MAX_LARGO_NOMBRE_ZONA} letras.`)
    } else if (vistos.has(nombre.toLowerCase())) {
      errores.push(`Hay dos zonas llamadas "${nombre}".`)
    }
    vistos.add(nombre.toLowerCase())

    const poligono = z?.polygon
    if (!Array.isArray(poligono) || poligono.length < 3 || poligono.length > MAX_PUNTOS_POR_ZONA) {
      errores.push(`${quien} necesita un polígono de 3 a ${MAX_PUNTOS_POR_ZONA} puntos.`)
    } else if (!poligono.every((p) => Array.isArray(p) && p.length === 2 && esNumero(p[0]) && esNumero(p[1]))) {
      errores.push(`${quien} tiene un punto que no es [x, y] numérico.`)
    } else if (!poligono.every(([x, y]: [number, number]) => x >= 0 && y >= 0 && x <= ancho && y <= alto)) {
      errores.push(`${quien} tiene puntos fuera de la imagen (${ancho} × ${alto} px).`)
    }

    if (nombre && esCarril(nombre)) {
      const n = numeroDeCarril(nombre)
      if (n === null) errores.push(`${quien} es un carril pero su nombre no dice cuál (por ejemplo lane5).`)
      else if (!carriles.includes(n)) errores.push(`${quien} es el carril ${n}, pero se analizan los carriles ${carriles.join(', ')}.`)
    }
  })
  return errores
}

/** Copia limpia: nombres sin espacios de más y coordenadas redondeadas a décimas de píxel. */
export function normalizarZonas(zonas: Zona[]): Zona[] {
  const r = (v: number) => Math.round(v * 10) / 10
  return zonas.map((z) => ({ name: z.name.trim(), polygon: z.polygon.map(([x, y]) => [r(x), r(y)] as [number, number]) }))
}
