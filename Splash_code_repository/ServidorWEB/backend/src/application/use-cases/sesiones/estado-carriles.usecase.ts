import type { EstadoCarril } from '../../../domain/entities/sesion.entity'
import type { Identidad } from '../../../domain/entities/usuario.entity'
import type { ConfiguracionRepository } from '../../../domain/repositories/configuracion.repository'
import type { GrupoRepository, NadadorRepository } from '../../../domain/repositories/nadador.repository'
import type { SesionRepository } from '../../../domain/repositories/sesion.repository'
import { puedeSumarse } from '../../../domain/services/sumarse-sesion'
import { configuracionEfectiva } from '../configuracion/configuracion-efectiva'
import { carrilesAnalizados } from './carriles-analizados'

/** Una sesión de un entrenador a la que el nadador que pregunta se puede sumar. */
export type SesionDisponible = { id: string; entrenador: string | null; grupo: string | null }

export type EstadoCarrilesDto = {
  carriles: EstadoCarril[]
  /** Para un nadador: las sesiones en curso a las que se puede sumar (de sus grupos, o libres). */
  sesiones_disponibles: SesionDisponible[]
}

/**
 * Qué carriles están libres y cuáles no, visto por quien pregunta. De las sesiones ajenas solo se dice "ocupado" (o
 * "grupo" si el nadador se puede sumar a esa sesión): no quién está.
 */
export class EstadoCarrilesUseCase {
  constructor(
    private readonly sesiones: SesionRepository,
    private readonly nadadores: NadadorRepository,
    private readonly grupos: GrupoRepository,
    private readonly configuracion: ConfiguracionRepository,
  ) {}

  async execute(quien: Identidad): Promise<EstadoCarrilesDto> {
    const piscina = (await configuracionEfectiva(this.configuracion)).piscina
    const numeros = carrilesAnalizados({ primer_carril: piscina.primer_carril, n_carriles: piscina.n_carriles_analizados })
    const activas = await this.sesiones.obtenerActivas()

    let disponibles: typeof activas = []
    if (quien.rol === 'nadador') {
      const perfil = await this.nadadores.deUsuario(quien.id)
      const misGrupos = perfil ? (await this.grupos.deNadador(perfil.id)).map((g) => g.id) : []
      disponibles = activas.filter((s) => puedeSumarse(s, quien.id, misGrupos))
    }

    const carriles = numeros.map((carril): EstadoCarril => {
      const sesion = activas.find((s) => s.carriles.some((c) => c.carril === carril))
      if (!sesion) return { carril, estado: 'libre', sesion_id: null, con_nadador: false, nadador: null }
      const a = sesion.carriles.find((c) => c.carril === carril)!
      if (sesion.iniciada_por_id === quien.id || a.usuario_id === quien.id) {
        return { carril, estado: 'mio', sesion_id: sesion.id, con_nadador: a.nadador_id !== null, nadador: a.nadador }
      }
      if (disponibles.some((s) => s.id === sesion.id)) {
        return { carril, estado: 'grupo', sesion_id: sesion.id, con_nadador: a.nadador_id !== null, nadador: null }
      }
      return { carril, estado: 'ocupado', sesion_id: null, con_nadador: a.nadador_id !== null, nadador: null }
    })
    return {
      carriles,
      sesiones_disponibles: disponibles.map((s) => ({ id: s.id, entrenador: s.iniciada_por, grupo: s.grupo })),
    }
  }
}
