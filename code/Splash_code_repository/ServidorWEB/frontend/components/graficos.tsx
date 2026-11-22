'use client'

// Gráficos en SVG a mano (sin librerías): barras verticales y líneas con puntos. Un solo color de serie (el azul de la
// app). Lo ESTIMADO se distingue con rayado/punto hueco naranja + leyenda, nunca solo con el color. Cada barra o
// punto muestra su detalle al pasar el mouse o con el teclado (Tab); los mismos datos están en las tablas.
import { useId, useState } from 'react'

const AZUL = '#2563EB'
const NARANJA = '#C2410C'
const NARANJA_FONDO = '#FFF7ED'
const GRILLA = '#E2E8F0'
const EJE = '#CBD5E1'
const TEXTO_SUAVE = '#64748B'
const TEXTO = '#0F172A'
const SUPERFICIE = '#FFFFFF'

const W = 640
const H = 260
const M = { izq: 52, der: 16, arr: 18, abj: 38 }
const ANCHO = W - M.izq - M.der
const ALTO = H - M.arr - M.abj

/** Un máximo "redondo" para un eje y el paso entre sus marcas. */
export function escala(max: number, marcas = 4): { tope: number; paso: number } {
  const crudo = Math.max(max, 1e-6) / marcas
  const mag = 10 ** Math.floor(Math.log10(crudo))
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((p) => p >= crudo) ?? 10 * mag
  return { tope: Math.ceil(max / paso - 1e-9) * paso || paso, paso }
}

const redondo = (v: number) => Math.round(v * 1e6) / 1e6

type Punta = { x: number; y: number; lineas: string[] }

function Tooltip({ punta }: { punta: Punta | null }) {
  if (!punta) return null
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{ left: `${(punta.x / W) * 100}%`, top: `calc(${(punta.y / H) * 100}% - 10px)` }}
    >
      <p className="text-sm font-semibold text-slate-900">{punta.lineas[0]}</p>
      {punta.lineas.slice(1).map((l) => (
        <p key={l} className="whitespace-nowrap text-slate-500">{l}</p>
      ))}
    </div>
  )
}

function Rayado({ id }: { id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill={NARANJA_FONDO} />
      <line x1="0" y1="0" x2="0" y2="6" stroke={NARANJA} strokeWidth="2.5" />
    </pattern>
  )
}

/** Leyenda: solo si hay estimados (con una sola serie medida, el título ya dice qué se grafica). */
function Leyenda({ forma }: { forma: 'barra' | 'punto' }) {
  const id = useId().replace(/:/g, '')
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1.5">
        {forma === 'barra' ? (
          <span className="inline-block size-3 rounded-sm" style={{ background: AZUL }} />
        ) : (
          <span className="inline-block size-2.5 rounded-full" style={{ background: AZUL }} />
        )}
        Detectado
      </span>
      <span className="inline-flex items-center gap-1.5">
        {forma === 'barra' ? (
          <svg width="12" height="12" aria-hidden="true">
            <defs><Rayado id={`l${id}`} /></defs>
            <rect width="12" height="12" rx="2" fill={`url(#l${id})`} />
          </svg>
        ) : (
          <span className="inline-block size-2.5 rounded-full border-2" style={{ borderColor: NARANJA, background: SUPERFICIE }} />
        )}
        Estimado (no confirmado)
      </span>
    </div>
  )
}

function EjeY({ tope, paso, formato, y }: { tope: number; paso: number; formato: (v: number) => string; y: (v: number) => number }) {
  return (
    <>
      {Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => redondo(i * paso)).map((v) => (
        <g key={v}>
          <line x1={M.izq} x2={W - M.der} y1={y(v)} y2={y(v)} stroke={GRILLA} strokeWidth="1" />
          <text x={M.izq - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill={TEXTO_SUAVE}>{formato(v)}</text>
        </g>
      ))}
    </>
  )
}

