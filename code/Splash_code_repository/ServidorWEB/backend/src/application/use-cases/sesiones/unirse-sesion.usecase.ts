import type { Sesion } from '../../../domain/entities/sesion.entity'
import type { Identidad } from '../../../domain/entities/usuario.entity'
import type { CalibracionRepository } from '../../../domain/repositories/calibracion.repository'
import type { GrupoRepository, NadadorRepository } from '../../../domain/repositories/nadador.repository'
import { ConflictoCarriles, type SesionRepository } from '../../../domain/repositories/sesion.repository'
import { esUuid } from '../../../domain/services/identificador'
import { puedeSumarse } from '../../../domain/services/sumarse-sesion'
import type { UnirseSesionEntrada } from '../../dtos/sesion.dto'
import { ConflictoException, NoEncontradoException, ProhibidoException, ValidacionException } from '../../exceptions/aplicacion.exceptions'
import type { CanalAvisos } from '../../ports/avisos.ports'
import { carrilesAnalizados } from './carriles-analizados'

/**
 * Un nadador que llega tarde se suma a la sesión en curso de un entrenador: la de uno de sus grupos, o una sesión libre
 * (abierta a cualquiera). Ocupa un carril de esa sesión que todavía no tiene nadador, o un carril libre de la piscina
 * (que pasa a ser de esa sesión).
 */
export class UnirseSesionUseCase {
  constructor(
    private readonly sesiones: SesionRepository,
    private readonly calibraciones: CalibracionRepository,
    private readonly nadadores: NadadorRepository,
    private readonly grupos: GrupoRepository,
    private readonly avisos: CanalAvisos,
  ) {}

  async execute(sesionId: string, entrada: UnirseSesionEntrada, quien: Identidad): Promise<Sesion> {
    if (quien.rol !== 'nadador') throw new ProhibidoException('Solo un nadador puede sumarse a una sesión.')
    const perfil = await this.nadadores.asegurarDeUsuario(quien.id, quien.nombre)
    const sesion = esUuid(sesionId) ? await this.sesiones.obtener(sesionId) : null
    if (!sesion || sesion.estado !== 'activa') throw new NoEncontradoException('No hay una sesión en curso con ese id.')
    const misGrupos = (await this.grupos.deNadador(perfil.id)).map((g) => g.id)
    if (!puedeSumarse(sesion, quien.id, misGrupos)) {
      throw new ProhibidoException('Esa sesión es de un grupo en el que no estás.')
    }
    if (await this.sesiones.obtenerActiva(quien.id)) throw new ConflictoException('Ya estás en una sesión.')

    const carril = entrada?.carril
    const calibracion = sesion.calibracion_id ? await this.calibraciones.obtener(sesion.calibracion_id) : null
    const validos = calibracion ? carrilesAnalizados(calibracion.geometria) : []
    if (!Number.isInteger(carril) || !validos.includes(carril)) {
      throw new ValidacionException(`El carril tiene que ser uno de los que mira la cámara: ${validos.join(', ')}.`)
    }

    const enSesion = sesion.carriles.find((c) => c.carril === carril)
    if (enSesion && enSesion.nadador_id) throw new ConflictoException(`El carril ${carril} ya tiene nadador.`)
    if (!enSesion) {
      const otras = await this.sesiones.obtenerActivas()
      if (otras.some((s) => s.carriles.some((c) => c.carril === carril))) throw new ConflictoException(`El carril ${carril} ya está en uso.`)
    }

    let actualizada: Sesion
    try {
      actualizada = await this.sesiones.asignarCarril(sesion.id, carril, perfil.id)
    } catch (e) {
      if (e instanceof ConflictoCarriles) throw new ConflictoException('Otro usuario tomó ese carril recién. Elegí otro.')
      throw e
    }
    this.avisos.publicar({ tipo: 'carriles' })
    return actualizada
  }
}
