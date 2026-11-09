// Homografía: convierte puntos de la imagen (píxeles) en puntos de la piscina (metros).
//
// Se calcula con la "transformación lineal directa" (DLT) normalizada, a partir de puntos cuya
// posición real en la piscina se conoce (los nodos de las cuerdas, cada 5 m). No usa librerías:
// el sistema 9x9 se resuelve con el método de Jacobi. Con >= 4 puntos que no estén en línea ya
// se puede calcular; más puntos reparten el error de clic y la hacen más precisa.

export type Punto = [number, number]
export type Matriz3 = [[number, number, number], [number, number, number], [number, number, number]]
/** Un punto marcado en la imagen (px) y su posición real en la piscina (mundo, en metros). */
export type Par = { px: Punto; mundo: Punto }
/**
 * Un punto marcado sobre una corchera, en cualquier lugar de su largo: no se sabe a qué distancia está (x), pero sí
 * a qué altura de la piscina (y, en metros), porque la corchera es una recta conocida. Aporta una ecuación (un nodo, dos).
 */
export type ParCuerda = { px: Punto; y: number }

export function multiplicar(a: Matriz3, b: Matriz3): Matriz3 {
  const r = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j]
  return r as Matriz3
}

export function invertir(m: Matriz3): Matriz3 | null {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  if (!Number.isFinite(det) || Math.abs(det) < 1e-14) return null
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ]
}

/** Aplica la homografía a un punto. Devuelve null si cae en el infinito. */
export function aplicar(H: Matriz3, [x, y]: Punto): Punto | null {
  const w = H[2][0] * x + H[2][1] * y + H[2][2]
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return null
  return [(H[0][0] * x + H[0][1] * y + H[0][2]) / w, (H[1][0] * x + H[1][1] * y + H[1][2]) / w]
}

/** Normalización de Hartley: centra los puntos y los escala a distancia media sqrt(2). */
function normalizar(puntos: Punto[]): { T: Matriz3; puntos: Punto[] } | null {
  const n = puntos.length
  const cx = puntos.reduce((s, p) => s + p[0], 0) / n
  const cy = puntos.reduce((s, p) => s + p[1], 0) / n
  const d = puntos.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / n
  if (!Number.isFinite(d) || d < 1e-12) return null
  const s = Math.SQRT2 / d
  const T: Matriz3 = [
    [s, 0, -s * cx],
    [0, s, -s * cy],
    [0, 0, 1],
  ]
  return { T, puntos: puntos.map(([x, y]) => [(x - cx) * s, (y - cy) * s] as Punto) }
}

/** Autovalores y autovectores de una matriz simétrica (método de Jacobi). Los vectores quedan en las columnas de V. */
function jacobi(entrada: number[][]): { valores: number[]; V: number[][] } {
  const n = entrada.length
  const A = entrada.map((f) => f.slice())
  const V: number[][] = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)))
  let total = 0
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) total += A[i][j] * A[i][j]

  for (let barrido = 0; barrido < 100; barrido++) {
    let fuera = 0
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) fuera += A[i][j] * A[i][j]
    if (fuera <= 1e-26 * total) break
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p][q]
        if (Math.abs(apq) < 1e-300) continue
        const theta = (A[q][q] - A[p][p]) / (2 * apq)
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        const app = A[p][p]
        const aqq = A[q][q]
        A[p][p] = app - t * apq
        A[q][q] = aqq + t * apq
        A[p][q] = A[q][p] = 0
        for (let r = 0; r < n; r++) {
          if (r === p || r === q) continue
          const arp = A[r][p]
          const arq = A[r][q]
          A[r][p] = A[p][r] = c * arp - s * arq
          A[r][q] = A[q][r] = c * arq + s * arp
        }
        for (let r = 0; r < n; r++) {
          const vp = V[r][p]
          const vq = V[r][q]
          V[r][p] = c * vp - s * vq
          V[r][q] = s * vp + c * vq
        }
      }
    }
  }
  return { valores: A.map((_, i) => A[i][i]), V }
}

/**
 * Estima la homografía píxeles -> metros. Devuelve null si hay menos de 4 puntos, si los puntos
 * están (casi) en línea o si la matriz no se puede usar.
 *
 * `cuerdas` son puntos sobre las corcheras: cada uno exige que su "y" en metros sea la de su corchera. Son muy útiles
 * porque las corcheras son largas y se ven donde los nodos no (cerca de la cámara), y no dependen de clics precisos
 * en el extremo lejano de la piscina, donde 5 m ocupan pocos píxeles.
 */
