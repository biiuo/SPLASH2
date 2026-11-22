import type { ArchivoCalibracion, Geometria, Llegada, Zona } from '../../domain/entities/calibracion.entity'
import type { CuerdaRef, Evaluacion, Marca, MarcaCuerda, PuntoRef } from '../../domain/services/evaluador-calibracion'
import type { Matriz3 } from '../../domain/services/homografia'

/** Un punto marcado en la imagen, por quien calibra. */
export type MarcaDto = Marca

export type EvaluarCalibracionEntrada = {
  marcas: MarcaDto[]
  /** Puntos que no se ven en la imagen. */
  omitidos?: string[]
  /** Puntos sobre las corcheras (en cualquier lugar de su largo). Afirman la calibración, sobre todo lejos de los nodos. */
  cuerdas?: MarcaCuerda[]
  /** Tamaño de la imagen; si viene, la respuesta incluye el archivo de calibración listo para guardar. */
  image_size?: [number, number]
}

export type GuardarCalibracionEntrada = {
  image_size: [number, number]
  marcas: MarcaDto[]
  omitidos?: string[]
  cuerdas?: MarcaCuerda[]
  /** Para reconocer la posición de la cámara en el historial. */
  nombre?: string | null
  /** Zonas de análisis dibujadas sobre la misma imagen; también se pueden agregar después. */
  zonas?: Zona[] | null
  /** Dónde se cuenta la llegada a cada pared si la cámara no la ve. */
  llegada?: Llegada | null
  /** La imagen sobre la que se calibró: "data:image/jpeg;base64,...". */
  imagen?: string | null
}

/** Lo que se puede cambiar de una calibración ya guardada. Lo que no venga queda igual; null lo borra. */
export type ActualizarCalibracionEntrada = {
  nombre?: string | null
  zonas?: Zona[] | null
  llegada?: Llegada | null
  /** La imagen sobre la que se calibró: "data:image/jpeg;base64,...". Tiene que tener el tamaño de la calibración. */
  imagen?: string | null
}

/** La evaluación del dominio más la inversa de la homografía, que la interfaz usa para dibujar sobre la imagen. */
export type EvaluacionDto = Evaluacion & { Hinv: Matriz3 | null }

export type ResultadoEvaluacionDto = {
  evaluacion: EvaluacionDto
  archivo: ArchivoCalibracion | null
}

export type PuntosReferenciaDto = {
  geometria: Geometria
  /** Ancho de los carriles analizados, en metros. */
  anchoTotal_m: number
  puntos: PuntoRef[]
  /** Las corcheras de los carriles analizados, para marcar puntos sobre ellas. */
  cuerdas: CuerdaRef[]
  /** Hasta cuántos metros de error un punto se considera bien puesto (bueno) o aceptable. */
  umbrales_error_m: { bueno: number; aceptable: number }
  /** Lo mismo, en píxeles: así se juzga cada clic. */
  umbrales_error_px: { bueno: number; aceptable: number }
}

export type CalibracionGuardadaDto = {
  id: string
  nombre: string | null
  /** Nombres de las zonas guardadas con la calibración. */
  zonas: string[]
  llegada: Llegada | null
  completa: boolean
  rmse_m: number | null
  cruzado_m: number | null
}
