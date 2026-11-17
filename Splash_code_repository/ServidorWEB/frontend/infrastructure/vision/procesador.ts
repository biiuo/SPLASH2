// Procesamiento en el celular: el mismo trabajo que ServidorIA/ProcesamientoServidor, pero en el navegador.
//
//   servidor_stream.py ──WebSocket (JPEG + hora de captura)──▶ recorte a los 3 carriles ─▶ YOLOv5 (ONNX)
//        ─▶ un nadador por carril, 3 posiciones por segundo ─▶ POST /api/sesiones/{id}/trayectorias
//
// Manda lo MISMO que el servidor: píxeles de la imagen de la calibración, carril, identidad y hora de captura en ms.
// Siempre se procesa el frame más reciente: si el celular va lento, se saltan frames y el retraso no crece. La hora de
// cada posición es la de captura del frame, así que saltar frames no cambia las medidas.
import { ErrorApi, api } from '../api'
import { calcularRecorte, escalar, type Zona } from '../zonas'
import { TrayectoriasPorCarril, type Muestra } from './carriles'
import { Detector, type Caja, type Rect } from './detector'
import { cargarOrt, crearSesion } from './ort'

export type FaseProceso = 'cargando' | 'conectando' | 'procesando' | 'error' | 'terminada' | 'detenido'

export type EstadoProceso = {
  fase: FaseProceso
  mensaje: string
  /** Dónde corre el modelo: webgpu o wasm. */
  backend: string | null
  fps: number
  enviadas: number
  pendientes: number
  eventos: number
  tramos: number
  carriles: number[]
}

export type VistaFrame = { imagen: ImageBitmap; cajas: Caja[]; recorte: Rect | null; zonas: Zona[] }

export type OpcionesProceso = {
  sesionId: string
  calibracionId: string
  /** ws://IP-DEL-SERVIDOR:8765 (servidor_stream.py). */
  urlStream: string
  /** Dirección del modelo .onnx (por defecto /modelo/best_640.onnx, en public/ de la web). */
  urlModelo: string
  alCambiar: (estado: EstadoProceso) => void
  /** Para dibujar la vista previa. La imagen se libera apenas vuelve la llamada. */
  alFrame?: (vista: VistaFrame) => void
}

type Mensaje = { timestamp: number; frame_id: number; frame: string; ancho?: number; alto?: number }

const ENVIAR_CADA_MS = 1000
const MAX_POR_ENVIO = 500
const MAX_PENDIENTES = 20_000

export class ProcesadorCelular {
  private estado: EstadoProceso = {
    fase: 'cargando', mensaje: 'Cargando el modelo…', backend: null, fps: 0, enviadas: 0, pendientes: 0, eventos: 0, tramos: 0, carriles: [],
  }
  private activo = false
  private ws: WebSocket | null = null
  private ultimo: Mensaje | null = null
  private procesado = -1
  private pendientes: Muestra[] = []
  private enviando = false
  private temporizador: number | null = null
  private detector: Detector | null = null
  private zonasCalibracion: { zonas: Zona[]; ancho: number; alto: number } | null = null
  private porTamano: { clave: string; zonas: Zona[]; recorte: Rect | null; trayectorias: TrayectoriasPorCarril } | null = null
  private tiempos: number[] = []

  constructor(private readonly o: OpcionesProceso) {}

  async iniciar(): Promise<void> {
    this.activo = true
    try {
      this.cambiar({ fase: 'cargando', mensaje: 'Bajando las zonas de la calibración…' })
      const archivo = await api.zonasDeCalibracion(this.o.calibracionId)
      if (!archivo?.zones?.length || !archivo.image_size) {
        throw new Error('La calibración de esta sesión no tiene zonas. Dibujalas en "Zonas de análisis".')
      }
      this.zonasCalibracion = { zonas: archivo.zones, ancho: archivo.image_size[0], alto: archivo.image_size[1] }

      this.cambiar({ mensaje: 'Cargando el modelo (la primera vez baja ~28 MB)…' })
      const ort = await cargarOrt()
      const { sesion, backend } = await crearSesion(ort, this.o.urlModelo)
      if (!this.activo) return
      // el tamaño de entrada va en el nombre del archivo (best_640.onnx, best_960.onnx)
      const tam = Number(/_(\d+)\.onnx$/.exec(this.o.urlModelo)?.[1] ?? 640)
      this.detector = new Detector(ort, sesion, tam)
      this.cambiar({ backend })

      this.conectar()
      this.temporizador = window.setInterval(() => void this.enviar(), ENVIAR_CADA_MS)
      void this.bucle()
    } catch (e) {
      this.fallar(e instanceof Error ? e.message : String(e))
    }
  }

  detener(fase: FaseProceso = 'detenido', mensaje = 'Detenido.'): void {
    if (!this.activo) return
    this.activo = false
    this.ws?.close()
    this.ws = null
    if (this.temporizador !== null) window.clearInterval(this.temporizador)
    this.temporizador = null
    void this.enviar(true)    // lo que quedó
    this.cambiar({ fase, mensaje })
  }

