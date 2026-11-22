'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useDatosEntrenador } from '@/components/entrenador/datos'
import { ProgresoObjetivo } from '@/components/entrenador/progreso-objetivo'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, CAMPO, Tarjeta } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import { cumplimiento, NOMBRE_TIPO, UNIDAD_TIPO } from '@/lib/objetivos'
import type { TipoObjetivo } from '@/lib/tipos'
import { useParametroUrl } from '@/shared/hooks/use-parametro-url'

const hoyIso = () => new Date().toISOString().slice(0, 10)
const enDias = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const AYUDA: Record<TipoObjetivo, string> = {
  distancia: 'Metros nadados entre las dos fechas.',
  velocidad: 'Mejor velocidad de un largo detectado, en m/s.',
  tiempo_largo: 'Bajar el mejor tiempo de largo a estos segundos o menos.',
}

/** Objetivos de mis nadadores: crear, cambiar, borrar y ver cuánto cumplieron. */
export default function ObjetivosEntrenador() {
  const { datos, problema, recargar } = useDatosEntrenador()
  const nadadorUrl = useParametroUrl('nadador')
  const [form, setForm] = useState({ nadador_id: null as string | null, tipo: 'distancia' as TipoObjetivo, meta: '', desde: hoyIso(), hasta: enDias(30), descripcion: '' })
  const [editando, setEditando] = useState<{ id: string; meta: string; desde: string; hasta: string } | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'pendientes' | 'alcanzados' | 'vencidos'>('todos')
  const [nadadorFiltrado, setDeNadador] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'info' | 'error'; texto: string } | null>(null)

  const deNadador = nadadorFiltrado ?? nadadorUrl ?? ''
  const nadadorFormulario = form.nadador_id ?? nadadorUrl ?? ''

  async function hacer(accion: () => Promise<unknown>, ok: string) {
    setAviso(null)
    try {
      await accion()
      setAviso({ tipo: 'info', texto: ok })
      await recargar()
      return true
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof ErrorApi ? [e.message, ...e.detalles].join(' ') : 'No se pudo guardar.' })
      return false
    }
  }

  const lista = useMemo(() => {
    if (!datos) return []
    return datos.objetivos
      .filter((o) => !deNadador || o.nadador_id === deNadador)
      .map((o) => ({ o, c: cumplimiento(o, datos.sesiones) }))
      .filter(({ c }) => filtro === 'todos' || (filtro === 'alcanzados' ? c.alcanzado : filtro === 'vencidos' ? c.estado === 'vencido' : !c.alcanzado && c.estado !== 'vencido'))
  }, [datos, filtro, deNadador])
  const todos = datos ? datos.objetivos.map((o) => cumplimiento(o, datos.sesiones)) : []

  return (
    <>
      <Encabezado titulo="Objetivos" bajada="Metas de distancia, velocidad o tiempo por largo para cada nadador, y cuánto llevan. Solo cuentan los largos detectados y las sesiones que iniciaste." />
      {problema && <div className="mb-4"><Aviso tipo="error">{problema}</Aviso></div>}

      <Tarjeta titulo="Nuevo objetivo">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await hacer(
              () => api.crearObjetivo({ nadador_id: nadadorFormulario, tipo: form.tipo, meta: Number(form.meta.replace(',', '.')), desde: form.desde, hasta: form.hasta, descripcion: form.descripcion.trim() || null }),
              'Objetivo creado.',
            )
            if (ok) setForm({ ...form, meta: '', descripcion: '' })
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="text-sm text-[#64748B]">
            Nadador
            <select required value={nadadorFormulario} onChange={(e) => setForm({ ...form, nadador_id: e.target.value })} className={CAMPO}>
              <option value="">Elegí un nadador</option>
              {datos?.nadadores.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm text-[#64748B]">
            Tipo de meta
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoObjetivo })} className={CAMPO}>
              {(Object.keys(NOMBRE_TIPO) as TipoObjetivo[]).map((t) => <option key={t} value={t}>{NOMBRE_TIPO[t]}</option>)}
            </select>
            <span className="mt-1 block text-xs text-[#94A3B8]">{AYUDA[form.tipo]}</span>
          </label>
          <label className="text-sm text-[#64748B]">
            Meta ({UNIDAD_TIPO[form.tipo]})
            <input required inputMode="decimal" value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })} className={CAMPO} placeholder={form.tipo === 'distancia' ? '2000' : form.tipo === 'velocidad' ? '1.30' : '20.5'} />
          </label>
          <label className="text-sm text-[#64748B]">Desde<input required type="date" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} className={CAMPO} /></label>
          <label className="text-sm text-[#64748B]">Hasta<input required type="date" min={form.desde} value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} className={CAMPO} /></label>
          <label className="text-sm text-[#64748B]">Descripción (opcional)<input maxLength={200} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className={CAMPO} /></label>
          <div><button type="submit" className={BOTON.primario}><Plus className="size-4" /> Crear objetivo</button></div>
        </form>
      </Tarjeta>

      <Tarjeta
        className="mt-6"
        titulo="Objetivos"
        subtitulo={datos ? `${todos.filter((c) => c.alcanzado).length} alcanzados · ${todos.filter((c) => !c.alcanzado && c.estado !== 'vencido').length} pendientes · ${todos.filter((c) => c.estado === 'vencido').length} vencidos` : undefined}
        accion={
          <div className="flex flex-wrap gap-2">
            <select value={deNadador} onChange={(e) => setDeNadador(e.target.value)} className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm" aria-label="Filtrar por nadador">
              <option value="">Todos los nadadores</option>
              {datos?.nadadores.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
            </select>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm" aria-label="Filtrar por estado">
              <option value="todos">Todos</option><option value="pendientes">Pendientes</option><option value="alcanzados">Alcanzados</option><option value="vencidos">Vencidos</option>
            </select>
          </div>
        }
      >
        {aviso && <div className="mb-4"><Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso></div>}
        {datos && lista.length === 0 && <Aviso>No hay objetivos con este filtro.</Aviso>}
        <div className="flex flex-col divide-y divide-[#F1F5F9]">
          {lista.map(({ o, c }) => (
            <div key={o.id} className="py-4">
              {editando?.id === o.id ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const ok = await hacer(() => api.actualizarObjetivo(o.id, { meta: Number(editando.meta.replace(',', '.')), desde: editando.desde, hasta: editando.hasta }), 'Objetivo actualizado.')
                    if (ok) setEditando(null)
                  }}
                  className="flex flex-wrap items-end gap-3"
                >
                  <p className="w-full text-sm font-medium">{o.nadador} · {NOMBRE_TIPO[o.tipo]}</p>
                  <label className="text-sm text-[#64748B]">Meta ({UNIDAD_TIPO[o.tipo]})<input value={editando.meta} onChange={(e) => setEditando({ ...editando, meta: e.target.value })} className={CAMPO} /></label>
                  <label className="text-sm text-[#64748B]">Desde<input type="date" value={editando.desde} onChange={(e) => setEditando({ ...editando, desde: e.target.value })} className={CAMPO} /></label>
                  <label className="text-sm text-[#64748B]">Hasta<input type="date" value={editando.hasta} onChange={(e) => setEditando({ ...editando, hasta: e.target.value })} className={CAMPO} /></label>
                  <button type="submit" className={BOTON.primario}>Guardar</button>
                  <button type="button" onClick={() => setEditando(null)} className={BOTON.terciario}>Cancelar</button>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1"><ProgresoObjetivo o={o} c={c} nombre /></div>
                  <button onClick={() => setEditando({ id: o.id, meta: String(o.meta), desde: o.desde, hasta: o.hasta })} className="rounded-lg p-2 text-[#64748B] hover:bg-[#F1F5F9]" aria-label="Modificar objetivo"><Pencil className="size-4" /></button>
                  <button
                    onClick={() => window.confirm(`¿Borrar el objetivo de ${o.nadador}?`) && void hacer(() => api.borrarObjetivo(o.id), 'Objetivo borrado.')}
                    className="rounded-lg p-2 text-[#DC2626] hover:bg-[#FEF2F2]"
                    aria-label="Borrar objetivo"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Tarjeta>
    </>
  )
}
