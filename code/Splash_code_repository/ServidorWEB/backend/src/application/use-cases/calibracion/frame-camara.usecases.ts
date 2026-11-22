import { NoEncontradoException, ValidacionException } from '../../exceptions/aplicacion.exceptions'
import type { AlmacenFrameCamara } from '../../ports/frame-camara.ports'
import { validarImagen } from './validar-entrada'

/** Un frame más viejo que esto se considera que la cámara no está llegando (el servidor de IA manda uno cada pocos segundos). */
export const FRAME_VIGENTE_MS = 30_000

/** El servidor de IA deja el último frame de la cámara. */
export class PublicarFrameCamaraUseCase {
  constructor(private readonly almacen: AlmacenFrameCamara) {}

  execute(entrada: { imagen?: unknown }): { guardado: true } {
    const jpeg = validarImagen(entrada?.imagen)
    if (!jpeg) throw new ValidacionException('Falta "imagen": un JPEG en base64 ("data:image/jpeg;base64,...").')
    this.almacen.guardar(jpeg)
    return { guardado: true }
  }
}

/** La interfaz pide el último frame de la cámara para calibrar o dibujar las zonas sobre él. */
export class ObtenerFrameCamaraUseCase {
  constructor(private readonly almacen: AlmacenFrameCamara) {}

  execute(): { jpeg: Uint8Array; edad_ms: number } {
    const f = this.almacen.ultimo()
    if (!f) {
      throw new NoEncontradoException(
        'Todavía no llegó ningún frame de la cámara. Revisá que el servidor de IA esté corriendo y conectado a la cámara.',
      )
    }
    const edad_ms = Date.now() - f.recibido_ms
    if (edad_ms > FRAME_VIGENTE_MS) {
      throw new NoEncontradoException(
        `El último frame de la cámara es de hace ${Math.round(edad_ms / 1000)} s: el servidor de IA dejó de mandar. Revisá la cámara y el servidor de IA.`,
      )
    }
    return { jpeg: f.jpeg, edad_ms }
  }
}
