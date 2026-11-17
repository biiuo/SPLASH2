// Detección con YOLOv5 en el navegador: el frame se recorta a los carriles (como hace el servidor), se lleva a un
// cuadrado de TAM x TAM sin deformarlo (letterbox) y las cajas vuelven a coordenadas del frame completo.
import type { Ort, Sesion } from './ort'

/** [x1, y1, x2, y2, confianza, clase] en píxeles del frame. */
export type Caja = [number, number, number, number, number, number]
export type Rect = { x1: number; y1: number; x2: number; y2: number }

/** La clase "nadador" del modelo entrenado (la misma que --swimmer-class del servidor). */
export const CLASE_NADADOR = 1

export class Detector {
  private readonly lienzo: OffscreenCanvas | HTMLCanvasElement
  private readonly ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

  constructor(
    private readonly ort: Ort,
    private readonly sesion: Sesion,
    readonly tam = 640,
    private readonly confianza = 0.25,
  ) {
    this.lienzo = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(tam, tam) : Object.assign(document.createElement('canvas'), { width: tam, height: tam })
    const ctx = this.lienzo.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('El navegador no permite dibujar en un canvas.')
    this.ctx = ctx as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
  }

  /** Nadadores detectados dentro de `recorte` (o en todo el frame si es null). */
  async detectar(imagen: CanvasImageSource, ancho: number, alto: number, recorte: Rect | null): Promise<Caja[]> {
    const r = recorte ?? { x1: 0, y1: 0, x2: ancho, y2: alto }
    const w = r.x2 - r.x1
    const h = r.y2 - r.y1
    const S = this.tam
    const escala = Math.min(S / w, S / h)
    const dw = Math.round(w * escala)
    const dh = Math.round(h * escala)
    const ox = (S - dw) / 2
    const oy = (S - dh) / 2

    this.ctx.fillStyle = 'rgb(114,114,114)'
    this.ctx.fillRect(0, 0, S, S)
    this.ctx.drawImage(imagen, r.x1, r.y1, w, h, ox, oy, dw, dh)
    const px = this.ctx.getImageData(0, 0, S, S).data
    const datos = new Float32Array(3 * S * S)
    for (let i = 0; i < S * S; i++) {
      datos[i] = px[i * 4] / 255
      datos[S * S + i] = px[i * 4 + 1] / 255
      datos[2 * S * S + i] = px[i * 4 + 2] / 255
    }

    const entrada = new this.ort.Tensor('float32', datos, [1, 3, S, S])
    const salida = await this.sesion.run({ [this.sesion.inputNames[0]]: entrada })
    const cajas = decodificar(salida[this.sesion.outputNames[0]], this.confianza)

    // del cuadrado del modelo al frame completo
    return cajas
      .filter((c) => c[5] === CLASE_NADADOR)
      .map(([x1, y1, x2, y2, conf, cls]): Caja => [
        (x1 - ox) / escala + r.x1,
        (y1 - oy) / escala + r.y1,
        (x2 - ox) / escala + r.x1,
        (y2 - oy) / escala + r.y1,
        conf,
        cls,
      ])
  }
}

function iou(a: Caja, b: Caja): number {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2])
  const y2 = Math.min(a[3], b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
  return union > 0 ? inter / union : 0
}

/** Salida de YOLOv5 [1, N, 5 + clases] = cx, cy, w, h, objeto, clases... → cajas con supresión de no máximos. */
export function decodificar(salida: { dims: readonly number[]; data: Float32Array }, confianza: number): Caja[] {
  const [, n, columnas] = salida.dims
  const nc = columnas - 5
  const d = salida.data
  const cajas: Caja[] = []
  for (let i = 0; i < n; i++) {
    const o = i * columnas
    const objeto = d[o + 4]
    if (objeto < confianza) continue
    let clase = 0
    let mejor = 0
    for (let c = 0; c < nc; c++) {
      if (d[o + 5 + c] > mejor) {
        mejor = d[o + 5 + c]
        clase = c
      }
    }
    const conf = objeto * mejor
    if (conf < confianza) continue
    const [cx, cy, w, h] = [d[o], d[o + 1], d[o + 2], d[o + 3]]
    cajas.push([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, conf, clase])
  }
  cajas.sort((a, b) => b[4] - a[4])
  const quedan: Caja[] = []
  for (const c of cajas) if (quedan.every((k) => k[5] !== c[5] || iou(k, c) < 0.45)) quedan.push(c)
  return quedan
}
