// El último frame que mandó el servidor de IA desde la cámara, para calibrar y dibujar zonas sin subir una foto a mano.
// La aplicación solo guarda y lee; dónde vive (memoria, Redis, disco...) es infraestructura.

export interface FrameCamara {
  /** JPEG tal como lo mandó el servidor de IA. */
  jpeg: Uint8Array
  /** Cuándo llegó al backend (ms desde 1970). */
  recibido_ms: number
}

export interface AlmacenFrameCamara {
  guardar(jpeg: Uint8Array): void
  /** El último frame, o null si todavía no llegó ninguno. */
  ultimo(): FrameCamara | null
}

export const ALMACEN_FRAME_CAMARA = Symbol('AlmacenFrameCamara')
