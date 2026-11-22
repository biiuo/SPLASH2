// Datos de la piscina y de la cámara que usa la calibración (homografía).
// Vienen con valores ya definidos para la piscina de la Universidad del Norte y un entrenador o un administrador
// los puede editar. No depende de ningún framework: es lógica pura.
import { MODOS_PROCESO, type ModoProceso } from './sesion.entity'

export type ConfigPiscina = {
  largo_m: number
  ancho_m: number
  /** Cantidad total de carriles de la piscina. */
  n_carriles: number
  /** Primer carril de los que analiza el modelo (los analizados son consecutivos). */
  primer_carril: number
  n_carriles_analizados: number
  /** Distancias, desde la pared de salida, donde hay marcas en las cuerdas. */
  nodos_m: number[]
}

export type ConfigCamara = {
  modelo: string
  /** Tamaño del sensor: un sensor de 1/3" mide 4,8 x 3,6 mm. */
  sensor_ancho_mm: number
  sensor_alto_mm: number
  /** Resolución de la imagen que se analiza. */
  ancho_px: number
  alto_px: number
  /** Focal que tiene puesta el lente (la perilla del zoom). La calibración vale solo para esa focal. */
  focal_mm: number
  /** Altura de la cámara sobre el nivel del agua. */
  altura_m: number
  /** Distancia horizontal desde la cámara hasta el borde cercano (la pared de salida, 0 m). */
  distancia_borde_m: number
  /** Inclinación hacia abajo, si se conoce. Opcional. */
  inclinacion_grados: number | null
}

export type ConfigProcesamiento = {
  /**
   * Dónde se procesan las sesiones nuevas: en el servidor (ServidorIA/ProcesamientoServidor) o en el celular que inicia
   * la sesión (ServidorIA/ProcesamientoCelular). null = el que diga PROCESAR_EN en el .env del backend.
   */
  modo: ModoProceso | null
}

export type Derivados = {
  anchoCarril_m: number
  anchoAnalizado_m: number
  /** Distancia focal expresada en píxeles. */
  focalPx: number
  fovHorizontal: number
  fovVertical: number
}

