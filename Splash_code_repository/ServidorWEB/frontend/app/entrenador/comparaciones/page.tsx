'use client'

import { useMemo, useState } from 'react'

import { carrilesDe, desdePeriodo, metricas, useDatosEntrenador } from '@/components/entrenador/datos'
import { Barras } from '@/components/graficos'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, CAMPO, Tarjeta } from '@/components/nadador/ui'
import { fechaCorta, formatearMetros, formatearSegundos, formatearVel, horaCorta } from '@/lib/largos'

type Metrica = { k: string; valor: (m: ReturnType<typeof metricas> & { cambio: number | null }) => number | null; fmt: (v: number | null) => string; mayorEsMejor: boolean }
const METRICAS: Metrica[] = [
  { k: 'Velocidad promedio', valor: (m) => m.velocidad_media_ms, fmt: formatearVel, mayorEsMejor: true },
  { k: 'Velocidad máxima', valor: (m) => m.velocidad_max_ms, fmt: formatearVel, mayorEsMejor: true },
  { k: 'Mejor tiempo de largo', valor: (m) => m.mejor_largo_s, fmt: formatearSegundos, mayorEsMejor: false },
  { k: 'Distancia', valor: (m) => m.distancia_m, fmt: (v) => (v === null ? '—' : formatearMetros(v)), mayorEsMejor: true },
  { k: 'Largos completos', valor: (m) => m.largos, fmt: (v) => (v === null ? '—' : String(v)), mayorEsMejor: true },
  { k: 'Evolución de la velocidad', valor: (m) => m.cambio, fmt: (v) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)} %`), mayorEsMejor: true },
]

/** Comparar nadadores entre sí (2 a 4) o dos sesiones de un mismo nadador. */
export default function Comparaciones() {
  const { datos, problema } = useDatosEntrenador()
  const [modo, setModo] = useState<'nadadores' | 'sesiones'>('nadadores')
  const [elegidos, setElegidos] = useState<string[]>([])
  const [periodo, setPeriodo] = useState('90')

  const comparados = useMemo(() => {
    if (!datos) return []
    const desde = desdePeriodo(periodo)
    return elegidos.map((id) => {
      const n = datos.nadadores.find((x) => x.id === id)!
      const filas = carrilesDe(n.usuario_id, datos.sesiones).filter((f) => f.sesion.estado !== 'cancelada' && Date.parse(f.sesion.inicio) >= desde)
      // evolución: velocidad media de la segunda mitad de sus sesiones contra la primera
      const orden = [...filas].sort((a, b) => a.sesion.inicio.localeCompare(b.sesion.inicio))
      const mitad = Math.floor(orden.length / 2)
      const v1 = metricas(orden.slice(0, mitad)).velocidad_media_ms
      const v2 = metricas(orden.slice(orden.length - mitad)).velocidad_media_ms
      return { n, m: { ...metricas(filas), cambio: mitad >= 2 && v1 && v2 ? ((v2 - v1) / v1) * 100 : null } }
    })
  }, [datos, elegidos, periodo])

  const mejor = (met: Metrica) => {
    const vals = comparados.map((c) => met.valor(c.m)).filter((v): v is number => v !== null)
    if (vals.length < 2) return { mejor: null, peor: null }
    return { mejor: met.mayorEsMejor ? Math.max(...vals) : Math.min(...vals), peor: met.mayorEsMejor ? Math.min(...vals) : Math.max(...vals) }
  }

  return (
    <>
      <Encabezado titulo="Comparaciones" bajada="Poné lado a lado a tus nadadores, o dos sesiones de un mismo nadador." />
      {problema && <div className="mb-4"><Aviso tipo="error">{problema}</Aviso></div>}
      <div className="mb-6 flex gap-2" role="tablist">
        <button role="tab" aria-selected={modo === 'nadadores'} onClick={() => setModo('nadadores')} className={modo === 'nadadores' ? BOTON.primario : BOTON.terciario}>Nadadores</button>
        <button role="tab" aria-selected={modo === 'sesiones'} onClick={() => setModo('sesiones')} className={modo === 'sesiones' ? BOTON.primario : BOTON.terciario}>Sesiones</button>
      </div>

      {modo === 'nadadores' ? (
        <>
          <Tarjeta titulo="Elegí de 2 a 4 nadadores">
            <div className="flex flex-wrap gap-2">
              {datos?.nadadores.map((n) => {
                const esta = elegidos.includes(n.id)
                return (
                  <button
                    key={n.id}
                    onClick={() => setElegidos(esta ? elegidos.filter((x) => x !== n.id) : elegidos.length < 4 ? [...elegidos, n.id] : elegidos)}
                    aria-pressed={esta}
                    disabled={!esta && elegidos.length >= 4}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition disabled:opacity-40 ${esta ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]'}`}
                  >
                    {n.nombre}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Período">
              {[['30', '30 días'], ['90', '3 meses'], ['365', '1 año'], ['todo', 'Todo']].map(([v, t]) => <button key={v} onClick={() => setPeriodo(v)} aria-pressed={periodo === v} className={periodo === v ? BOTON.primario : BOTON.terciario}>{t}</button>)}
            </div>
          </Tarjeta>

          {comparados.length < 2 ? <div className="mt-6"><Aviso>Elegí al menos dos nadadores.</Aviso></div> : (
            <>
              <Tarjeta className="mt-6" titulo="Lado a lado" subtitulo="★ = el mejor en esa métrica (fortaleza) · ▼ = el que más tiene para mejorar. Velocidad máxima y mejor largo, solo con largos detectados.">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-sm tabular-nums">
                    <thead className="text-xs uppercase tracking-wider text-[#94A3B8]"><tr><th className="py-2 pr-4">Métrica</th>{comparados.map((c) => <th key={c.n.id} className="py-2 pr-4 text-right">{c.n.nombre}</th>)}</tr></thead>
                    <tbody>
                      {METRICAS.map((met) => {
                        const { mejor: b, peor: w } = mejor(met)
                        return (
                          <tr key={met.k} className="border-t border-[#F1F5F9]">
                            <td className="py-2.5 pr-4 text-[#64748B]">{met.k}</td>
                            {comparados.map((c) => {
                              const v = met.valor(c.m)
                              return <td key={c.n.id} className={`py-2.5 pr-4 text-right ${v !== null && v === b ? 'font-semibold text-[#166534]' : ''}`}>{met.fmt(v)}{v !== null && v === b ? ' ★' : v !== null && v === w ? <span className="text-[#B45309]"> ▼</span> : ''}</td>
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Tarjeta>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Tarjeta titulo="Velocidad promedio" subtitulo="m/s, más alto es mejor.">
                  <Barras datos={comparados.map((c) => ({ clave: c.n.id, etiqueta: c.n.nombre.split(' ')[0], valor: Math.round((c.m.velocidad_media_ms ?? 0) * 100) / 100, detalle: [formatearVel(c.m.velocidad_media_ms), c.n.nombre] }))} formatoY={(v) => v.toFixed(2)} etiquetaX="nadador" descripcion="Velocidad promedio por nadador" />
                </Tarjeta>
                <Tarjeta titulo="Mejor tiempo de largo" subtitulo="Segundos, más bajo es mejor.">
                  <Barras datos={comparados.map((c) => ({ clave: c.n.id, etiqueta: c.n.nombre.split(' ')[0], valor: Math.round((c.m.mejor_largo_s ?? 0) * 10) / 10, detalle: [formatearSegundos(c.m.mejor_largo_s), c.n.nombre] }))} formatoY={(v) => `${v} s`} etiquetaX="nadador" descripcion="Mejor tiempo de largo por nadador" />
                </Tarjeta>
              </div>
            </>
          )}
        </>
      ) : (
        <CompararSesiones />
      )}
    </>
  )
}

/** Dos sesiones de un mismo nadador, carril contra carril. */
function CompararSesiones() {
  const { datos } = useDatosEntrenador()
  const [nadadorId, setNadadorId] = useState('')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const n = datos?.nadadores.find((x) => x.id === nadadorId) ?? null
  const filas = n && datos ? carrilesDe(n.usuario_id, datos.sesiones).filter((f) => f.sesion.estado !== 'cancelada') : []
  const fa = filas.find((f) => f.sesion.id === a) ?? null
  const fb = filas.find((f) => f.sesion.id === b) ?? null
  const nombre = (f: (typeof filas)[number]) => `${fechaCorta(f.sesion.inicio)} ${horaCorta(f.sesion.inicio)} · ${formatearMetros(f.carril.distancia_m)}`
  const fila = (k: string, va: number | null, vb: number | null, fmt: (v: number | null) => string, mayorEsMejor = true) => {
    const d = va !== null && vb !== null ? vb - va : null
    return (
      <tr key={k} className="border-t border-[#F1F5F9]">
        <td className="py-2.5 pr-4 text-[#64748B]">{k}</td><td className="py-2.5 pr-4 text-right">{fmt(va)}</td><td className="py-2.5 pr-4 text-right">{fmt(vb)}</td>
        <td className="py-2.5 text-right">{d === null || Math.abs(d) < 1e-9 ? '—' : `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))} ${(d > 0) === mayorEsMejor ? '▲ mejor' : '▼'}`}</td>
      </tr>
    )
  }
  return (
    <Tarjeta titulo="Comparar dos sesiones" subtitulo="La diferencia es de la sesión B respecto de la A.">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-[#64748B]">Nadador<select value={nadadorId} onChange={(e) => { setNadadorId(e.target.value); setA(''); setB('') }} className={CAMPO}><option value="">Elegí un nadador</option>{datos?.nadadores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>
        <label className="text-sm text-[#64748B]">Sesión A<select value={a} onChange={(e) => setA(e.target.value)} className={CAMPO}><option value="">Elegí</option>{filas.map((f) => <option key={f.sesion.id} value={f.sesion.id} disabled={f.sesion.id === b}>{nombre(f)}</option>)}</select></label>
        <label className="text-sm text-[#64748B]">Sesión B<select value={b} onChange={(e) => setB(e.target.value)} className={CAMPO}><option value="">Elegí</option>{filas.map((f) => <option key={f.sesion.id} value={f.sesion.id} disabled={f.sesion.id === a}>{nombre(f)}</option>)}</select></label>
      </div>
      {fa && fb && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm tabular-nums">
            <thead className="text-xs uppercase tracking-wider text-[#94A3B8]"><tr><th className="py-2 pr-4">Métrica</th><th className="py-2 pr-4 text-right">A · {fechaCorta(fa.sesion.inicio)}</th><th className="py-2 pr-4 text-right">B · {fechaCorta(fb.sesion.inicio)}</th><th className="py-2 text-right">Diferencia</th></tr></thead>
            <tbody>
              {fila('Distancia', fa.carril.distancia_m, fb.carril.distancia_m, (v) => (v === null ? '—' : formatearMetros(v)))}
              {fila('Velocidad promedio', fa.carril.velocidad_media_ms, fb.carril.velocidad_media_ms, formatearVel)}
              {fila('Velocidad máxima', fa.carril.velocidad_max_ms, fb.carril.velocidad_max_ms, formatearVel)}
              {fila('Mejor largo', fa.carril.mejor_largo_s, fb.carril.mejor_largo_s, formatearSegundos, false)}
              {fila('Largos', fa.carril.largos, fb.carril.largos, (v) => (v === null ? '—' : String(v)))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  )
}
