import {
  aplicarCambios,
  edadDe,
  estadoDe,
  faltantes,
  marcasPersonales,
  validarRespuestas,
  validarTiempo,
  type EstadoPerfil,
  type MarcaPersonal,
  type PerfilGuardado,
  type RespuestasPerfil,
  type TiempoPersonal,
} from '../../../domain/entities/perfil-nadador.entity'
import type { Nadador } from '../../../domain/entities/nadador.entity'
import type { Identidad } from '../../../domain/entities/usuario.entity'
import type { GrupoRepository, NadadorRepository } from '../../../domain/repositories/nadador.repository'
import type { PerfilNadadorRepository } from '../../../domain/repositories/perfil-nadador.repository'
import { esUuid } from '../../../domain/services/identificador'
import { generarHistoria } from '../../../domain/services/historia-nadador'
import { NoEncontradoException, ValidacionException } from '../../exceptions/aplicacion.exceptions'

/** El cuestionario tiene menos etapas que esto; es solo un tope para no guardar cualquier número. */
const ETAPA_MAX = 100

/** Lo que ven el nadador (el suyo) y su entrenador: respuestas, tiempos, marcas calculadas e historia. */
export type VistaPerfil = {
  nadador_id: string
  nombre: string
  estado: EstadoPerfil
  etapa: number
  respuestas: RespuestasPerfil
  edad: number | null
  completado_en: string | null
  actualizado_en: string | null
  tiempos: TiempoPersonal[]
  marcas: MarcaPersonal[]
  /** Párrafos, armados con las respuestas y los tiempos actuales (se actualiza sola al sumar tiempos). */
  historia: string[]
}

/**
 * El perfil deportivo del nadador. El nadador completa y edita el suyo; su entrenador (y el administrador) lo
 * consultan. El nombre no se pregunta: ya está en la cuenta.
 */
export class PerfilNadadorUseCases {
  constructor(
    private readonly perfiles: PerfilNadadorRepository,
    private readonly nadadores: NadadorRepository,
    private readonly grupos: GrupoRepository,
    private readonly hoy: () => Date = () => new Date(),
  ) {}

  async mio(quien: Identidad): Promise<VistaPerfil> {
    return this.vista(await this.propio(quien))
  }

  /** Guardado progresivo: se manda lo contestado (null borra una respuesta) y por qué etapa va. */
  async guardar(quien: Identidad, entrada: { respuestas?: unknown; etapa?: unknown }): Promise<VistaPerfil> {
    const nadador = await this.propio(quien)
    const { cambios, problemas } = validarRespuestas(entrada?.respuestas ?? {})
    let etapa: number | undefined
    if (entrada?.etapa !== undefined) {
      const e = Number(entrada.etapa)
      if (!Number.isInteger(e) || e < 0 || e > ETAPA_MAX) problemas.push('La etapa no es válida.')
      else etapa = e
    }
    if (problemas.length) throw new ValidacionException('Algunas respuestas no son válidas.', problemas)
    const actual = await this.perfiles.obtener(nadador.id)
    const respuestas = aplicarCambios(actual?.respuestas ?? {}, cambios)
    await this.perfiles.guardar(nadador.id, { respuestas, etapa })
    return this.vista(nadador)
  }

  /**
   * Termina el cuestionario (o guarda una edición): pide los datos obligatorios.
   * Se puede llamar de nuevo después de editar: la fecha en que lo terminó no cambia.
   */
  async finalizar(quien: Identidad): Promise<VistaPerfil> {
    const nadador = await this.propio(quien)
    const actual = await this.perfiles.obtener(nadador.id)
    const respuestas = actual?.respuestas ?? {}
    const falta = faltantes(respuestas)
    if (falta.length) throw new ValidacionException('Faltan datos personales para terminar el perfil.', falta)
    await this.perfiles.guardar(nadador.id, { completado: true, omitido: false })
    return this.vista(nadador)
  }

  /** "Completar más tarde": no se le vuelve a abrir el cuestionario solo. Lo retoma cuando quiera. */
  async omitir(quien: Identidad): Promise<VistaPerfil> {
    const nadador = await this.propio(quien)
    const actual = await this.perfiles.obtener(nadador.id)
    if (!actual?.completado_en) await this.perfiles.guardar(nadador.id, { omitido: true })
    return this.vista(nadador)
  }

  async agregarTiempo(quien: Identidad, datos: Record<string, unknown>): Promise<VistaPerfil> {
    const nadador = await this.propio(quien)
    const { tiempo, problemas } = validarTiempo(datos, this.hoy())
    if (!tiempo) throw new ValidacionException('El tiempo no es válido.', problemas)
    await this.perfiles.agregarTiempo(nadador.id, tiempo)
    return this.vista(nadador)
  }

  async borrarTiempo(quien: Identidad, id: string): Promise<VistaPerfil> {
    const nadador = await this.propio(quien)
    if (!esUuid(id) || !(await this.perfiles.borrarTiempo(nadador.id, id))) throw new NoEncontradoException('No existe ese tiempo.')
    return this.vista(nadador)
  }

  /** Para el entrenador (solo nadadores de sus grupos) y el administrador (todos). */
  async deNadador(quien: Identidad, nadadorId: string): Promise<VistaPerfil> {
    const nadador = esUuid(nadadorId) ? await this.nadadores.obtener(nadadorId) : null
    if (!nadador) throw new NoEncontradoException('No existe ese nadador.')
    if (quien.rol !== 'administrador') {
      const grupos = await this.grupos.deEntrenador(quien.id)
      if (!grupos.some((g) => g.nadadores.some((n) => n.id === nadador.id))) throw new NoEncontradoException('Ese nadador no está en tus grupos.')
    }
    return this.vista(nadador)
  }

  private propio(quien: Identidad): Promise<Nadador> {
    return this.nadadores.asegurarDeUsuario(quien.id, quien.nombre)
  }

  private async vista(nadador: Nadador): Promise<VistaPerfil> {
    const [perfil, tiempos] = await Promise.all([
      this.perfiles.obtener(nadador.id),
      this.perfiles.tiempos(nadador.id),
    ])
    return armarVista(nadador, perfil, tiempos, this.hoy())
  }
}

export function armarVista(nadador: Nadador, perfil: PerfilGuardado | null, tiempos: TiempoPersonal[], hoy: Date): VistaPerfil {
  const respuestas = perfil?.respuestas ?? {}
  const marcas = marcasPersonales(tiempos)
  return {
    nadador_id: nadador.id,
    nombre: nadador.nombre,
    estado: estadoDe(perfil),
    etapa: perfil?.etapa ?? 0,
    respuestas,
    edad: edadDe(respuestas.fecha_nacimiento, hoy),
    completado_en: perfil?.completado_en ?? null,
    actualizado_en: perfil?.actualizado_en ?? null,
    tiempos,
    marcas,
    historia: generarHistoria(respuestas, marcas, hoy),
  }
}
