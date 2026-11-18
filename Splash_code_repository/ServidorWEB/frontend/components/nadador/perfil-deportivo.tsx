'use client'

// La ficha del perfil deportivo del nadador. La usan el nadador (resumen del cuestionario y Mi perfil) y su
// entrenador. Todo lo que muestra sale de las respuestas reales y de los tiempos registrados.
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Personaje } from '@/components/nadador/personaje'
import { ErrorApi, api } from '@/lib/api'
import { ESTILOS, NOMBRE_ESTILO, formatearTiempo, marcaDestacada, textoRespuesta } from '@/lib/perfil-nadador'
import type { Estilo, MarcaPersonal, VistaPerfil } from '@/lib/tipos'

/** AAAA-MM-DD (una fecha, sin hora) o un instante ISO (se muestra en la hora local). */
const fecha = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

/** Personaje, datos principales e historia. */
export function FichaPerfil({ vista }: { vista: VistaPerfil }) {
  const r = vista.respuestas
  const destacada = marcaDestacada(vista.marcas, r)
  const principal = r.estilo_fuerte ?? (r.estilos?.length === 1 ? r.estilos[0] : undefined)
  const disponibilidad = [
    r.dias_semana ? `${r.dias_semana} ${r.dias_semana === 1 ? 'día' : 'días'} por semana` : null,
    r.minutos_sesion ? `${r.minutos_sesion} min por sesión` : null,
    textoRespuesta('horario', r)?.toLowerCase() ?? null,
  ].filter(Boolean).join(' · ')

  const datos: [string, string | null][] = [
    ['Edad', vista.edad !== null ? `${vista.edad} años` : null],
    ['Sexo', textoRespuesta('sexo', r)],
    ['Nivel deportivo', textoRespuesta('nivel', r)],
    ['Experiencia', r.tiene_experiencia === false ? 'Está comenzando' : textoRespuesta('tiempo_practicando', r)],
    ['Estilos que domina', textoRespuesta('estilos', r)],
    ['Estilo principal', principal ? NOMBRE_ESTILO[principal] : null],
    ['Mejor distancia', textoRespuesta('mejor_distancia', r)],
    ['Mejor marca personal', destacada ? `${formatearTiempo(destacada.mejor_ms)} · ${destacada.distancia_m} m ${NOMBRE_ESTILO[destacada.estilo].toLowerCase()} (piscina ${destacada.piscina_m} m)` : null],
    ['Tiempo promedio', destacada ? `${formatearTiempo(destacada.promedio_ms)} · ${destacada.registros} ${destacada.registros === 1 ? 'registro' : 'registros'}` : null],
    ['Objetivos', textoRespuesta('objetivos', r)],
    ['Disponibilidad semanal', disponibilidad || null],
  ]

  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
      <div className="flex flex-col items-center self-start rounded-3xl bg-[#F3F6F9] p-4">
        <Personaje sexo={r.sexo} animar={false} className="h-48 w-auto" />
        <p className="mt-2 text-center font-semibold text-[#123B5D]">{vista.nombre}</p>
        {vista.completado_en && <p className="text-center text-xs text-[#64748B]">Perfil desde {fecha(vista.completado_en)}</p>}
      </div>
      <div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {datos.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-[#64748B]">{k}</dt>
              <dd className={`mt-0.5 font-medium ${v ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>{v ?? 'Sin dato'}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 rounded-2xl border border-[#D9F0FF] bg-[#F5FBFF] p-4">
          <h3 className="text-sm font-semibold text-[#123B5D]">Historia deportiva</h3>
          {vista.historia.length ? (
            vista.historia.map((p, i) => <p key={i} className="mt-2 text-sm leading-relaxed text-[#334155]">{p}</p>)
          ) : (
            <p className="mt-2 text-sm text-[#64748B]">Todavía no hay datos suficientes para armar la historia.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Mejor marca, promedio y último tiempo por estilo, distancia y piscina (nunca se mezclan). */
export function TablaMarcas({ marcas }: { marcas: MarcaPersonal[] }) {
  if (!marcas.length) return <p className="text-sm text-[#64748B]">Todavía no hay tiempos registrados.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-[#94A3B8]">
          <tr>
            <th className="py-2 pr-3">Prueba</th>
            <th className="py-2 pr-3">Piscina</th>
            <th className="py-2 pr-3">Mejor marca</th>
            <th className="py-2 pr-3">Promedio</th>
            <th className="py-2 pr-3">Último</th>
            <th className="py-2">Registros</th>
          </tr>
        </thead>
        <tbody>
          {marcas.map((m) => (
            <tr key={`${m.estilo}-${m.distancia_m}-${m.piscina_m}`} className="border-t border-[#F1F5F9]">
              <td className="py-2 pr-3 font-medium">{m.distancia_m} m {NOMBRE_ESTILO[m.estilo].toLowerCase()}</td>
              <td className="py-2 pr-3">{m.piscina_m} m</td>
              <td className="py-2 pr-3 font-semibold text-[#1677B8]">{formatearTiempo(m.mejor_ms)} <span className="text-xs font-normal text-[#94A3B8]">{fecha(m.mejor_fecha)}</span></td>
              <td className="py-2 pr-3">{formatearTiempo(m.promedio_ms)}</td>
              <td className="py-2 pr-3">{formatearTiempo(m.ultimo_ms)} <span className="text-xs text-[#94A3B8]">{fecha(m.ultima_fecha)}</span></td>
              <td className="py-2">{m.registros}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const hoyIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const CAMPO = 'mt-1 block w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] outline-none focus:border-[#1677B8] focus:ring-4 focus:ring-[#D9F0FF]'

/** El nadador agrega sus tiempos (minutos, segundos y centésimas) y borra los que cargó mal. */
export function RegistroTiempos({ vista, alCambiar }: { vista: VistaPerfil; alCambiar: (v: VistaPerfil) => void }) {
  const [t, setT] = useState({ estilo: 'libre' as Estilo, distancia_m: 50, piscina_m: 25, min: '', seg: '', cent: '', fecha: hoyIso() })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const min = Number(t.min || 0)
  const seg = Number(t.seg || 0)
  const cent = Number(t.cent || 0)
  const ms = (min * 60 + seg) * 1000 + cent * 10
  const valido = Number.isInteger(min) && min >= 0 && Number.isInteger(seg) && seg >= 0 && seg < 60 && Number.isInteger(cent) && cent >= 0 && cent < 100 && ms > 0

  // no es un <form>: este bloque también va dentro del formulario del cuestionario, y un form no puede contener otro
  async function agregar() {
    if (!valido) return setError('Revisa el tiempo: segundos de 0 a 59 y centésimas de 0 a 99.')
    setEnviando(true)
    setError(null)
    try {
      alCambiar(await api.agregarTiempoPersonal({ estilo: t.estilo, distancia_m: t.distancia_m, piscina_m: t.piscina_m, tiempo_ms: ms, fecha: t.fecha }))
      setT({ ...t, min: '', seg: '', cent: '' })
    } catch (err) {
      setError(err instanceof ErrorApi ? [err.message, ...err.detalles].join(' ') : 'No se pudo guardar el tiempo.')
    } finally {
      setEnviando(false)
    }
  }

  async function borrar(id: string) {
    try {
      alCambiar(await api.borrarTiempoPersonal(id))
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo borrar el tiempo.')
    }
  }

  const distancias = (t.piscina_m === 50 ? [50, 100, 200, 400, 800, 1500] : [25, 50, 100, 200, 400, 800, 1500])

  return (
    <div>
      <div
        role="group"
        aria-label="Registrar un tiempo"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault()
            void agregar()
          }
        }}
        className="grid grid-cols-2 gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F3F6F9] p-4 sm:grid-cols-6">
        <label className="col-span-2 text-xs font-medium text-[#64748B] sm:col-span-2">
          Estilo
          <select value={t.estilo} onChange={(e) => setT({ ...t, estilo: e.target.value as Estilo })} className={CAMPO}>
            {ESTILOS.map((s) => <option key={s.valor} value={s.valor}>{NOMBRE_ESTILO[s.valor]}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-[#64748B]">
          Piscina
          <select
            value={t.piscina_m}
            onChange={(e) => {
              const p = Number(e.target.value)
              setT({ ...t, piscina_m: p, distancia_m: p === 50 && t.distancia_m === 25 ? 50 : t.distancia_m })
            }}
            className={CAMPO}
          >
            <option value={25}>25 m</option>
            <option value={50}>50 m</option>
          </select>
        </label>
        <label className="text-xs font-medium text-[#64748B]">
          Distancia
          <select value={t.distancia_m} onChange={(e) => setT({ ...t, distancia_m: Number(e.target.value) })} className={CAMPO}>
            {distancias.map((d) => <option key={d} value={d}>{d.toLocaleString('es-CO')} m</option>)}
          </select>
        </label>
        <label className="col-span-2 text-xs font-medium text-[#64748B]">
          Fecha
          <input type="date" required max={hoyIso()} value={t.fecha} onChange={(e) => setT({ ...t, fecha: e.target.value })} className={CAMPO} />
        </label>
        <fieldset className="col-span-2 sm:col-span-4">
          <legend className="text-xs font-medium text-[#64748B]">Tiempo (min : seg . centésimas)</legend>
          <div className="mt-1 flex items-center gap-1.5">
            <input inputMode="numeric" aria-label="Minutos" placeholder="min" value={t.min} onChange={(e) => setT({ ...t, min: e.target.value.replace(/\D/g, '').slice(0, 3) })} className={`${CAMPO} mt-0 text-center`} />
            <span className="font-semibold text-[#64748B]">:</span>
            <input inputMode="numeric" aria-label="Segundos" placeholder="seg" value={t.seg} onChange={(e) => setT({ ...t, seg: e.target.value.replace(/\D/g, '').slice(0, 2) })} className={`${CAMPO} mt-0 text-center`} />
            <span className="font-semibold text-[#64748B]">.</span>
            <input inputMode="numeric" aria-label="Centésimas" placeholder="cc" value={t.cent} onChange={(e) => setT({ ...t, cent: e.target.value.replace(/\D/g, '').slice(0, 2) })} className={`${CAMPO} mt-0 text-center`} />
          </div>
        </fieldset>
        <div className="col-span-2 flex items-end">
          <button type="button" onClick={() => void agregar()} disabled={enviando || !valido} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1677B8] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]">
            <Plus className="size-4" /> {enviando ? 'Guardando…' : 'Agregar tiempo'}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-[#DC2626]">{error}</p>}

      {vista.tiempos.length > 0 && (
        <ul className="mt-4 divide-y divide-[#F1F5F9] rounded-2xl border border-[#E2E8F0] bg-white">
          {vista.tiempos.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span>
                <span className="font-medium">{x.distancia_m} m {NOMBRE_ESTILO[x.estilo].toLowerCase()}</span>
                <span className="text-[#64748B]"> · piscina {x.piscina_m} m · {fecha(x.fecha)}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-[#123B5D]">{formatearTiempo(x.tiempo_ms)}</span>
                <button type="button" onClick={() => void borrar(x.id)} className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9]" aria-label="Borrar este tiempo">
                  <Trash2 className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
