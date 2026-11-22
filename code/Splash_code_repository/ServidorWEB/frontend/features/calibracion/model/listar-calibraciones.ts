import type { PuertoCalibraciones } from './puerto-calibraciones'

/** Recupera las posiciones guardadas mediante el puerto de la funcionalidad. */
export function listarCalibraciones(puerto: PuertoCalibraciones) {
  return puerto.listar()
}
