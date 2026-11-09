import { MODOS_PROCESO, type ModoProceso, type Sesion } from '../../../domain/entities/sesion.entity'
import type { Identidad } from '../../../domain/entities/usuario.entity'
import type { CalibracionRepository } from '../../../domain/repositories/calibracion.repository'
import type { ConfiguracionRepository } from '../../../domain/repositories/configuracion.repository'
import type { GrupoRepository, NadadorRepository } from '../../../domain/repositories/nadador.repository'
import { ConflictoCarriles, type SesionRepository } from '../../../domain/repositories/sesion.repository'
import type { IniciarSesionEntrada } from '../../dtos/sesion.dto'
import { ConflictoException, ValidacionException } from '../../exceptions/aplicacion.exceptions'
import type { CanalAvisos } from '../../ports/avisos.ports'
import { configuracionEfectiva } from '../configuracion/configuracion-efectiva'
import { carrilesAnalizados } from './carriles-analizados'

/**
 * Abre una sesión sobre uno o más carriles, con la calibración activa (queda fija para la sesión). Puede haber varias
 * sesiones a la vez, cada una en sus carriles:
 *   * un entrenador toma uno o más carriles, cada uno con un nadador o reservado sin nadador. La sesión es de uno de
 *     sus grupos (solo nadadores de ese grupo) o libre (cualquier nadador; abierta a quien quiera sumarse);
 *   * un nadador puede abrir su sesión personal en un carril que esté libre: queda a su nombre.
 * Un carril, un nadador y una persona (como quien inicia) están en una sola sesión activa a la vez.
 */
export class IniciarSesionUseCase {
  constructor(
    private readonly sesiones: SesionRepository,
    private readonly calibraciones: CalibracionRepository,
    private readonly nadadores: NadadorRepository,
    private readonly grupos: GrupoRepository,
    private readonly avisos: CanalAvisos,
    private readonly configuracion: ConfiguracionRepository,
    /** PROCESAR_EN del .env. */
    private readonly modoPorDefecto: ModoProceso,
  ) {}

  async execute(entrada: IniciarSesionEntrada, quien: Identidad): Promise<Sesion> {
    // sin modo: el de la configuración. La web lo manda igual: si el celular no puede correr el modelo, pide "servidor"
    const modo = entrada?.modo ?? (await configuracionEfectiva(this.configuracion)).modoProcesamiento(this.modoPorDefecto)
    if (!MODOS_PROCESO.includes(modo)) throw new ValidacionException(`modo debe ser uno de: ${MODOS_PROCESO.join(', ')}.`)

    const calibracion = await this.calibraciones.obtenerActiva()
    if (!calibracion) throw new ValidacionException('No hay una calibración activa. Calibrá la cámara antes de empezar una sesión.')
    const validos = carrilesAnalizados(calibracion.geometria)

    if (await this.sesiones.activaIniciadaPor(quien.id)) {
      throw new ConflictoException('Ya tenés una sesión en curso. Finalizala antes de empezar otra.')
    }

    const pedidos = Array.isArray(entrada?.carriles) ? entrada.carriles : []
    let carriles: { carril: number; nadadorId: string | null }[]
    let grupoId: string | null = null
    if (quien.rol === 'nadador') {
      // sesión libre: un carril, a su nombre
      if (pedidos.length !== 1) throw new ValidacionException('Elegí un carril para tu sesión.')
      const perfil = await this.nadadores.asegurarDeUsuario(quien.id, quien.nombre)
      carriles = [{ carril: pedidos[0]?.carril, nadadorId: perfil.id }]
    } else {
      if (pedidos.length === 0) throw new ValidacionException('Elegí al menos un carril para la sesión.')
      carriles = pedidos.map((p) => ({ carril: p?.carril, nadadorId: p?.nadador_id ?? null }))
      // de un grupo (solo sus nadadores) o libre (cualquier nadador)
      const grupo = entrada?.grupo_id ? await this.grupos.obtener(String(entrada.grupo_id)) : null
      if (entrada?.grupo_id && (!grupo || (quien.rol !== 'administrador' && grupo.entrenador_id !== quien.id))) {
        throw new ValidacionException('Ese grupo no es tuyo.')
      }
      grupoId = grupo?.id ?? null
      for (const c of carriles) {
        if (c.nadadorId === null) continue
        const n = await this.nadadores.obtener(String(c.nadadorId))
        if (!n) throw new ValidacionException('Uno de los nadadores elegidos no existe.')
        if (grupo && !grupo.nadadores.some((x) => x.id === n.id)) {
          throw new ValidacionException(`${n.nombre} no está en el grupo "${grupo.nombre}".`)
        }
      }
    }

    // carriles válidos y sin repetir; nadadores sin repetir
    for (const c of carriles) {
      if (!Number.isInteger(c.carril) || !validos.includes(c.carril)) {
        throw new ValidacionException(`El carril tiene que ser uno de los que mira la cámara: ${validos.join(', ')}.`)
      }
    }
    if (new Set(carriles.map((c) => c.carril)).size !== carriles.length) throw new ValidacionException('Hay un carril repetido.')
    const conNadador = carriles.filter((c) => c.nadadorId !== null).map((c) => c.nadadorId)
    if (new Set(conNadador).size !== conNadador.length) throw new ValidacionException('Un nadador no puede estar en dos carriles.')

    // libres: ningún carril ni nadador en otra sesión activa
    const activas = await this.sesiones.obtenerActivas()
    const tomados = new Set(activas.flatMap((s) => s.carriles.map((c) => c.carril)))
    const ocupados = carriles.filter((c) => tomados.has(c.carril)).map((c) => c.carril)
    if (ocupados.length) {
      throw new ConflictoException(
        ocupados.length === 1 ? `El carril ${ocupados[0]} ya está en uso.` : `Los carriles ${ocupados.join(' y ')} ya están en uso.`,
      )
    }
    const nadando = new Set(activas.flatMap((s) => s.carriles.map((c) => c.nadador_id)).filter(Boolean))
    if (conNadador.some((id) => nadando.has(id))) {
      throw new ConflictoException(quien.rol === 'nadador' ? 'Ya estás nadando en otra sesión.' : 'Uno de los nadadores ya está en otra sesión.')
    }

    let sesion: Sesion
    try {
      sesion = await this.sesiones.iniciar({ modo, calibracionId: calibracion.id, usuarioId: quien.id, grupoId, carriles })
    } catch (e) {
      if (e instanceof ConflictoCarriles) throw new ConflictoException('Otro usuario tomó ese carril recién. Elegí otro.')
      throw e
    }
    // el servidor de IA y los paneles abiertos se enteran al instante
    this.avisos.publicar({ tipo: 'sesion_iniciada', sesion })
    this.avisos.publicar({ tipo: 'carriles' })
    return sesion
  }
}
