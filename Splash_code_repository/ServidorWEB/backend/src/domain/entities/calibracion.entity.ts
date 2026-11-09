// Una calibración: la matriz que convierte píxeles en metros y los datos con los que se calculó.
import type { Distorsion, Matriz3, Punto } from '../services/homografia'

/** Lo que el evaluador necesita saber de la piscina. */
export type Geometria = {
  largo_m: number
  ancho_carril_m: number
  n_carriles_piscina: number
  /** Primer carril analizado. */
  primer_carril: number
  /** Cuántos carriles se analizan. */
  n_carriles: number
  nodos_m: number[]
}

/** Un punto marcado: dónde está en la imagen (píxeles) y dónde está en la piscina (metros). */
export type PuntoCalibrado = { id: string; px: Punto; mundo: Punto }

/** Un punto sobre una corchera: se sabe en qué corchera está (y_m), no a qué distancia de la pared. */
export type PuntoCuerda = { cuerda: number; px: Punto; y_m: number }

export type ArchivoCalibracion = {
  image_size: [number, number]
  /** Puntos marcados: píxel y posición real. */
  puntos: PuntoCalibrado[]
  /** Puntos marcados sobre las corcheras (en cualquier lugar de su largo): píxel y la "y" de su corchera. */
  cuerdas: PuntoCuerda[]
  /** Homografía píxeles (ya corregidos por la curvatura del lente) -> metros. */
  H: Matriz3
  /** Curvatura del lente, o null si no se corrige. Para convertir: metros = H · corregir(distorsion, px). */
  distorsion: Distorsion | null
  rmse_m: number | null
  cruzado_m: number | null
  completa: boolean
  /** Medidas de la piscina con las que se calculó (para poder rehacer o auditar la calibración). */
  geometria: Geometria
  /** Puntos que se marcaron como "no se ve en la imagen". */
  omitidos: string[]
  creada: string
}

/**
 * Una zona de análisis: un polígono en píxeles de la imagen de la calibración (mismo formato que zones.json).
 * Las que se llaman lane<N> o carril<N> son los carriles: definen el recorte que ve el modelo y el carril de cada nadador.
 */
export type Zona = { name: string; polygon: Punto[] }

/** Las zonas en el formato de zones.json, que es lo que lee el servidor de IA. */
export type ArchivoZonas = { image_size: [number, number]; zones: Zona[] }

/**
 * Una calibración guardada en el sistema. Representa una posición de la cámara: si la cámara se mueve, cambian a la
 * vez la homografía y las zonas, así que se guardan juntas y se activan juntas.
 */
export type CalibracionGuardada = ArchivoCalibracion & {
  id: string
  nombre: string | null
  zonas: Zona[] | null
  llegada: Llegada | null
}

/**
 * Dónde se cuenta la llegada a cada pared, en metros desde la pared de salida, cuando la cámara no ve hasta la pared
 * (la de salida tapada por la baranda, por ejemplo). null en un lado = se ve la pared y se cuenta junto a ella.
 */
export type Llegada = { inicio_m: number | null; fin_m: number | null }
