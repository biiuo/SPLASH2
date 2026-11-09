import type { Grupo, Nadador } from '../../../domain/entities/nadador.entity'
import type { Identidad } from '../../../domain/entities/usuario.entity'
import { GrupoRepetido, type GrupoRepository, type NadadorRepository } from '../../../domain/repositories/nadador.repository'
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

  misGrupos(entrenador: Identidad): Promise<Grupo[]> {
    return this.grupos.deEntrenador(entrenador.id)
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

  /** Todos los nadadores registrados, con los grupos MÍOS en los que ya están (para elegir a quién sumar). */
  async todos(entrenador: Identidad): Promise<(Nadador & { mis_grupos: string[] })[]> {
    const [todos, mios] = await Promise.all([this.nadadores.todos(), this.grupos.deEntrenador(entrenador.id)])
    return todos.map((n) => ({ ...n, mis_grupos: mios.filter((g) => g.nadadores.some((x) => x.id === n.id)).map((g) => g.id) }))
  }

  /** Para un nadador: los grupos en los que está, con su entrenador. */
  async gruposDeNadador(nadador: Identidad): Promise<{ id: string; nombre: string; entrenador: string }[]> {
    const perfil = await this.nadadores.deUsuario(nadador.id)
    if (!perfil) return []
    return (await this.grupos.deNadador(perfil.id)).map((g) => ({ id: g.id, nombre: g.nombre, entrenador: g.entrenador }))
  }

  /** El grupo, si es de ese entrenador (el administrador puede con todos). Si no, "no existe": no se revela. */
  private async propio(entrenador: Identidad, id: string): Promise<Grupo> {
    const g = esUuid(id) ? await this.grupos.obtener(id) : null
    if (!g || (entrenador.rol !== 'administrador' && g.entrenador_id !== entrenador.id)) throw new NoEncontradoException('No existe ese grupo.')
    return g
  }
}