export function estimarHomografia(pares: Par[], cuerdas: ParCuerda[] = []): Matriz3 | null {
  if (pares.length < 4) return null
  const src = normalizar([...pares.map((p) => p.px), ...cuerdas.map((c) => c.px)])
  const dst = normalizar(pares.map((p) => p.mundo))
  if (!src || !dst) return null

  const AtA = Array.from({ length: 9 }, () => new Array<number>(9).fill(0))
  const sumar = (f: number[]) => {
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) AtA[i][j] += f[i] * f[j]
  }
  for (let k = 0; k < pares.length; k++) {
    const [x, y] = src.puntos[k]
    const [u, v] = dst.puntos[k]
    sumar([-x, -y, -1, 0, 0, 0, u * x, u * y, u])
    sumar([0, 0, 0, -x, -y, -1, v * x, v * y, v])
  }
  for (let k = 0; k < cuerdas.length; k++) {
    const [x, y] = src.puntos[pares.length + k]
    const v = dst.T[1][1] * cuerdas[k].y + dst.T[1][2] // la "y" de la corchera, en las coordenadas normalizadas
    sumar([0, 0, 0, -x, -y, -1, v * x, v * y, v])
  }

  const { valores, V } = jacobi(AtA)
  const orden = valores.map((_, i) => i).sort((a, b) => valores[a] - valores[b])
  const mayor = Math.max(...valores.map(Math.abs))
  // Si el segundo autovalor más chico también es ~0, hay más de una solución: puntos en línea.
  if (mayor <= 0 || valores[orden[1]] < 1e-9 * mayor) return null

  const h = V.map((fila) => fila[orden[0]])
  const Hn: Matriz3 = [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], h[8]],
  ]
  const TdstInv = invertir(dst.T)
  if (!TdstInv) return null
  const H = multiplicar(multiplicar(TdstInv, Hn), src.T)
  const k = Math.abs(H[2][2]) > 1e-12 ? H[2][2] : 1
  const norm = H.map((f) => f.map((v) => v / k)) as Matriz3
  if (!norm.flat().every(Number.isFinite)) return null
  return refinar(norm, pares, cuerdas) ?? norm
}

/**
 * Residuos en PÍXELES de la homografía (metros -> píxeles = G): para cada nodo, dónde cae menos dónde se marcó (2
 * números); para cada punto de corchera, su distancia a la recta en que G convierte esa corchera (1 número).
 * Un clic tiene el mismo error (unos píxeles) en cualquier parte de la imagen, así que medir en píxeles le da a cada
 * punto el peso justo. Medir en metros, o con el error algebraico de la DLT, les da demasiado peso a los nodos lejanos,
 * donde 5 m ocupan pocos píxeles y cualquier error de clic es enorme.
 */
function residuosPx(g: number[], pares: Par[], cuerdas: ParCuerda[]): number[] | null {
  const G: Matriz3 = [
    [g[0], g[1], g[2]],
    [g[3], g[4], g[5]],
    [g[6], g[7], 1],
  ]
  const H = invertir(G)
  if (!H) return null
  const r: number[] = []
  for (const p of pares) {
    const q = aplicar(G, p.mundo)
    if (!q) return null
    r.push(q[0] - p.px[0], q[1] - p.px[1])
  }
  for (const c of cuerdas) {
    // la corchera es la recta y = c.y de la piscina; en la imagen es l = Hᵀ·(0, 1, -y)
    const l = [0, 1, 2].map((j) => H[1][j] - c.y * H[2][j])
    const n = Math.hypot(l[0], l[1])
    if (n < 1e-15) return null
    r.push((l[0] * c.px[0] + l[1] * c.px[1] + l[2]) / n)
  }
  return r.every(Number.isFinite) ? r : null
}

const sumaCuadrados = (r: number[]) => r.reduce((s, v) => s + v * v, 0)

/** Resuelve A·x = b (A simétrica, chica) por eliminación de Gauss con pivoteo. null si es singular. */
function resolver(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((f, i) => [...f, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let f = c + 1; f < n; f++) if (Math.abs(M[f][c]) > Math.abs(M[p][c])) p = f
    if (Math.abs(M[p][c]) < 1e-300) return null
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let f = c + 1; f < n; f++) {
      const k = M[f][c] / M[c][c]
      for (let j = c; j <= n; j++) M[f][j] -= k * M[c][j]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let f = n - 1; f >= 0; f--) {
    let s = M[f][n]
    for (let j = f + 1; j < n; j++) s -= M[f][j] * x[j]
    x[f] = s / M[f][f]
  }
  return x.every(Number.isFinite) ? x : null
}

