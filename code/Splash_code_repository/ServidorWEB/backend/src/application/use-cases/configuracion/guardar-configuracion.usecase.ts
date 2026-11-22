import { Configuracion } from '../../../domain/entities/configuracion.entity'
import type { ConfiguracionRepository } from '../../../domain/repositories/configuracion.repository'
import type { ConfiguracionDto } from '../../dtos/configuracion.dto'
import { ValidacionException } from '../../exceptions/aplicacion.exceptions'

export class GuardarConfiguracionUseCase {
  constructor(private readonly repo: ConfiguracionRepository) {}

  async execute(entrada: unknown, usuarioId: string | null = null): Promise<ConfiguracionDto> {
    if (!entrada || typeof entrada !== 'object') throw new ValidacionException('La configuración tiene que ser un objeto JSON.')
    const configuracion = Configuracion.desde(entrada)
    const errores = configuracion.validar()
    if (errores.length > 0) throw new ValidacionException('La configuración no es válida.', errores)
    return (await this.repo.guardar(configuracion, usuarioId)).aJSON()
  }
}
