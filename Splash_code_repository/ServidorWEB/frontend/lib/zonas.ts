// Zonas de análisis: los polígonos que el entrenador marca sobre un frame de la piscina.
// El formato del archivo es el MISMO que usan ServidorIA/ProcesamientoServidor/src/zones.py y define_zones.py:
//   { "image_size": [ancho, alto], "zones": [{ "name": "lane4", "polygon": [[x, y], ...] }, ...] }
// Las coordenadas son píxeles del frame sobre el que se dibujó.

export type Punto = [number, number]
export type Zona = { name: string; polygon: Punto[] }
export type ArchivoZonas = { image_size: [number, number] | null; zones: Zona[] }

const PREFIJOS_CARRIL = ['lane', 'carril']

export function esCarril(nombre: string): boolean {
  const n = nombre.toLowerCase()
  return PREFIJOS_CARRIL.some((p) => n.startsWith(p))
}

export type Recorte = {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Qué parte del frame queda (menos = más ahorro para el modelo). */
  fraccionArea: number
}

/**
 * Rectángulo que contiene los carriles (o todas las zonas si ninguna se llama "lane..." o "carril..."),
 * más un margen. Es la misma cuenta que ServidorIA/ProcesamientoServidor/src/roi.py.
 */
export function calcularRecorte(zonas: Zona[], ancho: number, alto: number, margen = 0.03): Recorte | null {
  const validas = zonas.filter((z) => z.polygon.length >= 3)
  const carriles = validas.filter((z) => esCarril(z.name))
  const base = carriles.length > 0 ? carriles : validas
  if (base.length === 0 || ancho <= 0 || alto <= 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const z of base) {
    for (const [x, y] of z.polygon) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  const mx = (maxX - minX) * margen
  const my = (maxY - minY) * margen
  const x1 = Math.max(0, Math.floor(minX - mx))
  const y1 = Math.max(0, Math.floor(minY - my))
  const x2 = Math.min(ancho, Math.ceil(maxX + mx))
  const y2 = Math.min(alto, Math.ceil(maxY + my))
  return { x1, y1, x2, y2, fraccionArea: ((x2 - x1) * (y2 - y1)) / (ancho * alto) }
}

/** Texto JSON listo para guardar como zones.json (coordenadas enteras). */
export function aArchivo(zonas: Zona[], ancho: number, alto: number): string {
  const archivo: ArchivoZonas = {
    image_size: [ancho, alto],
    zones: zonas.map((z) => ({
      name: z.name,
      polygon: z.polygon.map(([x, y]) => [Math.round(x), Math.round(y)] as Punto),
    })),
  }
  return JSON.stringify(archivo, null, 2)
}

/** Lee un zones.json y valida su forma. Lanza un Error con un mensaje claro si no sirve. */
export function desdeArchivo(texto: string): ArchivoZonas {
  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  const d = datos as { image_size?: unknown; zones?: unknown }
  if (!d || !Array.isArray(d.zones) || d.zones.length === 0) {
    throw new Error('El archivo no tiene la lista "zones" o está vacía.')
  }
  const zones: Zona[] = d.zones.map((z: { name?: unknown; polygon?: unknown }, i: number) => {
    if (typeof z?.name !== 'string' || !Array.isArray(z.polygon) || z.polygon.length < 3) {
      throw new Error(`La zona ${i + 1} necesita "name" y un "polygon" de al menos 3 puntos.`)
    }
    const polygon = z.polygon.map((p: unknown) => {
      if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
        throw new Error(`La zona "${z.name}" tiene un punto que no es [x, y].`)
      }
      return [Number(p[0]), Number(p[1])] as Punto
    })
    return { name: z.name, polygon }
  })
  const tam = Array.isArray(d.image_size) && d.image_size.length === 2 ? d.image_size.map(Number) : null
  const image_size = tam && tam.every((n) => Number.isFinite(n) && n > 0) ? ([tam[0], tam[1]] as [number, number]) : null
  return { image_size, zones }
}

/** Reescala los polígonos de una imagen de (deAncho x deAlto) a otra de (aAncho x aAlto). */
export function escalar(zonas: Zona[], deAncho: number, deAlto: number, aAncho: number, aAlto: number): Zona[] {
  const sx = aAncho / deAncho
  const sy = aAlto / deAlto
  return zonas.map((z) => ({ name: z.name, polygon: z.polygon.map(([x, y]) => [x * sx, y * sy] as Punto) }))
}

/** La imagen de un canvas como JPEG en base64 (lo que guarda el backend con la calibración). */
export function aJpeg(c: HTMLCanvasElement, calidad = 0.88): string {
  return c.toDataURL('image/jpeg', calidad)
}
