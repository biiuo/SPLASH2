import type { Sesion } from '../../../domain/entities/sesion.entity'
import type { SesionRepository } from '../../../domain/repositories/sesion.repository'
import { esUuid } from '../../../domain/services/identificador'
import { NoEncontradoException, ProhibidoException } from '../../exceptions/aplicacion.exceptions'
import type { CanalAvisos } from '../../ports/avisos.ports'
import type { RegistroMotores } from '../../servicios-motores'

export class FinalizarSesionUseCase {
  constructor(
    private readonly sesiones: SesionRepository,
    private readonly motores: RegistroMotores,
    private readonly avisos: CanalAvisos,
  ) {}

  /** `dueno`: si se indica, solo quien inició la sesión puede finalizarla. */
  async execute(sesionId: string, dueno: string | null = null): Promise<Sesion> {
    const antes = esUuid(sesionId) ? await this.sesiones.obtener(sesionId) : null
    if (antes && dueno && antes.iniciada_por_id !== dueno) {
      if (!(await this.sesiones.puedeVer(sesionId, dueno))) throw new NoEncontradoException('No existe esa sesión.')
      throw new ProhibidoException('Solo quien inició la sesión puede finalizarla.')
    }
    const sesion = antes ? await this.sesiones.finalizar(sesionId) : null
    if (!sesion) throw new NoEncontradoException('No existe esa sesión.')
    this.motores.olvidar(sesionId)
    // solo se avisa si recién terminó (finalizar dos veces no repite el aviso)
    if (antes?.estado === 'activa') {
      this.avisos.publicar({ tipo: 'sesion_finalizada', sesion })
      this.avisos.publicar({ tipo: 'carriles' })
    }
    return sesion
  }
}
