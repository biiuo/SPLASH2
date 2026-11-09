'use client'

import { UserMinus, UserPlus, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { ErrorApi, api } from '@/lib/api'
import type { NadadorDelGrupo } from '@/lib/tipos'

/** El grupo del entrenador: agregar nadadores (por el correo de su cuenta) y sacarlos. */
export function GrupoPanel() {
  const [grupo, setGrupo] = useState<NadadorDelGrupo[] | null>(null)
  const [email, setEmail] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    try {
      setGrupo(await api.grupo())
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof ErrorApi ? e.message : 'No se pudo cargar el grupo.' })
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setOcupado(true)
    setMensaje(null)
    try {
      const n = await api.agregarAlGrupo(email.trim())
      setMensaje({ ok: true, texto: `${n.nombre} está ahora en tu grupo.` })
      setEmail('')
      await cargar()
    } catch (err) {
      setMensaje({ ok: false, texto: err instanceof ErrorApi ? err.message : 'No se pudo agregar.' })
    } finally {
      setOcupado(false)
    }
  }

  async function quitar(n: NadadorDelGrupo) {
    if (!window.confirm(`¿Sacar a ${n.nombre} de tu grupo?`)) return
    setOcupado(true)
    setMensaje(null)
    try {
      await api.quitarDelGrupo(n.id)
      await cargar()
    } catch (err) {
      setMensaje({ ok: false, texto: err instanceof ErrorApi ? err.message : 'No se pudo sacar.' })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="titulo-grupo">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-blue-600" />
        <h3 id="titulo-grupo" className="font-semibold">Mi grupo</h3>
        {grupo && <span className="text-sm text-slate-400">· {grupo.length} {grupo.length === 1 ? 'nadador' : 'nadadores'}</span>}
      </div>
      <p className="mt-1 text-sm text-slate-500">Los nadadores que podés asignar a los carriles de tus sesiones. Tienen que tener su cuenta creada.</p>

      <form onSubmit={agregar} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo de la cuenta del nadador"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
          aria-label="Correo del nadador"
        />
        <button
          type="submit"
          disabled={ocupado || !email.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <UserPlus className="size-4" /> Agregar
        </button>
      </form>
      {mensaje && (
        <p role={mensaje.ok ? 'status' : 'alert'} className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${mensaje.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {mensaje.texto}
        </p>
      )}

      {grupo && grupo.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Todavía no agregaste a nadie.</p>}
      {grupo && grupo.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100">
          {grupo.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{n.nombre}</p>
                <p className="truncate text-xs text-slate-400">{n.email}</p>
              </div>
              <button
                onClick={() => quitar(n)}
                disabled={ocupado}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <UserMinus className="size-3.5" /> Sacar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
