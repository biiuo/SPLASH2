import type { CalibracionRepository } from '../../../domain/repositories/calibracion.repository'
import type { SesionRepository } from '../../../domain/repositories/sesion.repository'
import { esUuid } from '../../../domain/services/identificador'
import { ConflictoException, NoEncontradoException } from '../../exceptions/aplicacion.exceptions'

/**
 * Borra una calibración del historial. No se puede borrar la activa (primero se deja de usar) ni una que esté usando
 * una sesión en curso. Las sesiones ya terminadas conservan sus resultados y quedan sin calibración asociada.
 */
export class EliminarCalibracionUseCase {
  constructor(
    private readonly calibraciones: CalibracionRepository,
    private readonly sesiones: SesionRepository,
  ) {}

  async execute(id: string): Promise<{ id: string }> {
    const c = esUuid(id) ? await this.calibraciones.obtener(id) : null
    if (!c) throw new NoEncontradoException('No existe esa calibración.')
    const activa = await this.calibraciones.obtenerActiva()
    if (activa?.id === id) throw new ConflictoException('Es la calibración activa: dejá de usarla («No usar») antes de eliminarla.')
    const enCurso = await this.sesiones.obtenerActivas()
    if (enCurso.some((s) => s.calibracion_id === id)) {
      throw new ConflictoException('Hay una sesión en curso que usa esta calibración: finalizala antes de eliminarla.')
    }
    if (!(await this.calibraciones.eliminar(id))) throw new NoEncontradoException('No existe esa calibración.')
    return { id }
  }
}
