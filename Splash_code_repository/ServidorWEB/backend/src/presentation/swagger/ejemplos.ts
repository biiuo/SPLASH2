// Ejemplos que aparecen cargados en Swagger para probar los endpoints con un clic.
// Se arman con el propio dominio (no son números copiados a mano), así nunca quedan desactualizados.
import { Configuracion } from '../../domain/entities/configuracion.entity'
import { geometriaDe, puntosReferencia } from '../../domain/services/evaluador-calibracion'
import { aplicar, type Matriz3 } from '../../domain/services/homografia'

/** Una "cámara" inventada, de metros de la piscina a píxeles, con perspectiva. Solo sirve para generar marcas de ejemplo. */
const CAMARA_DE_EJEMPLO: Matriz3 = [
  [60, -8, 120],
  [6, 35, 200],
  [0.0004, 0.0035, 1],
]

const redondear = (n: number) => Math.round(n * 10) / 10

/** Las marcas que pondría alguien que clickea justo sobre cada punto de referencia. */
export function marcasDeEjemplo(cantidad?: number) {
  const marcas = puntosReferencia().map((p) => {
    const [x, y] = aplicar(CAMARA_DE_EJEMPLO, p.mundo)!
    return { id: p.id, px: [redondear(x), redondear(y)] }
  })
  return cantidad === undefined ? marcas : marcas.slice(0, cantidad)
}

/** Un nadador del metro 3 al 12 por el carril 5 (1,25 m/s, 5 posiciones por segundo), en píxeles de la cámara de ejemplo. */
export function trayectoriaDeEjemplo() {
  const t0 = 1_800_000_000_000
  const yCarril5 = 2.34
  const muestras: Array<{ carril: number; identidad: number; t: number; px: number[] }> = []
  for (let i = 0; i <= 36; i++) {
    const [x, y] = aplicar(CAMARA_DE_EJEMPLO, [3 + 1.25 * (i / 4), yCarril5])!
    muestras.push({ carril: 5, identidad: 1, t: t0 + i * 200, px: [redondear(x), redondear(y)] })
  }
  return { muestras }
}

/** Los carriles 4, 5 y 6 como zonas (polígonos en píxeles de la cámara de ejemplo, recortados a una imagen de 1280 × 960). */
export function zonasDeEjemplo() {
  const { largo_m, ancho_carril_m } = geometriaDe(Configuracion.porDefecto().piscina)
  const dentro = ([x, y]: [number, number]) => [redondear(Math.min(Math.max(x, 0), 1280)), redondear(Math.min(Math.max(y, 0), 960))]
  return [4, 5, 6].map((carril, i) => {
    const y1 = i * ancho_carril_m
    const y2 = (i + 1) * ancho_carril_m
    const esquinas: [number, number][] = [[0, y1], [largo_m, y1], [largo_m, y2], [0, y2]]
    return { name: `lane${carril}`, polygon: esquinas.map((p) => dentro(aplicar(CAMARA_DE_EJEMPLO, p)!)) }
  })
}

export const EJEMPLOS = {
  zonas: zonasDeEjemplo(),
  iniciarSesion: { modo: 'servidor', carriles: [{ carril: 4 }, { carril: 5 }] },
  trayectoria: trayectoriaDeEjemplo(),
  trayectoriaMalFormada: { muestras: [{ carril: 1, identidad: 1, t: 1_800_000_000_000, px: [100, 200] }] },

  configuracion: Configuracion.porDefecto().aJSON(),
  configuracionInvalida: { camara: { altura_m: -3 } },

  evaluarSinMarcas: { marcas: [] },
  evaluarParcial: { marcas: marcasDeEjemplo(6), omitidos: [] },
  evaluarCompleta: { marcas: marcasDeEjemplo(), omitidos: [], image_size: [1280, 960] },
  guardarCalibracion: { image_size: [1280, 960], marcas: marcasDeEjemplo(), omitidos: [] },
}
