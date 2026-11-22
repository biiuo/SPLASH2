import type { CalibracionRepository } from '../../../domain/repositories/calibracion.repository'
import type { ResultadosRepository } from '../../../domain/repositories/resultados.repository'
import type { SesionRepository } from '../../../domain/repositories/sesion.repository'
import { anchoTotal } from '../../../domain/services/evaluador-calibracion'
import { aplicar, corregir } from '../../../domain/services/homografia'
import { esUuid, idDeterminista } from '../../../domain/services/identificador'
import { MotorEventos, type Muestra } from '../../../domain/services/motor-eventos'
import type { MuestraEntrada, RecibirTrayectoriasEntrada, RecibirTrayectoriasSalida } from '../../dtos/sesion.dto'
import { eventoComoGuardado, tramoComoGuardado } from './como-guardados'
import { NoEncontradoException, ProhibidoException, ValidacionException } from '../../exceptions/aplicacion.exceptions'
import type { CanalAvisos } from '../../ports/avisos.ports'
import type { RegistroMotores } from '../../servicios-motores'

export const MAX_MUESTRAS_POR_LOTE = 5000
/** Cuánto se tolera que una posición caiga fuera de la piscina (ruido de la homografía en los bordes). */
export const MARGEN_FUERA_M = 2

/**
 * Pasa las posiciones (píxeles) a metros con la calibración de la sesión, se las da al motor de eventos y guarda
 * lo que salga. La conversión es siempre acá: quien mide solo manda píxeles.
 */
export class RecibirTrayectoriasUseCase {
  constructor(
    private readonly sesiones: SesionRepository,
    private readonly calibraciones: CalibracionRepository,
    private readonly resultados: ResultadosRepository,
    private readonly motores: RegistroMotores,
    private readonly avisos: CanalAvisos,
  ) {}

  /** `dueno`: si mide una persona (modo celular), tiene que ser quien inició la sesión. null = servidor de IA o administrador. */
  async execute(sesionId: string, entrada: RecibirTrayectoriasEntrada, dueno: string | null = null): Promise<RecibirTrayectoriasSalida> {
    const sesion = esUuid(sesionId) ? await this.sesiones.obtener(sesionId) : null
    if (!sesion) throw new NoEncontradoException('No existe esa sesión.')
    if (dueno && sesion.iniciada_por_id !== dueno) throw new ProhibidoException('Solo el dispositivo de quien inició la sesión puede mandarle posiciones.')
    if (sesion.estado !== 'activa') throw new ValidacionException('La sesión ya terminó: no recibe más datos.')

    const calibracion = sesion.calibracion_id ? await this.calibraciones.obtener(sesion.calibracion_id) : null
    if (!calibracion) throw new ValidacionException('La sesión no tiene una calibración con la que convertir a metros.')

    const geo = calibracion.geometria
    const carriles = rangoDeCarriles(geo.primer_carril, geo.n_carriles)
    const todas = validar(entrada?.muestras, carriles)
    // una sesión solo guarda lo de SUS carriles (en los demás puede haber otra sesión)
    const suyos = new Set(sesion.carriles.map((c) => c.carril))
    const muestras = suyos.size ? todas.filter((m) => suyos.has(m.carril)) : todas

    const ancho = anchoTotal(geo)
    const convertidas: Muestra[] = []
    for (const m of muestras) {
      // primero se corrige la curvatura del lente (si la calibración la tiene) y después se pasa a metros
      const metros = aplicar(calibracion.H, corregir(calibracion.distorsion, m.px))
      if (!metros) continue
      const [x, y] = metros
      const dentro = x >= -MARGEN_FUERA_M && x <= geo.largo_m + MARGEN_FUERA_M && y >= -MARGEN_FUERA_M && y <= ancho + MARGEN_FUERA_M
      if (!dentro) continue
      convertidas.push({ carril: m.carril, identidad: m.identidad, t: m.t, x_m: x, y_m: y, estimada: m.estimada === true })
    }

    // la línea de llegada a cada pared es la de la calibración de la sesión (depende de qué ve la cámara)
    const motor = this.motores.deSesion(
      sesion.id,
      () =>
        new MotorEventos({
          nodos: geo.nodos_m,
          llegada_inicio_m: calibracion.llegada?.inicio_m ?? null,
          llegada_fin_m: calibracion.llegada?.fin_m ?? null,
        }),
    )
    const { eventos, tramos } = motor.procesarLote(convertidas)

    const eventosConId = eventos.map((e) => ({
      ...e,
      id: idDeterminista(sesion.id, 'evento', e.carril, e.identidad, e.tipo, e.nodo_m ?? '-', Math.round(e.t)),
    }))
    const tramosConId = tramos.map((t) => ({
      ...t,
      id: idDeterminista(sesion.id, 'tramo', t.carril, t.identidad, t.nodo_desde_m, t.nodo_hasta_m, Math.round(t.t_inicio)),
    }))
    await this.resultados.guardar(sesion.id, eventosConId, tramosConId)

    // a los paneles abiertos les llega solo lo nuevo, ya guardado
    if (eventosConId.length || tramosConId.length) {
      this.avisos.publicar({
        tipo: 'resultados',
        sesion_id: sesion.id,
        eventos: eventosConId.map(eventoComoGuardado),
        tramos: tramosConId.map(tramoComoGuardado),
      })
    }

    return { recibidas: todas.length, procesadas: convertidas.length, descartadas: todas.length - convertidas.length, eventos, tramos }
  }
}

function rangoDeCarriles(primero: number, cantidad: number): Set<number> {
  return new Set(Array.from({ length: cantidad }, (_, i) => primero + i))
}

function validar(muestras: unknown, carriles: Set<number>): MuestraEntrada[] {
  if (!Array.isArray(muestras) || muestras.length === 0) throw new ValidacionException('muestras debe ser una lista con al menos una posición.')
  if (muestras.length > MAX_MUESTRAS_POR_LOTE) {
    throw new ValidacionException(`Demasiadas posiciones en un solo envío (máximo ${MAX_MUESTRAS_POR_LOTE}). Mandalas en lotes más chicos.`)
  }
  const errores: string[] = []
  muestras.forEach((m: Partial<MuestraEntrada> | null, i) => {
    const problema = problemaDe(m, carriles)
    if (problema && errores.length < 5) errores.push(`muestras[${i}]: ${problema}`)
  })
  if (errores.length) throw new ValidacionException('Hay posiciones mal formadas.', errores)
  return muestras as MuestraEntrada[]
}

function problemaDe(m: Partial<MuestraEntrada> | null, carriles: Set<number>): string | null {
  if (!m || typeof m !== 'object') return 'no es un objeto'
  if (!Number.isInteger(m.carril) || !carriles.has(m.carril as number)) return `carril debe ser uno de los analizados (${[...carriles].join(', ')})`
  if (!Number.isInteger(m.identidad) || (m.identidad as number) < 0) return 'identidad debe ser un entero mayor o igual a 0'
  if (typeof m.t !== 'number' || !Number.isFinite(m.t) || m.t <= 0) return 't debe ser un número positivo (milisegundos desde 1970)'
  if (!Array.isArray(m.px) || m.px.length !== 2 || !m.px.every((v) => typeof v === 'number' && Number.isFinite(v))) return 'px debe ser [x, y] en píxeles'
  if (m.estimada !== undefined && typeof m.estimada !== 'boolean') return 'estimada debe ser true o false'
  return null
}
