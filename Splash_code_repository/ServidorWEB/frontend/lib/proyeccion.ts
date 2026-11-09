import type { Distorsion, Matriz3, Punto } from './tipos'

/**
 * Aplica una homografía a un punto (para dibujar sobre la imagen). Es solo la cuenta de proyectar: calcular
 * la homografía a partir de los puntos marcados es trabajo del backend.
 */
export function aplicar(H: Matriz3, [x, y]: Punto): Punto | null {
  const w = H[2][0] * x + H[2][1] * y + H[2][2]
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return null
  return [(H[0][0] * x + H[0][1] * y + H[0][2]) / w, (H[1][0] * x + H[1][1] * y + H[1][2]) / w]
}

/**
 * De un punto "sin curvatura" a dónde se ve en la imagen, con la curvatura del lente que estimó el backend.
 * Es la misma cuenta que `curvar` en ServidorWEB/backend/src/domain/services/homografia.ts.
 */
export function curvar(d: Distorsion | null, [x, y]: Punto): Punto {
  if (!d || d.k1 === 0) return [x, y]
  const ux = x - d.centro[0]
  const uy = y - d.centro[1]
  let fx = ux
  let fy = uy
  for (let i = 0; i < 30; i++) {
    const f = 1 + d.k1 * ((fx * fx + fy * fy) / (d.escala * d.escala))
    fx = ux / f
    fy = uy / f
  }
  return [d.centro[0] + fx, d.centro[1] + fy]
}

/** De metros de la piscina a dónde se ve en la imagen (homografía inversa + curvatura del lente). */
export function metrosAImagen(Hinv: Matriz3, d: Distorsion | null, m: Punto): Punto | null {
  const q = aplicar(Hinv, m)
  return q ? curvar(d, q) : null
}
