import { Configuracion } from '../../../domain/entities/configuracion.entity'
import type { ConfiguracionRepository } from '../../../domain/repositories/configuracion.repository'

/** La configuración en uso: la guardada o, si todavía no hay ninguna, la de fábrica. */
export async function configuracionEfectiva(repo: ConfiguracionRepository): Promise<Configuracion> {
  return (await repo.obtener()) ?? Configuracion.porDefecto()
}