/**
 * Minimiza la suma de cuadrados de `residuos(p)` partiendo de p0 (Levenberg-Marquardt con jacobiano numérico: son
 * pocos parámetros). Devuelve null si no se puede evaluar; si no logra mejorar, devuelve p0.
 */
function minimizar(p0: number[], residuos: (p: number[]) => number[] | null): number[] | null {
  const n = p0.length
  let p = p0.slice()
  let r = residuos(p)
  if (!r) return null
  let costo = sumaCuadrados(r)
  let lambda = 1e-3

  for (let iter = 0; iter < 60; iter++) {
    const J: number[][] = r.map(() => new Array<number>(n).fill(0))
    for (let k = 0; k < n; k++) {
      const h = 1e-7 * Math.max(Math.abs(p[k]), 1e-6)
      const pm = p.slice()
      pm[k] += h
      const rk = residuos(pm)
      if (!rk) return null
      for (let i = 0; i < r.length; i++) J[i][k] = (rk[i] - r[i]) / h
    }
    const JtJ = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (__, b) => J.reduce((s, f) => s + f[a] * f[b], 0)))
    const Jtr = Array.from({ length: n }, (_, a) => J.reduce((s, f, i) => s + f[a] * r![i], 0))

    let mejoro = false
    for (let intento = 0; intento < 10 && !mejoro; intento++) {
      const A = JtJ.map((f, a) => f.map((v, b) => (a === b ? v * (1 + lambda) : v)))
      const paso = resolver(A, Jtr.map((v) => -v))
      if (!paso) {
        lambda *= 10
        continue
      }
      const pn = p.map((v, k) => v + paso[k])
      const rn = residuos(pn)
      const cn = rn ? sumaCuadrados(rn) : Infinity
      if (cn < costo) {
        const relativo = (costo - cn) / Math.max(costo, 1e-30)
        p = pn
        r = rn!
        costo = cn
        lambda = Math.max(lambda / 10, 1e-12)
        mejoro = true
        if (relativo < 1e-12) iter = Infinity // ya no cambia: listo
      } else {
        lambda *= 10
      }
    }
    if (!mejoro) break
  }
  return p
}

/**
 * Ajusta la homografía para que el error en píxeles sea el mínimo (sobre los 8 números de la homografía
 * metros -> píxeles, partiendo de la DLT). Si no logra mejorar, devuelve null y se usa la DLT.
 */
function refinar(H0: Matriz3, pares: Par[], cuerdas: ParCuerda[]): Matriz3 | null {
  const G0 = invertir(H0)
  if (!G0 || Math.abs(G0[2][2]) < 1e-15) return null
  const g = minimizar(
    G0.flat().map((v) => v / G0[2][2]).slice(0, 8),
    (p) => residuosPx(p, pares, cuerdas),
  )
  if (!g) return null
  const H = invertir([
    [g[0], g[1], g[2]],
    [g[3], g[4], g[5]],
    [g[6], g[7], 1],
  ])
  if (!H || Math.abs(H[2][2]) < 1e-15) return null
  const norm = H.map((f) => f.map((v) => v / H[2][2])) as Matriz3
  return norm.flat().every(Number.isFinite) ? norm : null
}

/** Distancia (en metros) entre donde cae cada punto marcado y donde debería estar. */
export function erroresDeAjuste(H: Matriz3, pares: Par[]): number[] {
  return pares.map((p) => {
    const q = aplicar(H, p.px)
    return q ? Math.hypot(q[0] - p.mundo[0], q[1] - p.mundo[1]) : Infinity
  })
}

// ---------------------------------------------------------------- curvatura del lente

/**
 * Curvatura del lente (distorsión radial, modelo de un parámetro): un lente gran angular "abomba" la imagen, y lo que
 * es recto en la piscina se ve curvo cerca de los bordes. Para pasar de lo que se ve a lo que vería una cámara sin
 * curvatura: p' = c + (p - c)·(1 + k1·r²), con r = |p - c| / escala (c = centro de la imagen, escala = media diagonal).
 * k1 > 0 corrige el "barril" típico de los gran angulares.
 */
export type Distorsion = { k1: number; centro: Punto; escala: number }

export function distorsionPara(ancho: number, alto: number, k1: number): Distorsion {
  return { k1, centro: [ancho / 2, alto / 2], escala: Math.hypot(ancho, alto) / 2 }
}

