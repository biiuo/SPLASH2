import type { Objetivo, TipoObjetivo } from '../entities/objetivo.entity'

export type DatosObjetivo = { tipo: TipoObjetivo; meta: number; desde: string; hasta: string; descripcion: string | null }

export interface ObjetivoRepository {
  /** Los objetivos de esos nadadores (o de todos, con null), de la fecha final más reciente a la más vieja. */
  deNadadores(nadadorIds: string[] | null): Promise<Objetivo[]>
  obtener(id: string): Promise<Objetivo | null>
  crear(nadadorId: string, entrenadorId: string, datos: DatosObjetivo): Promise<Objetivo>
  actualizar(id: string, datos: Partial<DatosObjetivo>): Promise<Objetivo>
  borrar(id: string): Promise<void>
}

export const OBJETIVO_REPOSITORY = Symbol('ObjetivoRepository')
