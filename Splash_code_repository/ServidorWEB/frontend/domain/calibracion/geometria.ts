export type Punto = [number, number]
export type Matriz3 = [[number, number, number], [number, number, number], [number, number, number]]

/** Curvatura del lente (la estima el backend): para dibujar la rejilla como la ve la cámara. */
export type Distorsion = { k1: number; centro: Punto; escala: number }
