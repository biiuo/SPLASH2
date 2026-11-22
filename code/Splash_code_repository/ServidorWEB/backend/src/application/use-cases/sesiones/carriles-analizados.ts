import type { Geometria } from '../../../domain/entities/calibracion.entity'

/** Los números de los carriles que mira la cámara (por ejemplo 4, 5 y 6). */
export function carrilesAnalizados(g: Pick<Geometria, 'primer_carril' | 'n_carriles'>): number[] {
  return Array.from({ length: g.n_carriles }, (_, i) => g.primer_carril + i)
}
