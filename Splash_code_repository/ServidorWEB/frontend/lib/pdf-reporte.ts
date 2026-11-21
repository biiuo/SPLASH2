// El reporte de rendimiento en PDF: título, indicadores, una gráfica de líneas (la evolución) y tablas. Lo usan el reporte
// grupal y el individual del entrenador/administrador y el de «Mi progreso» del nadador: cada uno arma los datos y esto
// los dibuja. Se descarga directamente como .pdf (sin diálogo de impresión).
import { A4, type Color, type Fuente, Pagina, ajustar, anchoTexto, construirPdf, limpiar } from './pdf'

export type ColumnaPdf = { texto: string; /** ancho relativo */ peso: number; alinear?: 'izq' | 'der' }
export type TablaPdf = { titulo: string; columnas: ColumnaPdf[]; filas: string[][]; vacio?: string }
export type GraficaPdf = {
  titulo: string
  /** Texto del eje vertical (la unidad). */
  etiquetaY: string
  puntos: { x: number; y: number }[]
  /** Marcas del eje horizontal, con el mismo x de los puntos. */
  marcasX: { x: number; texto: string }[]
}
export type ReportePdf = {
  titulo: string
  subtitulo?: string
  kpis: { etiqueta: string; valor: string }[]
  grafica?: GraficaPdf
  tablas: TablaPdf[]
  notas?: string[]
}

const MARGEN = 40
const ANCHO = A4.ancho - MARGEN * 2
const ABAJO = A4.alto - 56 // hasta dónde llega el contenido (debajo va el pie)
const AZUL: Color = [0.145, 0.388, 0.922]
const GRIS: Color = [0.39, 0.45, 0.55]
const CLARO: Color = [0.945, 0.961, 0.976]
const LINEA: Color = [0.886, 0.91, 0.941]

/** Parte un texto en líneas que quepan en `ancho` puntos. */
function envolver(texto: string, ancho: number, tamano: number, fuente: Fuente = 'normal'): string[] {
  const lineas: string[] = []
  let actual = ''
  for (const palabra of limpiar(texto).split(/\s+/)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra
    if (actual && anchoTexto(prueba, tamano, fuente) > ancho) {
      lineas.push(actual)
      actual = palabra
    } else actual = prueba
  }
  if (actual) lineas.push(actual)
  return lineas
}

/** Un máximo «redondo» para el eje vertical. */
function techo(max: number): number {
  if (max <= 0) return 1
  const paso = 10 ** Math.floor(Math.log10(max))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * paso >= max) return m * paso
  return max
}

