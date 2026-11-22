// Un escritor de PDF mínimo, sin dependencias: texto (Helvetica, la fuente estándar de todo lector de PDF), líneas,
// rectángulos y rutas, en páginas A4. Alcanza para los reportes de SafeSplash (títulos, tablas y una gráfica de líneas).
// El texto se escribe en WinAnsi (el español completo: tildes, ñ, ¿, ¡); lo que no existe en esa tabla se reemplaza.

export const A4 = { ancho: 595.28, alto: 841.89 }

export type Color = [number, number, number]
export type Fuente = 'normal' | 'negrita'

// anchos (milésimas de em) de Helvetica y Helvetica-Bold para los códigos ASCII 32..126, de sus tablas AFM oficiales
const ANCHOS: Record<Fuente, number[]> = {
  normal: [278,278,355,556,556,889,667,222,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,222,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584],
  negrita: [278,333,474,556,556,889,722,278,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,278,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584],
}
const ESPECIALES: Record<string, number> = { '¿': 611, '¡': 333, '–': 556, '—': 1000, '•': 350, '°': 400, '×': 584, '·': 278, '…': 1000 }

/** Pasa el texto a lo que sí existe en WinAnsi (el resto se reemplaza por algo parecido). */
export function limpiar(texto: string): string {
  return texto
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\u202f\u00a0]/g, ' ') // espacios finos de toLocaleString
    .replace(/[^\u0020-\u007e\u00a1-\u00ff–—•…]/g, '?')
}

function anchoCaracter(c: string, fuente: Fuente): number {
  const code = c.charCodeAt(0)
  if (code >= 32 && code <= 126) return ANCHOS[fuente][code - 32]
  if (ESPECIALES[c] !== undefined) return ESPECIALES[c]
  const base = c.normalize('NFD')[0] // á -> a: en Helvetica llevan el mismo ancho
  const b = base.charCodeAt(0)
  return b >= 32 && b <= 126 ? ANCHOS[fuente][b - 32] : 556
}

/** Ancho del texto en puntos para ese tamaño. */
export function anchoTexto(texto: string, tamano: number, fuente: Fuente = 'normal'): number {
  let u = 0
  for (const c of limpiar(texto)) u += anchoCaracter(c, fuente)
  return (u * tamano) / 1000
}

/** Recorta con «...» hasta que quepa en `ancho` puntos. */
export function ajustar(texto: string, ancho: number, tamano: number, fuente: Fuente = 'normal'): string {
  const t = limpiar(texto)
  if (anchoTexto(t, tamano, fuente) <= ancho) return t
  let corto = t
  while (corto.length > 1 && anchoTexto(corto + '...', tamano, fuente) > ancho) corto = corto.slice(0, -1)
  return corto + '...'
}

const num = (n: number) => (Math.round(n * 100) / 100).toString()
const color = ([r, g, b]: Color) => `${num(r)} ${num(g)} ${num(b)}`

/** Una página: las operaciones se guardan como texto del flujo de contenido. y se mide hacia ABAJO desde el borde de arriba. */
export class Pagina {
  readonly ops: string[] = []

  texto(
    x: number,
    y: number,
    texto: string,
    tamano: number,
    { fuente = 'normal', c = [0.06, 0.09, 0.16], alinear = 'izq', ancho = 0 }: { fuente?: Fuente; c?: Color; alinear?: 'izq' | 'der' | 'centro'; ancho?: number } = {},
  ) {
    const t = limpiar(texto).replace(/[\\()]/g, (m) => '\\' + m)
    let px = x
    if (alinear !== 'izq') {
      const w = anchoTexto(texto, tamano, fuente)
      px = alinear === 'der' ? x + ancho - w : x + (ancho - w) / 2
    }
    // los caracteres de 0x80 a 0xff van como bytes de WinAnsi: se escriben con escapes octales
    let literal = ''
    for (const ch of t) {
      const code = ch.charCodeAt(0)
      if (ch === '–') literal += '\\226'
      else if (ch === '—') literal += '\\227'
      else if (ch === '•') literal += '\\225'
      else if (ch === '…') literal += '\\205'
      else if (code > 126) literal += '\\' + code.toString(8).padStart(3, '0')
      else literal += ch
    }
    this.ops.push(`BT /${fuente === 'negrita' ? 'F2' : 'F1'} ${num(tamano)} Tf ${color(c)} rg ${num(px)} ${num(A4.alto - y)} Td (${literal}) Tj ET`)
  }

