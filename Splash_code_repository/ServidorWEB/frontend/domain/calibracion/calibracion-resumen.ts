/** Una calibración del historial. Cada una es una posición de la cámara, con sus zonas. */
export type CalibracionResumen = {
  id: string
  nombre: string | null
  /** Tamaño de la imagen sobre la que se calibró: las zonas se guardan en esos píxeles. */
  image_size: [number, number]
  creada: string
  completa: boolean
  rmse_m: number | null
  cruzado_m: number | null
  n_puntos: number
  /** Nombres de las zonas guardadas (vacío si todavía no tiene). */
  zonas: string[]
  activa: boolean
  /** Si se guardó la imagen sobre la que se calibró. */
  tiene_imagen: boolean
}
