import type { MuestraEntrada, RecibirTrayectoriasEntrada } from '../../dtos/sesion.dto'
import { ValidacionException } from '../../exceptions/aplicacion.exceptions'
import type { SesionRepository } from '../../../domain/repositories/sesion.repository'
import { MAX_MUESTRAS_POR_LOTE, type RecibirTrayectoriasUseCase } from './recibir-trayectorias.usecase'

export type RepartirTrayectoriasSalida = {
  recibidas: number
  /** Cuántas fueron a cada sesión. */
  por_sesion: { sesion_id: string; muestras: number; eventos: number; tramos: number }[]
  /** Las de carriles que no están en ninguna sesión medida por el servidor (se descartan). */
  sin_sesion: number
}

/**
 * El servidor de IA mira los 3 carriles a la vez y manda todo junto. Aquí cada posición va a la sesión dueña de su
 * carril. Las de carriles libres, o de sesiones que procesa un celular, se descartan.
 */
export class RepartirTrayectoriasUseCase {
  constructor(
    private readonly sesiones: SesionRepository,
    private readonly recibir: RecibirTrayectoriasUseCase,
  ) {}

  async execute(entrada: RecibirTrayectoriasEntrada): Promise<RepartirTrayectoriasSalida> {
    const muestras = entrada?.muestras
    if (!Array.isArray(muestras)) throw new ValidacionException('muestras debe ser una lista de posiciones.')
    if (muestras.length > MAX_MUESTRAS_POR_LOTE) throw new ValidacionException(`Demasiadas posiciones en un solo envío (máximo ${MAX_MUESTRAS_POR_LOTE}).`)

    const duenoDe = new Map<number, string>()
    for (const s of await this.sesiones.obtenerActivas()) {
      if (s.modo !== 'servidor') continue
      for (const c of s.carriles) duenoDe.set(c.carril, s.id)
    }
    const porSesion = new Map<string, MuestraEntrada[]>()
    let sinSesion = 0
    for (const m of muestras as MuestraEntrada[]) {
      const id = duenoDe.get(m?.carril)
      if (!id) {
        sinSesion += 1
        continue
      }
      porSesion.set(id, [...(porSesion.get(id) ?? []), m])
    }

    const salida: RepartirTrayectoriasSalida = { recibidas: muestras.length, por_sesion: [], sin_sesion: sinSesion }
    for (const [id, lote] of porSesion) {
      const r = await this.recibir.execute(id, { muestras: lote })
      salida.por_sesion.push({ sesion_id: id, muestras: lote.length, eventos: r.eventos.length, tramos: r.tramos.length })
    }
    return salida
  }
}