  linea(x1: number, y1: number, x2: number, y2: number, grosor = 0.5, c: Color = [0.8, 0.84, 0.9]) {
    this.ops.push(`${color(c)} RG ${num(grosor)} w ${num(x1)} ${num(A4.alto - y1)} m ${num(x2)} ${num(A4.alto - y2)} l S`)
  }

  rect(x: number, y: number, w: number, h: number, relleno: Color) {
    this.ops.push(`${color(relleno)} rg ${num(x)} ${num(A4.alto - y - h)} ${num(w)} ${num(h)} re f`)
  }

  /** Una línea quebrada (y con ella, puntos opcionales). */
  ruta(puntos: [number, number][], grosor: number, c: Color, conPuntos = false) {
    if (!puntos.length) return
    const p = puntos.map(([x, y]) => [x, A4.alto - y] as const)
    if (p.length > 1) {
      this.ops.push(`${color(c)} RG ${num(grosor)} w 1 J 1 j ${num(p[0][0])} ${num(p[0][1])} m ${p.slice(1).map(([x, y]) => `${num(x)} ${num(y)} l`).join(' ')} S`)
    }
    if (conPuntos || p.length === 1) for (const [x, y] of p) this.rect(x - 2.2, A4.alto - y - 2.2, 4.4, 4.4, c)
  }
}

/** Arma el archivo PDF con sus páginas (cada una recibe su pie con «Página n de N» vía `pie`). */
export function construirPdf(paginas: Pagina[], titulo: string, pie?: (n: number, total: number, p: Pagina) => void): Uint8Array {
  paginas.forEach((p, i) => pie?.(i + 1, paginas.length, p))
  const codificador = new TextEncoder()
  const trozos: Uint8Array[] = []
  const offsets: number[] = []
  let largo = 0
  const poner = (s: string) => {
    // el contenido ya es ASCII (los acentos van como escapes octales), salvo el título, que se limpia
    const b = codificador.encode(s)
    trozos.push(b)
    largo += b.length
  }
  const objeto = (id: number, cuerpo: string) => {
    offsets[id] = largo
    poner(`${id} 0 obj\n${cuerpo}\nendobj\n`)
  }

  // objetos: 1 catálogo, 2 páginas, 3 y 4 fuentes, 5 info; luego, por página, la página y su contenido
  poner('%PDF-1.4\n')
  objeto(1, '<< /Type /Catalog /Pages 2 0 R >>')
  const ids = paginas.map((_, i) => 6 + i * 2)
  objeto(2, `<< /Type /Pages /Kids [${ids.map((id) => `${id} 0 R`).join(' ')}] /Count ${paginas.length} >>`)
  objeto(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  objeto(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  // el título va como cadena UTF-16 (con su marca FEFF), para que los acentos se lean bien en las propiedades del archivo
  const tituloHex = 'FEFF' + [...titulo].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')
  objeto(5, `<< /Title <${tituloHex}> /Producer (SafeSplash) >>`)
  paginas.forEach((p, i) => {
    const flujo = p.ops.join('\n')
    objeto(ids[i], `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.ancho} ${A4.alto}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${ids[i] + 1} 0 R >>`)
    objeto(ids[i] + 1, `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`)
  })
  const total = 6 + paginas.length * 2
  const inicioXref = largo
  poner(`xref\n0 ${total}\n0000000000 65535 f \n`)
  for (let id = 1; id < total; id++) poner(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  poner(`trailer\n<< /Size ${total} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`)

  const salida = new Uint8Array(largo)
  let p = 0
  for (const t of trozos) {
    salida.set(t, p)
    p += t.length
  }
  return salida
}
