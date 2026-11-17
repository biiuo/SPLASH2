import type { ResultadosSesion, Sesion } from '../../../domain/entities/sesion.entity'
import type { Identidad } from '../../../domain/entities/usuario.entity'
import type { CalibracionRepository } from '../../../domain/repositories/calibracion.repository'
import type { ResultadosRepository } from '../../../domain/repositories/resultados.repository'
import type { SesionRepository } from '../../../domain/repositories/sesion.repository'
import { esUuid } from '../../../domain/services/identificador'
import { type Largo, largoDePiscina, largosPorCarril } from '../../../domain/services/largos'
import { tramoPlausible } from '../../../domain/services/motor-eventos'
import { NoEncontradoException } from '../../exceptions/aplicacion.exceptions'

/**
 * Los carriles de una sesión que puede ver una persona: todos si la inició (o es administrador, o es el servidor de
 * IA: quien = null); si es un nadador asignado, solo el suyo. null = todos.
 */
export function carrilesVisibles(sesion: Sesion, quien: Identidad | null): Set<number> | null {
  if (!quien || quien.rol === 'administrador' || sesion.iniciada_por_id === quien.id) return null
  return new Set(sesion.carriles.filter((c) => c.usuario_id === quien.id).map((c) => c.carril))
}

/** Los resultados con los largos ya armados (carril por carril) y el largo de la piscina con que se calcularon. */
export type ResultadosConLargos = ResultadosSesion & { largos: Largo[]; largo_m: number }

/** Los eventos, tramos y largos de una sesión, en orden de tiempo. Un nadador ve solo los de su carril. */
export class ObtenerResultadosUseCase {
  constructor(
    private readonly sesiones: SesionRepository,
    private readonly resultados: ResultadosRepository,
    private readonly calibraciones: CalibracionRepository,
  ) {}

  async execute(sesionId: string, quien: Identidad | null = null): Promise<ResultadosConLargos> {
    const sesion = esUuid(sesionId) ? await this.sesiones.obtener(sesionId) : null
    const visible = sesion && (!quien || quien.rol === 'administrador' || (await this.sesiones.puedeVer(sesionId, quien.id)))
    if (!sesion || !visible) throw new NoEncontradoException('No existe esa sesión.')
    const guardado = await this.resultados.listar(sesionId)
    // los tramos imposibles (errores de detección guardados antes del filtro del motor) no se muestran
    const todo = { ...guardado, tramos: guardado.tramos.filter(tramoPlausible) }
    const carriles = carrilesVisibles(sesion, quien)
    const r = carriles
      ? { eventos: todo.eventos.filter((e) => carriles.has(e.carril)), tramos: todo.tramos.filter((t) => carriles.has(t.carril)) }
      : todo
    const calibracion = sesion.calibracion_id ? await this.calibraciones.obtener(sesion.calibracion_id) : null
    const largo_m = largoDePiscina(calibracion?.geometria)
    const largos = largosPorCarril(
      r.tramos.map((t) => ({ ...t, t_inicio: Date.parse(t.t_inicio), t_fin: Date.parse(t.t_fin) })),
      largo_m,
    )
    return { ...r, largos, largo_m }
  }
}