export function pdfDeReporte(r: ReportePdf, generado = new Date()): Uint8Array {
  const paginas: Pagina[] = []
  let p = new Pagina()
  let y = MARGEN
  const nueva = () => {
    p = new Pagina()
    paginas.push(p)
    y = MARGEN
  }
  paginas.push(p)
  const hay = (alto: number) => {
    if (y + alto > ABAJO) nueva()
  }

  // encabezado
  p.rect(MARGEN, y, 4, 34, AZUL)
  p.texto(MARGEN + 14, y + 16, r.titulo, 19, { fuente: 'negrita' })
  if (r.subtitulo) p.texto(MARGEN + 14, y + 32, r.subtitulo, 10, { c: GRIS })
  y += 54

  // indicadores
  if (r.kpis.length) {
    const n = r.kpis.length
    const gap = 8
    const w = (ANCHO - gap * (n - 1)) / n
    r.kpis.forEach((k, i) => {
      const x = MARGEN + i * (w + gap)
      p.rect(x, y, w, 46, CLARO)
      p.texto(x + 10, y + 16, ajustar(k.etiqueta, w - 16, 8), 8, { c: GRIS })
      p.texto(x + 10, y + 36, ajustar(k.valor, w - 16, 15, 'negrita'), 15, { fuente: 'negrita' })
    })
    y += 62
  }

  // gráfica de líneas
  if (r.grafica) {
    const g = r.grafica
    const alto = 170
    hay(alto + 40)
    p.texto(MARGEN, y + 10, g.titulo, 11, { fuente: 'negrita' })
    y += 22
    const izq = MARGEN + 34
    const ancho = ANCHO - 34 - 8
    const arriba = y + 6
    const base = y + alto - 22
    if (g.puntos.length === 0) {
      p.texto(MARGEN, y + 40, 'Todavía no hay datos suficientes para la gráfica.', 9, { c: GRIS })
    } else {
      const maxY = techo(Math.max(...g.puntos.map((q) => q.y)) * 1.08)
      const xs = g.puntos.map((q) => q.x)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const px = (x: number) => (maxX === minX ? izq + ancho / 2 : izq + ((x - minX) / (maxX - minX)) * ancho)
      const py = (v: number) => base - (v / maxY) * (base - arriba)
      for (let i = 0; i <= 4; i++) {
        const v = (maxY * i) / 4
        p.linea(izq, py(v), izq + ancho, py(v), 0.5, LINEA)
        p.texto(MARGEN, py(v) + 3, v.toFixed(maxY < 5 ? 2 : 1), 8, { c: GRIS, alinear: 'der', ancho: 28 })
      }
      for (const m of g.marcasX) p.texto(px(m.x) - 24, base + 13, m.texto, 8, { c: GRIS, alinear: 'centro', ancho: 48 })
      const ordenados = [...g.puntos].sort((a, b) => a.x - b.x)
      p.ruta(ordenados.map((q) => [px(q.x), py(q.y)]), 1.6, AZUL, true)
      p.texto(izq, arriba - 1, g.etiquetaY, 8, { c: GRIS })
    }
    y += alto + 6
  }

  // tablas
  for (const t of r.tablas) {
    const filaAlto = 17
    hay(60)
    p.texto(MARGEN, y + 10, t.titulo, 11, { fuente: 'negrita' })
    y += 18
    const suma = t.columnas.reduce((a, c) => a + c.peso, 0)
    const anchos = t.columnas.map((c) => (c.peso / suma) * ANCHO)
    const encabezado = () => {
      p.rect(MARGEN, y, ANCHO, filaAlto, CLARO)
      let x = MARGEN
      t.columnas.forEach((c, i) => {
        p.texto(x + 5, y + 12, ajustar(c.texto, anchos[i] - 10, 8, 'negrita'), 8, { fuente: 'negrita', c: GRIS, alinear: c.alinear === 'der' ? 'der' : 'izq', ancho: anchos[i] - 10 })
        x += anchos[i]
      })
      y += filaAlto
    }
    if (t.filas.length === 0) {
      p.texto(MARGEN, y + 10, t.vacio ?? 'Sin datos en el período.', 9, { c: GRIS })
      y += 28
      continue
    }
    hay(filaAlto * 2 + 8)
    encabezado()
    t.filas.forEach((fila, k) => {
      if (y + filaAlto > ABAJO) {
        nueva()
        p.texto(MARGEN, y + 10, `${t.titulo} (continuación)`, 9, { c: GRIS })
        y += 16
        encabezado()
      }
      if (k % 2 === 1) p.rect(MARGEN, y, ANCHO, filaAlto, [0.98, 0.984, 0.99])
      let x = MARGEN
      fila.forEach((celda, i) => {
        const col = t.columnas[i]
        p.texto(x + 5, y + 12, ajustar(celda, anchos[i] - 10, 9), 9, { alinear: col?.alinear === 'der' ? 'der' : 'izq', ancho: anchos[i] - 10 })
        x += anchos[i]
      })
      y += filaAlto
    })
    p.linea(MARGEN, y, MARGEN + ANCHO, y, 0.5, LINEA)
    y += 22
  }

  // notas
  for (const nota of r.notas ?? []) {
    const lineas = envolver(nota, ANCHO, 8)
    hay(lineas.length * 11 + 6)
    for (const l of lineas) {
      p.texto(MARGEN, y + 8, l, 8, { c: GRIS })
      y += 11
    }
    y += 6
  }

  const fecha = generado.toLocaleString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return construirPdf(paginas, r.titulo, (n, total, pagina) => {
    pagina.linea(MARGEN, A4.alto - 40, MARGEN + ANCHO, A4.alto - 40, 0.5, LINEA)
    pagina.texto(MARGEN, A4.alto - 26, `SafeSplash · Reporte generado el ${fecha}`, 8, { c: GRIS })
    pagina.texto(MARGEN, A4.alto - 26, `Página ${n} de ${total}`, 8, { c: GRIS, alinear: 'der', ancho: ANCHO })
  })
}

/** Genera el reporte y lo descarga como archivo .pdf. */
export function descargarPdf(nombre: string, r: ReportePdf) {
  const bytes = pdfDeReporte(r)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
