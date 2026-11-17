import { DIAS_SEMANA, type DiaSemana, type Grupo, type HorarioGrupo, NIVELES_GRUPO, type Nadador, type NivelGrupo } from '../../../domain/entities/nadador.entity'
import type { Identidad } from '../../../domain/entities/usuario.entity'
import { type ConfiguracionGrupo, GrupoRepetido, type GrupoRepository, type NadadorRepository } from '../../../domain/repositories/nadador.repository'
import { esUuid } from '../../../domain/services/identificador'
import { ConflictoException, NoEncontradoException, ValidacionException } from '../../exceptions/aplicacion.exceptions'

const MAX_NOMBRE = 60

function nombreValido(nombre: unknown): string {
  const n = typeof nombre === 'string' ? nombre.trim() : ''
  if (!n) throw new ValidacionException('El grupo necesita un nombre.')
  if (n.length > MAX_NOMBRE) throw new ValidacionException(`El nombre del grupo puede tener hasta ${MAX_NOMBRE} caracteres.`)
  return n
}

/**
 * Los grupos de un entrenador. Un entrenador puede tener varios (por ejemplo, por nivel u horario) y un nadador puede
 * estar en varios, incluso de entrenadores distintos.
 */
export class GrupoUseCases {
  constructor(
    private readonly grupos: GrupoRepository,
    private readonly nadadores: NadadorRepository,
  ) {}

  /** Los grupos del entrenador. El administrador ve los de todos. */
  misGrupos(entrenador: Identidad): Promise<Grupo[]> {
    return entrenador.rol === 'administrador' ? this.grupos.todos() : this.grupos.deEntrenador(entrenador.id)
  }

  async crear(entrenador: Identidad, nombre: unknown): Promise<Grupo> {
    const n = nombreValido(nombre)
    try {
      return await this.grupos.crear(entrenador.id, n)
    } catch (e) {
      if (e instanceof GrupoRepetido) throw new ConflictoException(`Ya tenés un grupo llamado "${n}".`)
      throw e
    }
  }

  async renombrar(entrenador: Identidad, id: string, nombre: unknown): Promise<Grupo> {
    await this.propio(entrenador, id)
    const n = nombreValido(nombre)
    try {
      return await this.grupos.renombrar(id, n)
    } catch (e) {
      if (e instanceof GrupoRepetido) throw new ConflictoException(`Ya tenés un grupo llamado "${n}".`)
      throw e
    }
  }

  /**
   * Cambiar el nombre y/o la configuración (descripción, nivel, horario de clases). Lo que no venga queda igual;
   * null lo borra.
   */
  async actualizar(entrenador: Identidad, id: string, datos: { nombre?: unknown; descripcion?: unknown; nivel?: unknown; horario?: unknown }): Promise<Grupo> {
    let grupo = await this.propio(entrenador, id)
    if (datos?.nombre !== undefined && datos.nombre !== grupo.nombre) grupo = await this.renombrar(entrenador, id, datos.nombre)
    const c: ConfiguracionGrupo = {}
    const errores: string[] = []
    if (datos?.descripcion !== undefined) {
      const d = typeof datos.descripcion === 'string' ? datos.descripcion.trim() : ''
      if (d.length > 200) errores.push('La descripción puede tener hasta 200 caracteres.')
      c.descripcion = d || null
    }
    if (datos?.nivel !== undefined) {
      if (datos.nivel === null || datos.nivel === '') c.nivel = null
      else if (NIVELES_GRUPO.includes(datos.nivel as NivelGrupo)) c.nivel = datos.nivel as NivelGrupo
      else errores.push(`El nivel tiene que ser ${NIVELES_GRUPO.join(', ')}.`)
    }
    if (datos?.horario !== undefined) {
      if (datos.horario === null) c.horario = null
      else {
        const h = datos.horario as Partial<HorarioGrupo>
        const hora = /^([01]\d|2[0-3]):[0-5]\d$/
        const dias = Array.isArray(h?.dias) ? [...new Set(h.dias)] : []
        if (!dias.length || !dias.every((d) => DIAS_SEMANA.includes(d as DiaSemana))) errores.push('Elegí al menos un día de la semana.')
        if (typeof h?.inicio !== 'string' || !hora.test(h.inicio) || typeof h?.fin !== 'string' || !hora.test(h.fin)) errores.push('Las horas tienen que ser HH:MM.')
        else if (h.fin <= h.inicio) errores.push('La hora de fin tiene que ser después de la de inicio.')
        if (!errores.length) c.horario = { dias: DIAS_SEMANA.filter((d) => dias.includes(d)), inicio: h.inicio as string, fin: h.fin as string }
      }
    }
    if (errores.length) throw new ValidacionException('La configuración del grupo no es válida.', errores)
    return Object.keys(c).length ? this.grupos.configurar(id, c) : grupo
  }

