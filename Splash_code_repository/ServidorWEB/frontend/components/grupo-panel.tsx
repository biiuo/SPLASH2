'use client'

import { Pencil, Plus, Search, Trash2, UserMinus, UserPlus, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ErrorApi, api } from '@/lib/api'
import type { Grupo, NadadorDeLaLista } from '@/lib/tipos'

/** Sin tildes ni mayúsculas, para buscar "sofia" y encontrar "Sofía". */
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Los grupos del entrenador. Puede tener varios (por nivel, horario...) y un nadador puede estar en varios. Se elige un
 * grupo y, de la lista de TODOS los nadadores registrados, se agrega o se saca a cada uno.
 */
export function GrupoPanel() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [nadadores, setNadadores] = useState<NadadorDeLaLista[]>([])
  const [elegido, setElegido] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    try {
      const [g, n] = await Promise.all([api.grupos(), api.todosLosNadadores()])
      setGrupos(g)
      setNadadores(n)
      setElegido((actual) => (actual && g.some((x) => x.id === actual) ? actual : (g[0]?.id ?? null)))
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof ErrorApi ? e.message : 'No se pudieron cargar los grupos.' })
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function hacer(accion: () => Promise<unknown>, ok: string) {
    setOcupado(true)
    setMensaje(null)
    try {
      await accion()
      setMensaje({ ok: true, texto: ok })
      await cargar()
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof ErrorApi ? e.message : 'No se pudo hacer el cambio.' })
    } finally {
      setOcupado(false)
    }
  }

  const grupo = grupos?.find((g) => g.id === elegido) ?? null
  const lista = useMemo(() => {
    const q = normal(busqueda.trim())
    const enGrupo = (n: NadadorDeLaLista) => (grupo ? n.mis_grupos.includes(grupo.id) : false)
    return nadadores
      .filter((n) => !q || normal(n.nombre).includes(q) || normal(n.email ?? '').includes(q))
      .sort((a, b) => Number(enGrupo(b)) - Number(enGrupo(a)) || a.nombre.localeCompare(b.nombre, 'es'))
  }, [nadadores, busqueda, grupo])
  const nombreGrupo = (id: string) => grupos?.find((g) => g.id === id)?.nombre ?? ''

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="titulo-grupos">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-blue-600" />
        <h3 id="titulo-grupos" className="font-semibold">Mis grupos</h3>
        {grupos && <span className="text-sm text-slate-400">· {grupos.length}</span>}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Armá tus grupos con los nadadores registrados. Al iniciar una sesión elegís de qué grupo es, o la dejás libre para cualquiera.
      </p>

      {/* grupos */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {grupos?.map((g) => (
          <button
            key={g.id}
            onClick={() => setElegido(g.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${g.id === elegido ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {g.nombre} <span className="text-xs text-slate-400">({g.nadadores.length})</span>
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const n = nuevo.trim()
            if (n) void hacer(async () => { const g = await api.crearGrupo(n); setElegido(g.id); setNuevo('') }, `Grupo "${n}" creado.`)
          }}
          className="flex items-center gap-1.5"
        >
          <input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder="Nuevo grupo"
            maxLength={60}
            className="w-36 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm outline-none focus:border-blue-500"
            aria-label="Nombre del nuevo grupo"
          />
          <button type="submit" disabled={ocupado || !nuevo.trim()} className="rounded-full bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50" aria-label="Crear grupo">
            <Plus className="size-4" />
          </button>
        </form>
      </div>

      {mensaje && (
        <p role={mensaje.ok ? 'status' : 'alert'} className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${mensaje.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {mensaje.texto}
        </p>
      )}
      {grupos?.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Todavía no tenés grupos: creá el primero.</p>}

      {grupo && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              {grupo.nombre} <span className="text-sm font-normal text-slate-400">· {grupo.nadadores.length} {grupo.nadadores.length === 1 ? 'nadador' : 'nadadores'}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const n = window.prompt('Nuevo nombre del grupo', grupo.nombre)?.trim()
                  if (n && n !== grupo.nombre) void hacer(() => api.renombrarGrupo(grupo.id, n), 'Nombre cambiado.')
                }}
                disabled={ocupado}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Pencil className="size-3.5" /> Renombrar
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`¿Borrar el grupo "${grupo.nombre}"? Los nadadores no se borran.`)) void hacer(() => api.borrarGrupo(grupo.id), 'Grupo borrado.')
                }}
                disabled={ocupado}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="size-3.5" /> Borrar
              </button>
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-blue-500">
            <Search className="size-4 text-slate-400" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar nadador por nombre o correo" className="flex-1 text-sm outline-none" aria-label="Buscar nadador" />
          </label>

          {nadadores.length === 0 && <p className="mt-3 text-sm text-slate-500">Todavía no hay nadadores registrados.</p>}
          <ul className="mt-2 max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {lista.map((n) => {
              const esta = n.mis_grupos.includes(grupo.id)
              const otros = n.mis_grupos.filter((id) => id !== grupo.id).map(nombreGrupo).filter(Boolean)
              return (
                <li key={n.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n.nombre}</p>
                    <p className="truncate text-xs text-slate-400">
                      {n.email}
                      {otros.length > 0 && <span> · también en {otros.join(', ')}</span>}
                    </p>
                  </div>
                  {esta ? (
                    <button
                      onClick={() => void hacer(() => api.quitarDeGrupo(grupo.id, n.id), `${n.nombre} salió de "${grupo.nombre}".`)}
                      disabled={ocupado}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <UserMinus className="size-3.5" /> Sacar
                    </button>
                  ) : (
                    <button
                      onClick={() => void hacer(() => api.agregarAGrupo(grupo.id, n.id), `${n.nombre} está ahora en "${grupo.nombre}".`)}
                      disabled={ocupado}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <UserPlus className="size-3.5" /> Agregar
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
