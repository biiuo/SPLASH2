import type { ResultadosSesion, Sesion } from '../../../domain/entities/sesion.entity'
import type { Identidad } from '../../../domain/entities/usuario.entity'
import type { ResultadosRepository } from '../../../domain/repositories/resultados.repository'
import type { SesionRepository } from '../../../domain/repositories/sesion.repository'
import { esUuid } from '../../../domain/services/identificador'
import { NoEncontradoException } from '../../exceptions/aplicacion.exceptions'

/**
 * Los carriles de una sesión que puede ver una persona: todos si la inició (o es administrador, o es el servidor de
 * IA: quien = null); si es un nadador asignado, solo el suyo. null = todos.
 */
export function carrilesVisibles(sesion: Sesion, quien: Identidad | null): Set<number> | null {
  if (!quien || quien.rol === 'administrador' || sesion.iniciada_por_id === quien.id) return null
  return new Set(sesion.carriles.filter((c) => c.usuario_id === quien.id).map((c) => c.carril))
}

/** Los eventos y tramos de una sesión, en orden de tiempo. Un nadador ve solo los de su carril. */
export class ObtenerResultadosUseCase {
  constructor(
    private readonly sesiones: SesionRepository,
    private readonly resultados: ResultadosRepository,
  ) {}

  async execute(sesionId: string, quien: Identidad | null = null): Promise<ResultadosSesion> {
    const sesion = esUuid(sesionId) ? await this.sesiones.obtener(sesionId) : null
    const visible = sesion && (!quien || quien.rol === 'administrador' || (await this.sesiones.puedeVer(sesionId, quien.id)))
    if (!sesion || !visible) throw new NoEncontradoException('No existe esa sesión.')
    const todo = await this.resultados.listar(sesionId)
    const carriles = carrilesVisibles(sesion, quien)
    if (!carriles) return todo
    return { eventos: todo.eventos.filter((e) => carriles.has(e.carril)), tramos: todo.tramos.filter((t) => carriles.has(t.carril)) }
  }
}