  async borrar(entrenador: Identidad, id: string): Promise<void> {
    await this.propio(entrenador, id)
    await this.grupos.borrar(id)
  }

  /** Agrega a un nadador: por su id (de la lista de todos) o por el correo de su cuenta. */
  async agregar(entrenador: Identidad, grupoId: string, datos: { nadador_id?: unknown; email?: unknown }): Promise<Grupo> {
    const grupo = await this.propio(entrenador, grupoId)
    let perfil: Nadador | null
    if (typeof datos?.nadador_id === 'string') {
      perfil = esUuid(datos.nadador_id) ? await this.nadadores.obtener(datos.nadador_id) : null
      if (!perfil) throw new NoEncontradoException('No existe ese nadador.')
    } else {
      const email = datos?.email
      if (typeof email !== 'string' || !email.includes('@')) throw new ValidacionException('Elegí un nadador de la lista o escribí el correo de su cuenta.')
      const encontrado = await this.nadadores.buscarPorEmail(email.trim())
      if (!encontrado) throw new NoEncontradoException('No hay ninguna cuenta con ese correo. El nadador tiene que registrarse primero.')
      if (encontrado.usuario.rol !== 'nadador') throw new ValidacionException('Esa cuenta no es de un nadador.')
      perfil = encontrado.nadador ?? (await this.nadadores.asegurarDeUsuario(encontrado.usuario.id, encontrado.usuario.nombre))
    }
    if (grupo.nadadores.some((n) => n.id === perfil.id)) throw new ConflictoException(`${perfil.nombre} ya está en "${grupo.nombre}".`)
    await this.grupos.agregarNadador(grupo.id, perfil.id)
    return (await this.grupos.obtener(grupo.id))!
  }

  async quitar(entrenador: Identidad, grupoId: string, nadadorId: string): Promise<Grupo> {
    const grupo = await this.propio(entrenador, grupoId)
    if (!grupo.nadadores.some((n) => n.id === nadadorId)) throw new NoEncontradoException('Ese nadador no está en el grupo.')
    await this.grupos.quitarNadador(grupo.id, nadadorId)
    return (await this.grupos.obtener(grupo.id))!
  }

  /**
   * Los nadadores que puede ver quien pregunta, con los grupos suyos en los que ya están. Un entrenador ve solo a los
   * de sus grupos (los que agregó); a uno nuevo lo suma por el correo de su cuenta. El administrador ve a todos.
   */
  async todos(entrenador: Identidad): Promise<(Nadador & { mis_grupos: string[] })[]> {
    const mios = await this.misGrupos(entrenador)
    const conGrupos = (n: Nadador) => ({ ...n, mis_grupos: mios.filter((g) => g.nadadores.some((x) => x.id === n.id)).map((g) => g.id) })
    if (entrenador.rol === 'administrador') return (await this.nadadores.todos()).map(conGrupos)
    const vistos = new Map<string, Nadador>()
    for (const g of mios) for (const n of g.nadadores) vistos.set(n.id, n)
    return [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(conGrupos)
  }

  /**
   * Sugerencias para sumar a un grupo mientras se escribe: desde 3 letras, hasta 8 nadadores con cuenta activa.
   * Es lo mínimo para encontrar a alguien sin listar todas las cuentas (el entrenador ve solo a los de sus grupos).
   */
  async sugerir(texto: unknown): Promise<Nadador[]> {
    const t = typeof texto === 'string' ? texto.trim() : ''
    if (t.length < 3) return []
    return this.nadadores.buscar(t.slice(0, 80), 8)
  }

  /** Para un nadador: los grupos en los que está, con su entrenador. */
  async gruposDeNadador(nadador: Identidad): Promise<{ id: string; nombre: string; entrenador: string; entrenador_email: string | null; entrenador_telefono: string | null }[]> {
    const perfil = await this.nadadores.deUsuario(nadador.id)
    if (!perfil) return []
    return (await this.grupos.deNadador(perfil.id)).map((g) => ({
      id: g.id,
      nombre: g.nombre,
      entrenador: g.entrenador,
      entrenador_email: g.entrenador_email ?? null,
      entrenador_telefono: g.entrenador_telefono ?? null,
    }))
  }

  /** El grupo, si es de ese entrenador (el administrador puede con todos). Si no, "no existe": no se revela. */
  private async propio(entrenador: Identidad, id: string): Promise<Grupo> {
    const g = esUuid(id) ? await this.grupos.obtener(id) : null
    if (!g || (entrenador.rol !== 'administrador' && g.entrenador_id !== entrenador.id)) throw new NoEncontradoException('No existe ese grupo.')
    return g
  }
}