  // ---- video ----
  private conectar(intento = 0): void {
    if (!this.activo) return
    this.cambiar({ fase: 'conectando', mensaje: `Conectando con el video (${this.o.urlStream})…` })
    let ws: WebSocket
    try {
      ws = new WebSocket(this.o.urlStream)
    } catch {
      return this.fallar(`La dirección del video no es válida: ${this.o.urlStream}`)
    }
    this.ws = ws
    ws.onmessage = (e) => {
      try {
        this.ultimo = JSON.parse(e.data as string) as Mensaje
      } catch {
        // un mensaje roto se ignora
      }
    }
    ws.onopen = () => this.cambiar({ fase: 'procesando', mensaje: 'Procesando los 3 carriles en este dispositivo.' })
    ws.onclose = () => {
      if (!this.activo || this.ws !== ws) return
      const espera = Math.min(1000 * 2 ** intento, 10_000)
      this.cambiar({ fase: 'conectando', mensaje: `Sin video. Reintento en ${Math.round(espera / 1000)} s (¿está corriendo servidor_stream.py?)` })
      window.setTimeout(() => this.conectar(intento + 1), espera)
    }
  }

  private async bucle(): Promise<void> {
    while (this.activo) {
      const m = this.ultimo
      if (!m || m.frame_id === this.procesado || !this.detector) {
        await new Promise((r) => setTimeout(r, 15))
        continue
      }
      this.procesado = m.frame_id
      try {
        await this.procesar(m)
      } catch (e) {
        this.fallar(`Error al procesar un frame: ${e instanceof Error ? e.message : String(e)}`)
        return
      }
    }
  }

  private async procesar(m: Mensaje): Promise<void> {
    const inicio = performance.now()
    const blob = await (await fetch(`data:image/jpeg;base64,${m.frame}`)).blob()
    const imagen = await createImageBitmap(blob)
    try {
      const ancho = imagen.width
      const alto = imagen.height
      const geo = this.geometria(ancho, alto)
      const cajas = await this.detector!.detectar(imagen, ancho, alto, geo.recorte)
      const t = m.timestamp   // segundos, hora de captura en el servidor
      // del frame recibido (achicado) al tamaño de la imagen de la calibración: lo que espera el backend
      const sx = this.zonasCalibracion!.ancho / ancho
      const sy = this.zonasCalibracion!.alto / alto
      for (const p of geo.trayectorias.procesar(cajas, t)) {
        const muestra: Muestra = {
          carril: p.carril,
          identidad: p.identidad,
          t: Math.round(p.t * 1000),
          px: [Math.round(p.px[0] * sx * 10) / 10, Math.round(p.px[1] * sy * 10) / 10],
        }
        if (p.estimada) muestra.estimada = true
        this.pendientes.push(muestra)
      }
      if (this.pendientes.length > MAX_PENDIENTES) this.pendientes.splice(0, this.pendientes.length - MAX_PENDIENTES)
      this.o.alFrame?.({ imagen, cajas, recorte: geo.recorte, zonas: geo.zonas })
    } finally {
      imagen.close()
    }
    this.tiempos.push(performance.now() - inicio)
    if (this.tiempos.length > 20) this.tiempos.shift()
    const media = this.tiempos.reduce((a, b) => a + b, 0) / this.tiempos.length
    this.cambiar({ fps: Math.round((1000 / media) * 10) / 10, pendientes: this.pendientes.length })
  }

  /** Zonas, recorte y trayectorias para el tamaño del frame que llega (se recalcula solo si cambia). */
  private geometria(ancho: number, alto: number) {
    const clave = `${ancho}x${alto}`
    if (this.porTamano?.clave !== clave) {
      const c = this.zonasCalibracion!
      const zonas = escalar(c.zonas, c.ancho, c.alto, ancho, alto)
      const r = calcularRecorte(zonas, ancho, alto)
      const trayectorias = new TrayectoriasPorCarril(zonas)
      if (!trayectorias.numeros.length) throw new Error('Las zonas no tienen carriles (lane4, lane5, lane6).')
      this.porTamano = { clave, zonas, recorte: r ? { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 } : null, trayectorias }
      this.cambiar({ carriles: trayectorias.numeros })
    }
    return this.porTamano
  }

  // ---- envío al backend ----
  private async enviar(final = false): Promise<void> {
    if (this.enviando || !this.pendientes.length) return
    this.enviando = true
    try {
      while (this.pendientes.length) {
        const lote = this.pendientes.slice(0, MAX_POR_ENVIO)
        try {
          const r = await api.enviarTrayectorias(this.o.sesionId, lote)
          this.pendientes.splice(0, lote.length)
          this.cambiar({
            enviadas: this.estado.enviadas + lote.length,
            eventos: this.estado.eventos + r.eventos.length,
            tramos: this.estado.tramos + r.tramos.length,
            pendientes: this.pendientes.length,
          })
        } catch (e) {
          if (e instanceof ErrorApi && (e.estado === 404 || (e.estado === 400 && e.message.includes('terminó')))) {
            this.pendientes = []
            this.detener('terminada', 'La sesión terminó.')
          } else if (e instanceof ErrorApi && e.estado === 400) {
            this.pendientes.splice(0, lote.length)   // mal formado: reintentar no lo arregla
          }
          // sin red o backend caído: queda pendiente y se reintenta en el próximo ciclo
          return
        }
        if (!final) return
      }
    } finally {
      this.enviando = false
    }
  }

  private fallar(mensaje: string): void {
    this.detener('error', mensaje)
    if (this.estado.fase !== 'error') this.cambiar({ fase: 'error', mensaje })
  }

  private cambiar(parte: Partial<EstadoProceso>): void {
    this.estado = { ...this.estado, ...parte }
    this.o.alCambiar(this.estado)
  }
}
