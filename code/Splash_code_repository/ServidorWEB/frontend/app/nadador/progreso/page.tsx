'use client'

import { Activity, Gauge, TrendingUp, Waves } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ProgresoObjetivo } from '@/components/entrenador/progreso-objetivo'
import { api } from '@/lib/api'
import { useCuenta } from '@/lib/cuenta'
import { descargarPdf } from '@/lib/pdf-reporte'
import { cumplimiento } from '@/lib/objetivos'
import type { Objetivo } from '@/lib/tipos'

import { Barras, Linea } from '@/components/graficos'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, CAMPO, Kpi, Tarjeta, useMisSesiones } from '@/components/nadador/ui'
import { type FilaSesion, fechaCorta, formatearMetros, formatearSegundos, formatearVel, horaCorta, totales } from '@/lib/largos'
import { formatearDuracion } from '@/lib/resultados'

const DIA = 24 * 60 * 60 * 1000
type Periodo = '7' | '30' | '90' | 'personalizado'

const aDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const inicioDelDia = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const diaCorto = (t: number) => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

/** Mi progreso: cómo evoluciona el rendimiento entre sesiones (solo sesiones finalizadas). */
export default function MiProgreso() {
  const { filas, problema } = useMisSesiones()
  const [periodo, setPeriodo] = useState<Periodo>('30')
  const [desde, setDesde] = useState(() => aDia(new Date(Date.now() - 30 * DIA)))
  const [hasta, setHasta] = useState(() => aDia(new Date()))
  const [ahora, setAhora] = useState(() => Date.now())

  const rango = useMemo((): [number, number] => {
    if (periodo !== 'personalizado') return [inicioDelDia(ahora - (Number(periodo) - 1) * DIA), ahora]
    const a = Date.parse(`${desde}T00:00:00`)
    const b = Date.parse(`${hasta}T23:59:59`)
    return [Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : ahora]
  }, [periodo, desde, hasta, ahora])

  // en orden de fecha; las en curso no cuentan (sus métricas son parciales)
  const enRango = useMemo(
    () =>
      (filas ?? [])
        .filter((f) => f.sesion.estado === 'finalizada')
        .filter((f) => {
          const t = Date.parse(f.sesion.inicio)
          return t >= rango[0] && t <= rango[1]
        })
        .sort((a, b) => a.sesion.inicio.localeCompare(b.sesion.inicio)),
    [filas, rango],
  )
  const t = totales(enRango)
  const conVelocidad = enRango.filter((f) => f.velocidad_media_ms !== null)
  const nombre = useCuenta().usuario?.nombre ?? null

  /** Mi progreso del período, en PDF: indicadores, evolución de la velocidad sesión a sesión y la tabla de sesiones. */
  function descargarMiPdf() {
    const num2 = (v: number | null) => (v === null ? '—' : v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    const textoPeriodo = periodo === 'personalizado' ? `${desde} a ${hasta}` : `últimos ${periodo} días`
    descargarPdf(`safesplash_mi_progreso_${aDia(new Date())}.pdf`, {
      titulo: nombre ? `Mi progreso · ${nombre}` : 'Mi progreso · SafeSplash',
      subtitulo: `Período: ${textoPeriodo} · solo sesiones finalizadas`,
      kpis: [
        { etiqueta: 'Sesiones', valor: String(t.sesiones) },
        { etiqueta: 'Distancia total', valor: formatearMetros(t.distancia_m) },
        { etiqueta: 'Velocidad promedio', valor: t.velocidad_media_ms ? `${num2(t.velocidad_media_ms)} m/s` : '—' },
        { etiqueta: 'Mejor velocidad', valor: t.velocidad_max_ms ? `${num2(t.velocidad_max_ms)} m/s` : '—' },
        { etiqueta: 'Largos', valor: String(t.largos) },
      ],
      grafica: {
        titulo: 'Evolución de la velocidad promedio por sesión',
        etiquetaY: 'm/s',
        puntos: conVelocidad.map((f) => ({ x: Date.parse(f.sesion.inicio), y: f.velocidad_media_ms as number })),
        marcasX: conVelocidad
          .filter((_, i) => i % Math.max(1, Math.ceil(conVelocidad.length / 6)) === 0)
          .map((f) => ({ x: Date.parse(f.sesion.inicio), texto: diaCorto(Date.parse(f.sesion.inicio)) })),
      },
      tablas: [
        {
          titulo: 'Mis sesiones',
          columnas: [{ texto: 'Fecha', peso: 1.8 }, { texto: 'Hora', peso: 1.1 }, { texto: 'Duración', peso: 1.2, alinear: 'der' }, { texto: 'Distancia', peso: 1.3, alinear: 'der' }, { texto: 'Vel. media (m/s)', peso: 1.5, alinear: 'der' }, { texto: 'Vel. máx. (m/s)', peso: 1.5, alinear: 'der' }, { texto: 'Largos', peso: 0.9, alinear: 'der' }, { texto: 'Mejor largo', peso: 1.3, alinear: 'der' }],
          filas: enRango.map((f) => [fechaCorta(f.sesion.inicio), horaCorta(f.sesion.inicio), f.duracion_s === null ? '—' : formatearDuracion(f.duracion_s * 1000), formatearMetros(f.distancia_m), num2(f.velocidad_media_ms), num2(f.velocidad_max_ms), String(f.largos), formatearSegundos(f.mejor_largo_s)]),
          vacio: 'No hay sesiones finalizadas en este período.',
        },
      ],
      notas: ['Las mediciones salen de la detección automática del sistema; en algún momento puede no verse al nadador (por ejemplo, tapado por la baranda del borde) y esa parte se estima.'],
    })
  }

  // distancia por día (hasta ~5 semanas) o por semana (lunes a domingo)
  const dias = (rango[1] - rango[0]) / DIA
  const porSemana = dias > 35
  const grupos = useMemo(() => {
    const m = new Map<number, number>()
    for (const f of enRango) {
      let k = inicioDelDia(Date.parse(f.sesion.inicio))
      if (porSemana) k -= ((new Date(k).getDay() + 6) % 7) * DIA
      m.set(k, (m.get(k) ?? 0) + f.distancia_m)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [enRango, porSemana])

  // marcas del eje de fechas: un puñado de días repartidos en el rango que tiene datos
  const marcasFechas = useMemo(() => {
    if (!conVelocidad.length) return []
    const a = inicioDelDia(Date.parse(conVelocidad[0].sesion.inicio))
    const b = inicioDelDia(Date.parse(conVelocidad[conVelocidad.length - 1].sesion.inicio))
    const paso = Math.max(1, Math.ceil((b - a) / DIA / 5)) * DIA
    const r: { x: number; texto: string }[] = []
    for (let x = a; x <= b; x += paso) r.push({ x, texto: diaCorto(x) })
    return r
  }, [conVelocidad])

  return (
    <>
      <Encabezado titulo="Mi progreso" bajada="Cómo evoluciona tu rendimiento entre sesiones. Solo cuentan las sesiones finalizadas." />

      {/* filtros de consulta */}
      <Tarjeta>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
            {(
              [
                ['7', 'Últimos 7 días'],
                ['30', 'Últimos 30 días'],
                ['90', 'Últimos 3 meses'],
                ['personalizado', 'Personalizado'],
              ] as [Periodo, string][]
            ).map(([v, texto]) => (
              <button key={v} onClick={() => { if (v !== periodo) setAhora(Date.now()); setPeriodo(v) }} aria-pressed={periodo === v} className={periodo === v ? BOTON.primario : BOTON.terciario}>
                {texto}
              </button>
            ))}
          </div>
          <button onClick={descargarMiPdf} disabled={!filas || enRango.length === 0} className={`${BOTON.secundario} sm:ml-auto`}>Descargar PDF</button>
          {periodo === 'personalizado' && (
            <div className="flex flex-wrap gap-3">
              <label className="text-sm text-[#64748B]">Desde<input type="date" value={desde} max={hasta} onChange={(e) => { setAhora(Date.now()); setDesde(e.target.value) }} className={CAMPO} /></label>
              <label className="text-sm text-[#64748B]">Hasta<input type="date" value={hasta} min={desde} onChange={(e) => { setAhora(Date.now()); setHasta(e.target.value) }} className={CAMPO} /></label>
            </div>
          )}
        </div>
      </Tarjeta>

      {problema && <div className="mt-6"><Aviso tipo="error">{problema}</Aviso></div>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icono={Waves} etiqueta="Distancia total" valor={filas ? Math.round(t.distancia_m).toLocaleString('es-CO') : '…'} unidad="m" />
        <Kpi icono={Gauge} etiqueta="Velocidad promedio" valor={t.velocidad_media_ms ? t.velocidad_media_ms.toFixed(2) : filas ? '—' : '…'} unidad="m/s" />
        <Kpi icono={TrendingUp} etiqueta="Mejor velocidad" valor={t.velocidad_max_ms ? t.velocidad_max_ms.toFixed(2) : filas ? '—' : '…'} unidad="m/s" nota="mejor largo detectado" />
        <Kpi icono={Activity} etiqueta="Sesiones" valor={filas ? String(t.sesiones) : '…'} />
      </div>

      {filas && enRango.length === 0 ? (
        <div className="mt-6"><Aviso>No hay sesiones finalizadas en este período.</Aviso></div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Tarjeta titulo="Evolución de la velocidad" subtitulo="Velocidad promedio de cada sesión. Si la línea sube, estás nadando más rápido.">
            {conVelocidad.length ? (
              <Linea
                puntos={conVelocidad.map((f) => ({
                  clave: f.sesion.id,
                  x: Date.parse(f.sesion.inicio),
                  y: f.velocidad_media_ms as number,
                  detalle: [formatearVel(f.velocidad_media_ms), `${fechaCorta(f.sesion.inicio)} · ${horaCorta(f.sesion.inicio)}`, `${formatearMetros(f.distancia_m)} · ${f.largos} largos`],
                }))}
                formatoY={(v) => v.toFixed(2)}
                marcasX={marcasFechas}
                etiquetaX="fecha · m/s"
                descripcion="Velocidad promedio por sesión"
              />
            ) : (
              <Aviso>Ninguna sesión del período tiene tramos medidos.</Aviso>
            )}
          </Tarjeta>

          <Tarjeta titulo="Distancia recorrida" subtitulo={porSemana ? 'Metros por semana (de lunes a domingo).' : 'Metros por día.'}>
            {grupos.length ? (
              <Barras
                datos={grupos.map(([k, metros]) => ({
                  clave: String(k),
                  etiqueta: porSemana ? `sem ${diaCorto(k)}` : diaCorto(k),
                  valor: Math.round(metros),
                  detalle: [formatearMetros(metros), porSemana ? `Semana del ${diaCorto(k)}` : new Date(k).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })],
                }))}
                formatoY={(v) => `${v.toLocaleString('es-CO')} m`}
                etiquetaX={porSemana ? 'semana' : 'día'}
                descripcion="Distancia recorrida por período"
              />
            ) : (
              <Aviso>Sin distancia registrada en el período.</Aviso>
            )}
          </Tarjeta>
        </div>
      )}

      <MisObjetivos sesiones={(filas ?? []).map((f) => f.sesion)} />

      <Comparacion filas={(filas ?? []).filter((f) => f.sesion.estado !== 'cancelada')} />
    </>
  )
}

/** Dos sesiones lado a lado, con la diferencia. */
function Comparacion({ filas }: { filas: FilaSesion[] }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const sa = filas.find((f) => f.sesion.id === a) ?? null
  const sb = filas.find((f) => f.sesion.id === b) ?? null
  const nombre = (f: FilaSesion) => `${fechaCorta(f.sesion.inicio)} ${horaCorta(f.sesion.inicio)} · ${formatearMetros(f.distancia_m)}`

  type Fila = { k: string; va: string; vb: string; dif: string | null }
  const dif = (x: number | null, y: number | null, fmt: (v: number) => string, mayorEsMejor: boolean): string | null => {
    if (x === null || y === null) return null
    const d = y - x
    if (Math.abs(d) < 1e-9) return 'igual'
    return `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}${(d > 0) === mayorEsMejor ? ' ▲ mejor' : ' ▼'}`
  }
  const filasTabla: Fila[] =
    sa && sb
      ? [
          { k: 'Distancia recorrida', va: formatearMetros(sa.distancia_m), vb: formatearMetros(sb.distancia_m), dif: dif(sa.distancia_m, sb.distancia_m, (v) => `${Math.round(v)} m`, true) },
          {
            k: 'Duración',
            va: sa.duracion_s === null ? 'en curso' : formatearDuracion(sa.duracion_s * 1000),
            vb: sb.duracion_s === null ? 'en curso' : formatearDuracion(sb.duracion_s * 1000),
            dif: sa.duracion_s !== null && sb.duracion_s !== null ? `${sb.duracion_s >= sa.duracion_s ? '+' : '−'}${formatearDuracion(Math.abs(sb.duracion_s - sa.duracion_s) * 1000)}` : null,
          },
          { k: 'Velocidad promedio', va: formatearVel(sa.velocidad_media_ms), vb: formatearVel(sb.velocidad_media_ms), dif: dif(sa.velocidad_media_ms, sb.velocidad_media_ms, (v) => `${v.toFixed(2)} m/s`, true) },
          { k: 'Velocidad máxima', va: formatearVel(sa.velocidad_max_ms), vb: formatearVel(sb.velocidad_max_ms), dif: dif(sa.velocidad_max_ms, sb.velocidad_max_ms, (v) => `${v.toFixed(2)} m/s`, true) },
          { k: 'Mejor largo', va: formatearSegundos(sa.mejor_largo_s), vb: formatearSegundos(sb.mejor_largo_s), dif: dif(sa.mejor_largo_s, sb.mejor_largo_s, (v) => formatearSegundos(v), false) },
          { k: 'Cantidad de largos', va: String(sa.largos), vb: String(sb.largos), dif: dif(sa.largos, sb.largos, (v) => String(v), true) },
        ]
      : []

  return (
    <Tarjeta className="mt-6" titulo="Comparar sesiones" subtitulo="Elegí dos entrenamientos para ver las diferencias. La diferencia es de la sesión B respecto de la A.">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-[#64748B]">
          Sesión A
          <select value={a} onChange={(e) => setA(e.target.value)} className={CAMPO}>
            <option value="">Elegí una sesión</option>
            {filas.map((f) => <option key={f.sesion.id} value={f.sesion.id} disabled={f.sesion.id === b}>{nombre(f)}</option>)}
          </select>
        </label>
        <label className="text-sm text-[#64748B]">
          Sesión B
          <select value={b} onChange={(e) => setB(e.target.value)} className={CAMPO}>
            <option value="">Elegí una sesión</option>
            {filas.map((f) => <option key={f.sesion.id} value={f.sesion.id} disabled={f.sesion.id === a}>{nombre(f)}</option>)}
          </select>
        </label>
      </div>
      {sa && sb && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm tabular-nums">
            <thead className="text-xs uppercase tracking-wider text-[#94A3B8]">
              <tr>
                <th className="py-2 pr-4 font-semibold">Métrica</th>
                <th className="py-2 pr-4 text-right font-semibold">A · {fechaCorta(sa.sesion.inicio)}</th>
                <th className="py-2 pr-4 text-right font-semibold">B · {fechaCorta(sb.sesion.inicio)}</th>
                <th className="py-2 text-right font-semibold">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {filasTabla.map((x) => (
                <tr key={x.k} className="border-t border-[#F1F5F9]">
                  <td className="py-2.5 pr-4 text-[#64748B]">{x.k}</td>
                  <td className="py-2.5 pr-4 text-right font-semibold">{x.va}</td>
                  <td className="py-2.5 pr-4 text-right font-semibold">{x.vb}</td>
                  <td className="py-2.5 text-right">{x.dif ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  )
}

/** Los objetivos que me puso mi entrenador, con cuánto llevo. */
function MisObjetivos({ sesiones }: { sesiones: import('@/lib/tipos').ResumenSesion[] }) {
  const [objetivos, setObjetivos] = useState<Objetivo[] | null>(null)
  useEffect(() => {
    api.misObjetivos().then(setObjetivos).catch(() => setObjetivos([]))
  }, [])
  if (!objetivos?.length) return null
  return (
    <Tarjeta className="mt-6" titulo="Mis objetivos" subtitulo="Los pone tu entrenador. Solo cuentan los largos detectados.">
      <div className="flex flex-col gap-4">
        {objetivos.map((o) => <ProgresoObjetivo key={o.id} o={o} c={cumplimiento(o, sesiones)} />)}
      </div>
    </Tarjeta>
  )
}
