import type { Nadador } from '../../../domain/entities/nadador.entity'
import type { Identidad } from '../../../domain/entities/usuario.entity'
import type { NadadorRepository } from '../../../domain/repositories/nadador.repository'
import type { UsuarioRepository } from '../../../domain/repositories/usuario.repository'
import { esUuid } from '../../../domain/services/identificador'
import { ConflictoException, NoEncontradoException, ValidacionException } from '../../exceptions/aplicacion.exceptions'

/** El grupo de un entrenador: los nadadores que él eligió. Cada nadador tiene un solo entrenador. */
export class GrupoUseCases {
  constructor(
    private readonly nadadores: NadadorRepository,
    private readonly usuarios: UsuarioRepository,
  ) {}

  listar(entrenador: Identidad): Promise<Nadador[]> {
    return this.nadadores.grupoDe(entrenador.id)
  }

  /** Agrega al grupo a la cuenta de nadador con ese correo. */
  async agregar(entrenador: Identidad, email: unknown): Promise<Nadador> {
    if (typeof email !== 'string' || !email.includes('@')) throw new ValidacionException('Escribí el correo de la cuenta del nadador.')
    const encontrado = await this.nadadores.buscarPorEmail(email.trim())
    if (!encontrado) throw new NoEncontradoException('No hay ninguna cuenta con ese correo. El nadador tiene que registrarse primero.')
    if (encontrado.usuario.rol !== 'nadador') throw new ValidacionException('Esa cuenta no es de un nadador.')
    const perfil = encontrado.nadador ?? (await this.nadadores.asegurarDeUsuario(encontrado.usuario.id, encontrado.usuario.nombre))
    if (perfil.entrenador_id === entrenador.id) throw new ConflictoException(`${perfil.nombre} ya está en tu grupo.`)
    if (perfil.entrenador_id) throw new ConflictoException(`${perfil.nombre} ya está en el grupo de otro entrenador.`)
    await this.nadadores.asignarEntrenador(perfil.id, entrenador.id)
    return { ...perfil, entrenador_id: entrenador.id }
  }

  /** Lo saca del grupo (queda sin entrenador). */
  async quitar(entrenador: Identidad, nadadorId: string): Promise<void> {
    const n = esUuid(nadadorId) ? await this.nadadores.obtener(nadadorId) : null
    if (!n || (entrenador.rol !== 'administrador' && n.entrenador_id !== entrenador.id)) {
      throw new NoEncontradoException('Ese nadador no está en tu grupo.')
    }
    await this.nadadores.asignarEntrenador(n.id, null)
  }

  /** El entrenador de un nadador, o null si no está en ningún grupo. */
  async miEntrenador(nadador: Identidad): Promise<{ id: string; nombre: string } | null> {
    const perfil = await this.nadadores.deUsuario(nadador.id)
    if (!perfil?.entrenador_id) return null
    const u = await this.usuarios.obtener(perfil.entrenador_id)
    return u ? { id: u.id, nombre: u.nombre } : null
  }
}
