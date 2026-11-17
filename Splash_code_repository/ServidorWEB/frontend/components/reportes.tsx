'use client'

import { Activity, Download, Gauge, Waves } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { conErrores } from '@/components/admin/comun'
import { Barras, Linea } from '@/components/graficos'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, Kpi, Tarjeta } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import { descargarTexto, formatearMetros, formatearVel } from '@/lib/largos'
import type { ResumenSesion } from '@/lib/tipos'

const DIA = 24 * 60 * 60 * 1000
const semanaDe = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime() - ((d.getDay() + 6) % 7) * DIA // lunes
}
const diaCorto = (t: number) => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

type Periodo = '30' | '90' | '365' | 'todo'

/**
 * Reportes: sesiones por período, nadadores más activos, rendimiento y exportación (grupal e individual). Usa las
 * sesiones que puede ver quien mira: todas para el administrador, las suyas para el entrenador.
 */
export function Reportes({ bajada }: { bajada: string }) {
  const [sesiones, setSesiones] = useState<ResumenSesion[] | null>(null)
  const [problema, setProblema] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('90')

  useEffect(() => {
    api.sesionesRecientes(500).then(setSesiones).catch((e) => setProblema(e instanceof ErrorApi ? e.message : 'No se pudieron cargar las sesiones.'))
  }, [])

  const enPeriodo = useMemo(() => {
    const desde = periodo === 'todo' ? 0 : Date.now() - Number(periodo) * DIA
    return (sesiones ?? []).filter((s) => s.estado !== 'cancelada' && Date.parse(s.inicio) >= desde)
  }, [sesiones, periodo])

  const carriles = enPeriodo.flatMap((s) => s.por_carril)
  const metros = carriles.reduce((a, c) => a + c.distancia_m, 0)
  const segundos = carriles.reduce((a, c) => a + (c.velocidad_media_ms ? c.distancia_m / c.velocidad_media_ms : 0), 0)
  const vMedia = segundos > 0 ? metros / segundos : null

  // por semana: sesiones y velocidad media (ponderada por distancia)
  const semanas = useMemo(() => {
    const m = new Map<number, { sesiones: number; metros: number; segundos: number }>()
    for (const s of enPeriodo) {
      const k = semanaDe(Date.parse(s.inicio))
      const x = m.get(k) ?? { sesiones: 0, metros: 0, segundos: 0 }
      x.sesiones += 1
      for (const c of s.por_carril) {
        x.metros += c.distancia_m
        if (c.velocidad_media_ms) x.segundos += c.distancia_m / c.velocidad_media_ms
      }
      m.set(k, x)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [enPeriodo])

  // nadadores más activos (por distancia)
  const ranking = useMemo(() => {
    const m = new Map<string, { clave: string; nombre: string; sesiones: Set<string>; metros: number; segundos: number; largos: number; vmax: number | null }>()
    for (const s of enPeriodo)
      for (const c of s.por_carril) {
        if (!c.nadador) continue
        const k = c.usuario_id ?? `nombre:${c.nadador}`
        const x = m.get(k) ?? { clave: k, nombre: c.nadador, sesiones: new Set<string>(), metros: 0, segundos: 0, largos: 0, vmax: null }
        x.sesiones.add(s.id)
        x.metros += c.distancia_m
        if (c.velocidad_media_ms) x.segundos += c.distancia_m / c.velocidad_media_ms
        x.largos += c.largos
        if (c.velocidad_max_ms !== null) x.vmax = Math.max(x.vmax ?? 0, c.velocidad_max_ms)
        m.set(k, x)
      }
    return [...m.values()].sort((a, b) => b.metros - a.metros)
  }, [enPeriodo])

  const [individual, setIndividual] = useState('')
  function exportarIndividual() {
    const elegido = ranking.find((r) => r.clave === individual)
    if (!elegido) return
    const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const filas = [['fecha', 'hora', 'carril', 'estado', 'distancia_m', 'velocidad_media_ms', 'velocidad_max_ms', 'largos', 'largos_detectados', 'mejor_largo_s', 'tramos', 'tramos_estimados'].join(',')]
    for (const s of enPeriodo)
      for (const c of s.por_carril) {
        if ((c.usuario_id ?? `nombre:${c.nadador}`) !== elegido.clave) continue
        filas.push(
          [new Date(s.inicio).toISOString().slice(0, 10), new Date(s.inicio).toLocaleTimeString('es-CO', { hour12: false }), String(c.carril), s.estado, c.distancia_m.toFixed(1), c.velocidad_media_ms?.toFixed(3) ?? '', c.velocidad_max_ms?.toFixed(3) ?? '', String(c.largos), String(c.largos_medidos), c.mejor_largo_s?.toFixed(2) ?? '', String(c.tramos), String(c.tramos_estimados)]
            .map(esc)
            .join(','),
        )
      }
    descargarTexto(`safesplash_${elegido.nombre.replace(/\s+/g, '_')}_${periodo}_${new Date().toISOString().slice(0, 10)}.csv`, filas.join('\n') + '\n', 'text/csv')
  }

  function exportar() {
    const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const filas = [['nadador', 'sesiones', 'distancia_m', 'velocidad_media_ms', 'velocidad_max_ms', 'largos'].join(',')]
    for (const r of ranking) filas.push([r.nombre, String(r.sesiones.size), r.metros.toFixed(1), r.segundos > 0 ? (r.metros / r.segundos).toFixed(3) : '', r.vmax?.toFixed(3) ?? '', String(r.largos)].map(esc).join(','))
    descargarTexto(`safesplash_reporte_${periodo}_${new Date().toISOString().slice(0, 10)}.csv`, filas.join('\n') + '\n', 'text/csv')
  }

  return (
    <>
      <Encabezado
        titulo="Reportes y estadísticas"
        bajada={bajada}
        accion={<button onClick={exportar} disabled={!ranking.length} className={BOTON.secundario}><Download className="size-4" /> Exportar reporte grupal (.csv)</button>}
      />
      <Tarjeta>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
          {([['30', 'Últimos 30 días'], ['90', 'Últimos 3 meses'], ['365', 'Último año'], ['todo', 'Todo']] as [Periodo, string][]).map(([v, t]) => (
            <button key={v} onClick={() => setPeriodo(v)} aria-pressed={periodo === v} className={periodo === v ? BOTON.primario : BOTON.terciario}>{t}</button>
          ))}
        </div>
      </Tarjeta>
      {problema && <div className="mt-6"><Aviso tipo="error">{problema}</Aviso></div>}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icono={Activity} etiqueta="Sesiones" valor={sesiones ? String(enPeriodo.length) : '…'} nota={`${enPeriodo.filter(conErrores).length} con errores de detección`} />
        <Kpi icono={Waves} etiqueta="Distancia total" valor={sesiones ? Math.round(metros).toLocaleString('es-CO') : '…'} unidad="m" />
        <Kpi icono={Gauge} etiqueta="Velocidad promedio general" valor={vMedia ? vMedia.toFixed(2) : sesiones ? '—' : '…'} unidad="m/s" />
        <Kpi icono={Activity} etiqueta="Nadadores activos" valor={sesiones ? String(ranking.length) : '…'} />
      </div>

      {sesiones && enPeriodo.length === 0 ? (
        <div className="mt-6"><Aviso>No hay sesiones en este período.</Aviso></div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Tarjeta titulo="Sesiones por semana" subtitulo="De lunes a domingo.">
            <Barras
              datos={semanas.map(([k, x]) => ({ clave: String(k), etiqueta: diaCorto(k), valor: x.sesiones, detalle: [`${x.sesiones} ${x.sesiones === 1 ? 'sesión' : 'sesiones'}`, `Semana del ${diaCorto(k)}`, formatearMetros(x.metros)] }))}
              formatoY={(v) => String(v)}
              etiquetaX="semana"
              descripcion="Sesiones por semana"
            />
          </Tarjeta>
          <Tarjeta titulo="Evolución del rendimiento" subtitulo="Velocidad media de todos los nadadores, por semana.">
            <Linea
              puntos={semanas.filter(([, x]) => x.segundos > 0).map(([k, x]) => ({ clave: String(k), x: k, y: x.metros / x.segundos, detalle: [formatearVel(x.metros / x.segundos), `Semana del ${diaCorto(k)}`, `${x.sesiones} sesiones`] }))}
              formatoY={(v) => v.toFixed(2)}
              marcasX={semanas.filter((_, i) => i % Math.ceil(semanas.length / 6) === 0).map(([k]) => ({ x: k, texto: diaCorto(k) }))}
              etiquetaX="semana · m/s"
              descripcion="Velocidad media por semana"
            />
          </Tarjeta>
        </div>
      )}

      <Tarjeta className="mt-6" titulo="Reporte individual" subtitulo="Todas las sesiones de un nadador en el período, carril por carril, en CSV (se abre con Excel).">
        <div className="flex flex-wrap items-end gap-3">
          <select value={individual} onChange={(e) => setIndividual(e.target.value)} className="min-w-[14rem] rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm" aria-label="Nadador del reporte">
            <option value="">Elegí un nadador</option>
            {ranking.map((r) => <option key={r.clave} value={r.clave}>{r.nombre}</option>)}
          </select>
          <button onClick={exportarIndividual} disabled={!individual} className={BOTON.primario}><Download className="size-4" /> Descargar reporte individual</button>
        </div>
      </Tarjeta>

      <Tarjeta className="mt-6" titulo="Nadadores más activos" subtitulo="Ordenados por distancia; para comparar, mirá velocidad media y máxima en la misma fila.">
        {ranking.length === 0 ? <Aviso>Sin datos en el período.</Aviso> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm tabular-nums">
              <thead className="text-xs uppercase tracking-wider text-[#94A3B8]">
                <tr><th className="py-2 pr-4">#</th><th className="py-2 pr-4">Nadador</th><th className="py-2 pr-4 text-right">Sesiones</th><th className="py-2 pr-4 text-right">Distancia</th><th className="py-2 pr-4 text-right">Velocidad media</th><th className="py-2 pr-4 text-right">Mejor velocidad</th><th className="py-2 text-right">Largos</th></tr>
              </thead>
              <tbody>
                {ranking.slice(0, 20).map((r, i) => (
                  <tr key={r.nombre + i} className="border-t border-[#F1F5F9]">
                    <td className="py-2.5 pr-4 text-[#94A3B8]">{i + 1}</td>
                    <td className="py-2.5 pr-4 font-medium">{r.nombre}</td>
                    <td className="py-2.5 pr-4 text-right">{r.sesiones.size}</td>
                    <td className="py-2.5 pr-4 text-right">{formatearMetros(r.metros)}</td>
                    <td className="py-2.5 pr-4 text-right">{formatearVel(r.segundos > 0 ? r.metros / r.segundos : null)}</td>
                    <td className="py-2.5 pr-4 text-right">{formatearVel(r.vmax)}</td>
                    <td className="py-2.5 text-right">{r.largos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </>
  )
}