export type PrecisionNodo = {
  nodo_m: number
  /** Distancia horizontal desde la cámara. */
  distancia_m: number
  /** Cuánto se equivoca la posición (a lo largo del carril) por cada píxel mal marcado. */
  cm_por_px: number
  /** Lo mismo expresado como error de tiempo para un nadador a esa velocidad. */
  s_por_px: number
  /** Ancho de piscina que se ve en la imagen a esa distancia. */
  ancho_visible_m: number
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const entero = (v: unknown): v is number => num(v) && Number.isInteger(v)
const aGrados = (rad: number) => (rad * 180) / Math.PI

export class Configuracion {
  constructor(
    public readonly piscina: ConfigPiscina,
    public readonly camara: ConfigCamara,
    public readonly procesamiento: ConfigProcesamiento = { modo: null },
  ) {}

  /** Los valores de fábrica de la piscina de la universidad. */
  static porDefecto(): Configuracion {
    return new Configuracion(
      {
        largo_m: 25,
        ancho_m: 12.5,
        n_carriles: 8,
        primer_carril: 4,
        n_carriles_analizados: 3,
        nodos_m: [0, 5, 10, 15, 20, 25],
      },
      {
        modelo: 'Axis Q1604',
        sensor_ancho_mm: 4.8,
        sensor_alto_mm: 3.6,
        ancho_px: 1280,
        alto_px: 960,
        focal_mm: 2.8,
        altura_m: 2.8,
        // Estimada a partir de las líneas dibujadas sobre una foto real (entre 6,2 y 7,0 m). Medida con cinta: 5 m.
        distancia_borde_m: 6.6,
        inclinacion_grados: null,
      },
      { modo: null },
    )
  }

  /** Arma una configuración completando con los valores de fábrica lo que falte (por si lo guardado es de una versión anterior). */
  static desde(parcial: unknown): Configuracion {
    const p = (parcial ?? {}) as { piscina?: Partial<ConfigPiscina>; camara?: Partial<ConfigCamara>; procesamiento?: Partial<ConfigProcesamiento> }
    const f = Configuracion.porDefecto()
    return new Configuracion(
      { ...f.piscina, ...(p.piscina ?? {}) },
      { ...f.camara, ...(p.camara ?? {}) },
      { ...f.procesamiento, ...(p.procesamiento ?? {}) },
    )
  }

  aJSON(): { piscina: ConfigPiscina; camara: ConfigCamara; procesamiento: ConfigProcesamiento } {
    return { piscina: this.piscina, camara: this.camara, procesamiento: this.procesamiento }
  }

  /** El modo que se usa de verdad: el elegido aquí o, si no se eligió, `porDefecto` (el del .env). */
  modoProcesamiento(porDefecto: ModoProceso): ModoProceso {
    return this.procesamiento.modo ?? porDefecto
  }

  /** Errores de validación en español. Lista vacía = la configuración sirve. */
  validar(): string[] {
    const e: string[] = []
    const p = this.piscina
    const k = this.camara

    if (!num(p.largo_m) || p.largo_m < 5 || p.largo_m > 100) e.push('El largo de la piscina tiene que estar entre 5 y 100 m.')
    if (!num(p.ancho_m) || p.ancho_m < 3 || p.ancho_m > 60) e.push('El ancho de la piscina tiene que estar entre 3 y 60 m.')
    if (!entero(p.n_carriles) || p.n_carriles < 1 || p.n_carriles > 12) e.push('La cantidad de carriles tiene que ser un número entero entre 1 y 12.')
    if (!entero(p.primer_carril) || p.primer_carril < 1) e.push('El primer carril analizado tiene que ser un entero desde 1.')
    if (!entero(p.n_carriles_analizados) || p.n_carriles_analizados < 1) e.push('Hay que analizar al menos 1 carril.')
    if (
      entero(p.n_carriles) && entero(p.primer_carril) && entero(p.n_carriles_analizados) &&
      p.primer_carril + p.n_carriles_analizados - 1 > p.n_carriles
    ) {
      e.push('Los carriles analizados se salen de la piscina: revisá el primer carril y cuántos se analizan.')
    }
    if (!Array.isArray(p.nodos_m) || p.nodos_m.length < 2 || !p.nodos_m.every(num)) {
      e.push('Las marcas de las cuerdas necesitan al menos 2 distancias (números, separados por comas).')
    } else {
      const orden = [...p.nodos_m].sort((a, b) => a - b)
      if (orden.some((n, i) => i > 0 && n === orden[i - 1])) e.push('Hay distancias repetidas en las marcas de las cuerdas.')
      if (orden[0] < 0 || (num(p.largo_m) && orden[orden.length - 1] > p.largo_m)) e.push('Las marcas de las cuerdas tienen que estar entre 0 m y el largo de la piscina.')
    }

    if (!k.modelo || typeof k.modelo !== 'string') e.push('Falta el modelo de la cámara.')
    if (!num(k.sensor_ancho_mm) || k.sensor_ancho_mm <= 0 || !num(k.sensor_alto_mm) || k.sensor_alto_mm <= 0) e.push('El tamaño del sensor tiene que ser mayor que 0 mm.')
    if (!entero(k.ancho_px) || !entero(k.alto_px) || k.ancho_px < 100 || k.alto_px < 100) e.push('La resolución tiene que ser de números enteros, de al menos 100 px.')
    if (!num(k.focal_mm) || k.focal_mm <= 0 || k.focal_mm > 100) e.push('La focal tiene que estar entre 0 y 100 mm.')
    if (!num(k.altura_m) || k.altura_m < 0.5 || k.altura_m > 30) e.push('La altura de la cámara tiene que estar entre 0,5 y 30 m.')
    if (!num(k.distancia_borde_m) || k.distancia_borde_m < 0.5 || k.distancia_borde_m > 100) e.push('La distancia al borde tiene que estar entre 0,5 y 100 m.')
    if (k.inclinacion_grados !== null && (!num(k.inclinacion_grados) || k.inclinacion_grados < 0 || k.inclinacion_grados > 89)) {
      e.push('La inclinación tiene que estar entre 0° y 89° (o dejarse vacía).')
    }
    const modo = this.procesamiento?.modo
    if (modo !== null && !MODOS_PROCESO.includes(modo)) e.push(`El procesamiento tiene que ser uno de: ${MODOS_PROCESO.join(', ')} (o vacío para usar el del .env).`)
    return e
  }

  /** Valores que se calculan a partir de los datos (solo tienen sentido si la configuración es válida). */
  derivados(): Derivados {
    const { piscina: p, camara: k } = this
    const focalPx = k.focal_mm / (k.sensor_ancho_mm / k.ancho_px)
    return {
      anchoCarril_m: p.ancho_m / p.n_carriles,
      anchoAnalizado_m: (p.ancho_m / p.n_carriles) * p.n_carriles_analizados,
      focalPx,
      fovHorizontal: aGrados(2 * Math.atan(k.sensor_ancho_mm / 2 / k.focal_mm)),
      fovVertical: aGrados(2 * Math.atan(k.sensor_alto_mm / 2 / k.focal_mm)),
    }
  }

  /**
   * Precisión esperada en cada marca, con la cámara mirando a lo largo de los carriles.
   *   error por píxel = (D² + h²) / (h · f_px)     D: distancia horizontal, h: altura, f_px: focal en píxeles
   * Es una aproximación (cerca del centro de la imagen y sin distorsión de lente).
   */
  precisionPorNodo(velocidad_ms = 1.5): PrecisionNodo[] {
    const { focalPx, fovHorizontal } = this.derivados()
    const h = this.camara.altura_m
    return [...this.piscina.nodos_m]
      .sort((a, b) => a - b)
      .map((nodo) => {
        const D = this.camara.distancia_borde_m + nodo
        const m = (D * D + h * h) / (h * focalPx)
        return {
          nodo_m: nodo,
          distancia_m: D,
          cm_por_px: m * 100,
          s_por_px: m / velocidad_ms,
          ancho_visible_m: 2 * Math.hypot(D, h) * Math.tan(((fovHorizontal / 2) * Math.PI) / 180),
        }
      })
  }

  /** Avisos sobre lo que esa configuración implica (no son errores: se puede guardar igual). */
  avisos(): string[] {
    const a: string[] = []
    if (this.validar().length > 0) return a
    const d = this.derivados()
    const tabla = this.precisionPorNodo()
    const cerca = tabla[0]
    const lejos = tabla[tabla.length - 1]
    if (cerca.ancho_visible_m < d.anchoAnalizado_m) {
      a.push(
        `En el borde cercano la cámara solo ve ${cerca.ancho_visible_m.toFixed(1)} m de ancho, y los carriles analizados miden ` +
          `${d.anchoAnalizado_m.toFixed(1)} m: parte de ellos queda fuera de la imagen.`,
      )
    }
    if (lejos.cm_por_px > 30) {
      a.push(
        `A ${lejos.nodo_m} m, un píxel mal marcado equivale a ${lejos.cm_por_px.toFixed(0)} cm. Las medidas del fondo van a ser las menos ` +
          'precisas; subir la cámara o usar más zoom las mejora.',
      )
    }
    if (d.fovHorizontal > 75) {
      a.push('Con ese ángulo de visión (lente muy abierto) hay distorsión: conviene corregirla antes de calibrar.')
    }
    return a
  }
}
