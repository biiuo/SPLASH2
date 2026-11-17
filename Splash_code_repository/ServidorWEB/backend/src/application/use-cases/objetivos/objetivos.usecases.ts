import { type Objetivo, TIPOS_OBJETIVO, type TipoObjetivo } from '../../../domain/entities/objetivo.entity'
import type { Identidad } from '../../../domain/entities/usuario.entity'
import type { GrupoRepository, NadadorRepository } from '../../../domain/repositories/nadador.repository'
import type { DatosObjetivo, ObjetivoRepository } from '../../../domain/repositories/objetivo.repository'
import { esUuid } from '../../../domain/services/identificador'
import { NoEncontradoException, ValidacionException } from '../../exceptions/aplicacion.exceptions'

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Los objetivos de los nadadores. Un entrenador solo ve y maneja los de los nadadores de sus grupos; el administrador,
 * los de todos; un nadador ve los suyos (sin poder cambiarlos).
 */
export class ObjetivosUseCases {
  constructor(
    private readonly objetivos: ObjetivoRepository,
    private readonly grupos: GrupoRepository,
    private readonly nadadores: NadadorRepository,
  ) {}

  /** Los ids de los nadadores que puede manejar esa persona (null = todos, para el administrador). */
  private async misNadadores(quien: Identidad): Promise<Set<string> | null> {
    if (quien.rol === 'administrador') return null
    const grupos = await this.grupos.deEntrenador(quien.id)
    return new Set(grupos.flatMap((g) => g.nadadores.map((n) => n.id)))
  }

  async listar(quien: Identidad): Promise<Objetivo[]> {
    const mios = await this.misNadadores(quien)
    return this.objetivos.deNadadores(mios ? [...mios] : null)
  }

  /** Para el nadador: sus propios objetivos. */
  async deNadador(quien: Identidad): Promise<Objetivo[]> {
    const perfil = await this.nadadores.deUsuario(quien.id)
    return perfil ? this.objetivos.deNadadores([perfil.id]) : []
  }

  async crear(quien: Identidad, datos: { nadador_id?: unknown } & Record<string, unknown>): Promise<Objetivo> {
    const nadadorId = typeof datos?.nadador_id === 'string' ? datos.nadador_id : ''
    await this.propio(quien, nadadorId)
    return this.objetivos.crear(nadadorId, quien.id, validar(datos, true) as DatosObjetivo)
  }

  async actualizar(quien: Identidad, id: string, datos: Record<string, unknown>): Promise<Objetivo> {
    const o = await this.existente(quien, id)
    const cambios = validar(datos, false)
    const desde = cambios.desde ?? o.desde
    const hasta = cambios.hasta ?? o.hasta
    if (hasta < desde) throw new ValidacionException('La fecha final tiene que ser igual o posterior a la inicial.')
    return this.objetivos.actualizar(id, cambios)
  }

  async borrar(quien: Identidad, id: string): Promise<void> {
    await this.existente(quien, id)
    await this.objetivos.borrar(id)
  }

  private async propio(quien: Identidad, nadadorId: string): Promise<void> {
    const mios = await this.misNadadores(quien)
    const existe = esUuid(nadadorId) ? await this.nadadores.obtener(nadadorId) : null
    if (!existe || (mios && !mios.has(nadadorId))) throw new NoEncontradoException('Ese nadador no está en tus grupos.')
  }

  private async existente(quien: Identidad, id: string): Promise<Objetivo> {
    const o = esUuid(id) ? await this.objetivos.obtener(id) : null
    if (!o) throw new NoEncontradoException('No existe ese objetivo.')
    await this.propio(quien, o.nadador_id)
    return o
  }
}

/** Valida los campos (todos obligatorios al crear; al cambiar, solo los que vengan). */
function validar(d: Record<string, unknown>, todo: boolean): Partial<DatosObjetivo> {
  const r: Partial<DatosObjetivo> = {}
  const errores: string[] = []
  if (todo || d.tipo !== undefined) {
    if (!TIPOS_OBJETIVO.includes(d.tipo as TipoObjetivo)) errores.push(`El tipo tiene que ser ${TIPOS_OBJETIVO.join(', ')}.`)
    else r.tipo = d.tipo as TipoObjetivo
  }
  if (todo || d.meta !== undefined) {
    const m = Number(d.meta)
    if (!Number.isFinite(m) || m <= 0 || m > 999999) errores.push('La meta tiene que ser un número mayor que 0.')
    else r.meta = Math.round(m * 1000) / 1000
  }
  for (const k of ['desde', 'hasta'] as const) {
    if (todo || d[k] !== undefined) {
      if (typeof d[k] !== 'string' || !FECHA.test(d[k] as string) || Number.isNaN(Date.parse(d[k] as string))) errores.push(`La fecha "${k}" no es válida (AAAA-MM-DD).`)
      else r[k] = d[k] as string
    }
  }
  if (r.desde && r.hasta && r.hasta < r.desde) errores.push('La fecha final tiene que ser igual o posterior a la inicial.')
  if (todo || d.descripcion !== undefined) {
    const t = typeof d.descripcion === 'string' ? d.descripcion.trim() : ''
    if (t.length > 200) errores.push('La descripción puede tener hasta 200 caracteres.')
    r.descripcion = t || null
  }
  if (errores.length) throw new ValidacionException('El objetivo no es válido.', errores)
  return r
}