function Hit(props: { etiqueta: string; mostrar: () => void; ocultar: () => void } & React.SVGProps<SVGRectElement> & { circulo?: { cx: number; cy: number; r: number } }) {
  const { etiqueta, mostrar, ocultar, circulo, ...resto } = props
  const comun = {
    fill: 'transparent',
    tabIndex: 0,
    'aria-label': etiqueta,
    onPointerEnter: mostrar,
    onFocus: mostrar,
    onPointerLeave: ocultar,
    onBlur: ocultar,
    className: 'outline-none focus-visible:stroke-blue-400 focus-visible:stroke-2',
  }
  return circulo ? <circle {...circulo} {...comun} /> : <rect {...resto} {...comun} />
}

export type DatoBarra = { clave: string; etiqueta: string; valor: number; estimado?: boolean; detalle: string[] }

/** Barras verticales desde una línea base (0). `destacar`: la clave de la barra que lleva su valor escrito. */
export function Barras({
  datos,
  formatoY,
  etiquetaX,
  descripcion,
  referencia,
  destacar,
}: {
  datos: DatoBarra[]
  formatoY: (v: number) => string
  etiquetaX: string
  descripcion: string
  referencia?: { valor: number; etiqueta: string }
  destacar?: string
}) {
  const [punta, setPunta] = useState<Punta | null>(null)
  const idRayado = `r${useId().replace(/:/g, '')}`
  if (!datos.length) return null
  const { tope, paso } = escala(Math.max(...datos.map((d) => d.valor), referencia?.valor ?? 0))
  const y = (v: number) => M.arr + ALTO - (v / tope) * ALTO
  const banda = ANCHO / datos.length
  const barra = Math.min(24, Math.max(2, banda - 2) * 0.7)
  const cada = Math.ceil(datos.length / 14)

  return (
    <div className="relative">
      {datos.some((d) => d.estimado) && <Leyenda forma="barra" />}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={descripcion}>
        <defs><Rayado id={idRayado} /></defs>
        <EjeY tope={tope} paso={paso} formato={formatoY} y={y} />
        {datos.map((d, i) => {
          const cx = M.izq + banda * (i + 0.5)
          const x0 = cx - barra / 2
          const y0 = y(d.valor)
          const base = y(0)
          const r = Math.min(4, (base - y0) / 2, barra / 2)
          const camino = `M${x0},${base} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + barra - r} Q${x0 + barra},${y0} ${x0 + barra},${y0 + r} V${base} Z`
          const mostrar = () => setPunta({ x: cx, y: y0, lineas: d.detalle })
          return (
            <g key={d.clave}>
              <path d={camino} fill={d.estimado ? `url(#${idRayado})` : AZUL} />
              {d.clave === destacar && (
                <text x={cx} y={y0 - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill={TEXTO}>{formatoY(d.valor)}</text>
              )}
              {i % cada === 0 && (
                <text x={cx} y={H - M.abj + 16} textAnchor="middle" fontSize="11" fill={TEXTO_SUAVE}>{d.etiqueta}</text>
              )}
              <Hit x={M.izq + banda * i} y={M.arr} width={banda} height={ALTO} etiqueta={d.detalle.join(', ')} mostrar={mostrar} ocultar={() => setPunta(null)} />
            </g>
          )
        })}
        {referencia && referencia.valor > 0 && (
          <g pointerEvents="none">
            <line x1={M.izq} x2={W - M.der} y1={y(referencia.valor)} y2={y(referencia.valor)} stroke="#94A3B8" strokeWidth="1" />
            <text x={W - M.der} y={y(referencia.valor) - 5} textAnchor="end" fontSize="11" fill={TEXTO_SUAVE}>{referencia.etiqueta}</text>
          </g>
        )}
        <line x1={M.izq} x2={W - M.der} y1={y(0)} y2={y(0)} stroke={EJE} strokeWidth="1" />
        <text x={M.izq + ANCHO / 2} y={H - 4} textAnchor="middle" fontSize="11" fill={TEXTO_SUAVE}>{etiquetaX}</text>
      </svg>
      <Tooltip punta={punta} />
    </div>
  )
}

export type PuntoLinea = { clave: string; x: number; y: number; estimado?: boolean; detalle: string[] }

/**
 * Línea con un punto por dato. `marcasX`: dónde van las etiquetas del eje X (con su texto). `inicio`: un punto sin
 * marcador donde arranca la línea (por ejemplo, 0 largos al empezar). `final`: texto junto al último punto.
 */
export function Linea({
  puntos,
  formatoY,
  marcasX,
  etiquetaX,
  descripcion,
  inicio,
  final,
  ejeYEntero = false,
}: {
  puntos: PuntoLinea[]
  formatoY: (v: number) => string
  marcasX: { x: number; texto: string }[]
  etiquetaX: string
  descripcion: string
  inicio?: { x: number; y: number }
  final?: string
  ejeYEntero?: boolean
}) {
  const [punta, setPunta] = useState<Punta | null>(null)
  if (!puntos.length) return null
  const xs = [...puntos.map((p) => p.x), ...marcasX.map((m) => m.x), ...(inicio ? [inicio.x] : [])]
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const rango = xMax - xMin || 1
  let { tope, paso } = escala(Math.max(...puntos.map((p) => p.y)), Math.min(5, ejeYEntero ? Math.max(1, Math.max(...puntos.map((p) => p.y))) : 5))
  if (ejeYEntero) {
    paso = Math.max(1, Math.round(paso))
    tope = Math.ceil(tope / paso) * paso
  }
  // un margen a los costados para que los puntos de las puntas no queden pegados al eje
  const pad = puntos.length === 1 ? ANCHO / 2 : 10
  const x = (v: number) => M.izq + pad + ((v - xMin) / rango) * (ANCHO - 2 * pad)
  const y = (v: number) => M.arr + ALTO - (v / tope) * ALTO
  const camino = [...(inicio ? [inicio] : []), ...puntos].map((p) => `${x(p.x)},${y(p.y)}`).join(' ')
  const ultimo = puntos[puntos.length - 1]

  return (
    <div className="relative">
      {puntos.some((p) => p.estimado) && <Leyenda forma="punto" />}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={descripcion}>
        <EjeY tope={tope} paso={paso} formato={formatoY} y={y} />
        {marcasX.map((m) => (
          <text key={m.x} x={x(m.x)} y={H - M.abj + 16} textAnchor="middle" fontSize="11" fill={TEXTO_SUAVE}>{m.texto}</text>
        ))}
        <line x1={M.izq} x2={W - M.der} y1={y(0)} y2={y(0)} stroke={EJE} strokeWidth="1" />
        <text x={M.izq + ANCHO / 2} y={H - 4} textAnchor="middle" fontSize="11" fill={TEXTO_SUAVE}>{etiquetaX}</text>
        {puntos.length > 1 || inicio ? (
          <polyline points={camino} fill="none" stroke={AZUL} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        {puntos.map((p) => {
          const px = x(p.x)
          const py = y(p.y)
          const mostrar = () => setPunta({ x: px, y: py, lineas: p.detalle })
          return (
            <g key={p.clave}>
              <circle cx={px} cy={py} r="7" fill={SUPERFICIE} />
              <circle cx={px} cy={py} r="4.5" fill={p.estimado ? SUPERFICIE : AZUL} stroke={p.estimado ? NARANJA : AZUL} strokeWidth="2" />
              <Hit circulo={{ cx: px, cy: py, r: 14 }} etiqueta={p.detalle.join(', ')} mostrar={mostrar} ocultar={() => setPunta(null)} />
            </g>
          )
        })}
        {final && (
          <text x={x(ultimo.x) - 10} y={y(ultimo.y) - 12} textAnchor="end" fontSize="11" fontWeight="600" fill={TEXTO} pointerEvents="none">{final}</text>
        )}
      </svg>
      <Tooltip punta={punta} />
    </div>
  )
}

/** Marcas "redondas" para un eje X numérico entre min y max. */
export function marcasLineales(min: number, max: number, formato: (v: number) => string, n = 5): { x: number; texto: string }[] {
  const { paso } = escala(max - min || 1, n)
  const desde = Math.ceil(min / paso) * paso
  const r: { x: number; texto: string }[] = []
  for (let v = desde; v <= max + 1e-9; v += paso) r.push({ x: redondo(v), texto: formato(redondo(v)) })
  return r
}
