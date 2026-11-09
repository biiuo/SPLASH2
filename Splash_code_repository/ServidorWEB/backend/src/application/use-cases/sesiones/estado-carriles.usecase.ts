import type { EstadoCarril } from '../../../domain/entities/sesion.entity'
import type { Identidad } from '../../../domain/entities/usuario.entity'
import type { ConfiguracionRepository } from '../../../domain/repositories/configuracion.repository'
import type { NadadorRepository } from '../../../domain/repositories/nadador.repository'
import type { SesionRepository } from '../../../domain/repositories/sesion.repository'
import { configuracionEfectiva } from '../configuracion/configuracion-efectiva'
import { carrilesAnalizados } from './carriles-analizados'

export type EstadoCarrilesDto = {
  carriles: EstadoCarril[]
  /** La sesión en curso del entrenador de quien pregunta (si es nadador y su entrenador tiene una): ahí se puede sumar. */
  sesion_de_mi_entrenador: string | null
}

/**
 * Qué carriles están libres y cuáles no, visto por quien pregunta. De las sesiones ajenas solo se dice "ocupado": no
 * quién está ni de quién es la sesión.
 */
export class EstadoCarrilesUseCase {
  constructor(
    private readonly sesiones: SesionRepository,
    private readonly nadadores: NadadorRepository,
    private readonly configuracion: ConfiguracionRepository,
  ) {}

  async execute(quien: Identidad): Promise<EstadoCarrilesDto> {
    const piscina = (await configuracionEfectiva(this.configuracion)).piscina
    const numeros = carrilesAnalizados({ primer_carril: piscina.primer_carril, n_carriles: piscina.n_carriles_analizados })
    const activas = await this.sesiones.obtenerActivas()
    const entrenador = quien.rol === 'nadador' ? ((await this.nadadores.deUsuario(quien.id))?.entrenador_id ?? null) : null
    const sesionEntrenador = entrenador ? (activas.find((s) => s.iniciada_por_id === entrenador) ?? null) : null

    const carriles = numeros.map((carril): EstadoCarril => {
      const sesion = activas.find((s) => s.carriles.some((c) => c.carril === carril))
      if (!sesion) return { carril, estado: 'libre', sesion_id: null, con_nadador: false, nadador: null }
      const a = sesion.carriles.find((c) => c.carril === carril)!
      const inicie = sesion.iniciada_por_id === quien.id
      if (inicie || a.usuario_id === quien.id) {
        return { carril, estado: 'mio', sesion_id: sesion.id, con_nadador: a.nadador_id !== null, nadador: a.nadador }
      }
      if (sesionEntrenador && sesion.id === sesionEntrenador.id) {
        return { carril, estado: 'grupo', sesion_id: sesion.id, con_nadador: a.nadador_id !== null, nadador: null }
      }
      return { carril, estado: 'ocupado', sesion_id: null, con_nadador: a.nadador_id !== null, nadador: null }
    })
    return { carriles, sesion_de_mi_entrenador: sesionEntrenador?.id ?? null }
  }
}
