import type { AlmacenFrameCamara, FrameCamara } from '../../application/ports/frame-camara.ports'

/** Guarda solo el último frame en la memoria de este proceso (no hace falta nada más: se reemplaza cada pocos segundos). */
export class FrameCamaraEnMemoria implements AlmacenFrameCamara {
  private actual: FrameCamara | null = null

  guardar(jpeg: Uint8Array): void {
    this.actual = { jpeg, recibido_ms: Date.now() }
  }

  ultimo(): FrameCamara | null {
    return this.actual
  }
}
