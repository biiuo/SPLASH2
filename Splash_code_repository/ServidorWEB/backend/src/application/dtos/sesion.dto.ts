import type { ModoProceso } from '../../domain/entities/sesion.entity'
import type { EventoDetectado, TramoDetectado } from '../../domain/services/motor-eventos'

export type IniciarSesionEntrada = {
  /** Si no se manda, se usa el de la configuración (Procesamiento), o el del .env. */
  modo?: ModoProceso
  /**
   * Los carriles que toma la sesión. Entrenador: uno o más, cada uno con un nadador de su grupo o sin nadador (reservado
   * para alguien que llega después). Nadador (sesión libre): uno solo, que queda a su nombre.
   */
  carriles?: { carril: number; nadador_id?: string | null }[]
}

export type UnirseSesionEntrada = { carril: number }

/** Una posición de un nadador, tal como la mide el celular o el servidor de IA. */
export type MuestraEntrada = {
  /** Carril (el número real de la piscina). */
  carril: number
  /** Identidad estable del nadador en ese carril. */
  identidad: number
  /** Instante de captura del frame, en milisegundos desde 1970. */
  t: number
  /** Posición del nadador en la imagen, en píxeles. */
  px: [number, number]
  /** true si la posición se mantuvo o se extrapoló porque no se detectó al nadador. */
  estimada?: boolean
}

export type RecibirTrayectoriasEntrada = {
  muestras: MuestraEntrada[]
}

export type RecibirTrayectoriasSalida = {
  recibidas: number
  /** Las que se convirtieron a metros y entraron al motor. */
  procesadas: number
  /** Las que cayeron fuera de la piscina (no se pueden usar). */
  descartadas: number
  eventos: EventoDetectado[]
  tramos: TramoDetectado[]
}