/** De un punto de la imagen (como se ve) a donde estaría sin la curvatura del lente. */
export function corregir(d: Distorsion | null, [x, y]: Punto): Punto {
  if (!d || d.k1 === 0) return [x, y]
  const dx = x - d.centro[0]
  const dy = y - d.centro[1]
  const f = 1 + d.k1 * ((dx * dx + dy * dy) / (d.escala * d.escala))
  return [d.centro[0] + dx * f, d.centro[1] + dy * f]
}

/** Lo inverso: de un punto sin curvatura a dónde se ve en la imagen (para dibujar). */
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

/** Si la curvatura corrige menos que esto, no vale la pena (y se deja en 0). */
const K1_MINIMO = 0.01
/** La curvatura buscada no pasa de esto (más sería otro tipo de lente, o puntos mal marcados). */
const K1_MAXIMO = 0.6

/**
 * Calibración completa: homografía y curvatura del lente juntas. La curvatura se estima solo si hay puntos sobre las
 * corcheras (rectas largas que llegan a los bordes, donde se nota) y el tamaño de la imagen; si no, queda en 0.
 * La homografía que devuelve trabaja sobre puntos ya corregidos: metros = H · corregir(px).
 */
export function estimarCalibracion(
  pares: Par[],
  cuerdas: ParCuerda[] = [],
  tam?: [number, number],
): { H: Matriz3; distorsion: Distorsion | null } | null {
  const H0 = estimarHomografia(pares, cuerdas)
  if (!H0) return null
  if (!tam || cuerdas.length < 6) return { H: H0, distorsion: null }

  const G0 = invertir(H0)
  if (!G0 || Math.abs(G0[2][2]) < 1e-15) return { H: H0, distorsion: null }
  const g0 = G0.flat().map((v) => v / G0[2][2]).slice(0, 8)
  const base = distorsionPara(tam[0], tam[1], 0)
  const residuos = (p: number[]) => {
    const d: Distorsion = { ...base, k1: Math.max(-K1_MAXIMO, Math.min(K1_MAXIMO, p[8])) }
    const r = residuosPx(
      p.slice(0, 8),
      pares.map((x) => ({ px: corregir(d, x.px), mundo: x.mundo })),
      cuerdas.map((c) => ({ px: corregir(d, c.px), y: c.y })),
    )
    // un poco de "resistencia" a curvar sin motivo: 0,1 de curvatura cuesta como 1 px de error
    return r ? [...r, p[8] * 10] : null
  }
  const p = minimizar([...g0, 0], residuos)
  if (!p || Math.abs(p[8]) < K1_MINIMO || Math.abs(p[8]) >= K1_MAXIMO) return { H: H0, distorsion: null }

  const G = [
    [p[0], p[1], p[2]],
    [p[3], p[4], p[5]],
    [p[6], p[7], 1],
  ] as Matriz3
  const H = invertir(G)
  if (!H || Math.abs(H[2][2]) < 1e-15) return { H: H0, distorsion: null }
  return { H: H.map((f) => f.map((v) => v / H[2][2])) as Matriz3, distorsion: { ...base, k1: p[8] } }
}

/** Para cada punto de corchera: a cuántos metros (a lo ancho) de su corchera lo pone la homografía. */
export function erroresDeCuerdas(H: Matriz3, cuerdas: ParCuerda[]): number[] {
  return cuerdas.map((c) => {
    const q = aplicar(H, c.px)
    return q ? Math.abs(q[1] - c.y) : Infinity
  })
}

export function rmse(errores: number[]): number {
  if (errores.length === 0) return 0
  return Math.sqrt(errores.reduce((s, e) => s + e * e, 0) / errores.length)
}

/**
 * Validación cruzada "dejar uno afuera": calcula la homografía sin cada punto y mide qué tan lejos
 * cae ese punto. Es un error más honesto que el de ajuste (con 4 puntos el ajuste siempre da 0).
 * Devuelve un error por punto, o null si hay menos de 5 puntos. Los puntos de corchera se usan siempre.
 */
export function validacionCruzada(pares: Par[], cuerdas: ParCuerda[] = []): (number | null)[] | null {
  if (pares.length < 5) return null
  return pares.map((_, i) => {
    const resto = pares.filter((__, j) => j !== i)
    const H = estimarHomografia(resto, cuerdas)
    if (!H) return null
    const q = aplicar(H, pares[i].px)
    return q ? Math.hypot(q[0] - pares[i].mundo[0], q[1] - pares[i].mundo[1]) : null
  })
}
