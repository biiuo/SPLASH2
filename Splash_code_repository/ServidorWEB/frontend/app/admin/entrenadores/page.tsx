'use client'

import { Check, Plus, UserMinus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { GestionUsuarios } from '@/components/admin/gestion-usuarios'
import { BuscadorNadador } from '@/components/buscador-nadador'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, CAMPO, Tarjeta } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import type { Grupo, Usuario } from '@/lib/tipos'

/** Gestión de entrenadores: sus cuentas y los nadadores asignados a cada uno (a través de sus grupos). */
export default function EntrenadoresAdmin() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'info' | 'error'; texto: string } | null>(null)
  // entrenadores a los que se les puede dar un grupo (activos) y el formulario de grupo nuevo
  const [entrenadores, setEntrenadores] = useState<Usuario[]>([])
  const [nuevo, setNuevo] = useState({ entrenador: '', nombre: '' })
  // entrenadores que se registraron y esperan aprobación
  const [solicitudes, setSolicitudes] = useState<Usuario[] | null>(null)
  const [avisoSolicitud, setAvisoSolicitud] = useState<{ tipo: 'info' | 'error'; texto: string } | null>(null)
  // al aceptar uno, la tabla de entrenadores se vuelve a montar para que aparezca
  const [version, setVersion] = useState(0)

  const cargarSolicitudes = useCallback(async () => {
    try {
      setSolicitudes((await api.adminSolicitudesEntrenador()).usuarios)
    } catch (e) {
      setSolicitudes([])
      setAvisoSolicitud({ tipo: 'error', texto: e instanceof ErrorApi ? e.message : 'No se pudieron cargar las solicitudes.' })
    }
  }, [])
  useEffect(() => {
    void cargarSolicitudes()
  }, [cargarSolicitudes])

  async function resolver(u: Usuario, aceptar: boolean) {
    if (!aceptar && !window.confirm(`¿Rechazar la solicitud de ${u.nombre} (${u.email})? Su cuenta se borra y podrá volver a registrarse.`)) return
    setAvisoSolicitud(null)
    try {
      if (aceptar) await api.adminAprobarEntrenador(u.id)
      else await api.adminRechazarEntrenador(u.id)
      setAvisoSolicitud({ tipo: 'info', texto: aceptar ? `${u.nombre} ya puede iniciar sesión como entrenador.` : `Se rechazó la solicitud de ${u.nombre}.` })
      await cargarSolicitudes()
      if (aceptar) {
        setVersion((v) => v + 1)
        await cargar()
      }
    } catch (e) {
      setAvisoSolicitud({ tipo: 'error', texto: e instanceof ErrorApi ? e.message : 'No se pudo hacer el cambio.' })
    }
  }

  const cargar = useCallback(() => {
    return Promise.all([
        api.grupos(), // al administrador le llegan los grupos de todos
        api.adminUsuarios({ rol: 'entrenador', activo: 'true', porPagina: 50 }),
        api.adminUsuarios({ rol: 'administrador', activo: 'true', porPagina: 50 }),
      ])
      .then(([g, e, a]) => {
        setGrupos(g)
        setEntrenadores([...e.usuarios, ...a.usuarios])
      })
      .catch((e: unknown) => {
        setAviso({ tipo: 'error', texto: e instanceof ErrorApi ? e.message : 'No se pudieron cargar los grupos.' })
      })
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])

  async function hacer(accion: () => Promise<unknown>, ok: string) {
    setAviso(null)
    try {
      await accion()
      setAviso({ tipo: 'info', texto: ok })
      await cargar()
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof ErrorApi ? [e.message, ...e.detalles].join(' ') : 'No se pudo hacer el cambio.' })
    }
  }

  const deEntrenador = (id: string) => (grupos ?? []).filter((g) => g.entrenador_id === id)
  /** Nadadores distintos de un entrenador: el que está en dos de sus grupos cuenta una sola vez. */
  const nadadoresDe = (id: string) => new Set(deEntrenador(id).flatMap((g) => g.nadadores.map((n) => n.id))).size
  const porEntrenador = [...new Map((grupos ?? []).map((g) => [g.entrenador_id, g.entrenador])).entries()]

  return (
    <>
      <Encabezado titulo="Entrenadores" bajada="Aceptar a quienes se registran como entrenadores, editarlos, activarlos o desactivarlos, y asignarles nadadores en sus grupos." />

      <Tarjeta
        className="mb-6"
        titulo={`Solicitudes de entrenador${solicitudes?.length ? ` (${solicitudes.length})` : ''}`}
        subtitulo="Quien se registra como entrenador no puede ingresar hasta que lo aceptes. Si lo rechazas, su cuenta se borra."
      >
        {avisoSolicitud && <div className="mb-4"><Aviso tipo={avisoSolicitud.tipo}>{avisoSolicitud.texto}</Aviso></div>}
        {solicitudes === null && <p className="text-sm text-[#64748B]">Cargando…</p>}
        {solicitudes?.length === 0 && <p className="text-sm text-[#64748B]">No hay solicitudes pendientes.</p>}
        {!!solicitudes?.length && (
          <ul className="divide-y divide-[#F1F5F9]">
            {solicitudes.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A]">{u.nombre}</p>
                  <p className="truncate text-sm text-[#64748B]">
                    {u.email}{u.telefono ? ` · ${u.telefono}` : ''}
                    {u.creado_en ? ` · se registró el ${new Date(u.creado_en).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void resolver(u, true)} className={BOTON.primario}><Check className="size-4" /> Aceptar</button>
                  <button onClick={() => void resolver(u, false)} className={BOTON.terciario}><X className="size-4" /> Rechazar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <GestionUsuarios
        key={version}
        rol="entrenador"
        alCambiar={() => void cargar()}
        extra={[
          { titulo: 'Grupos', celda: (u) => String(deEntrenador(u.id).length) },
          { titulo: 'Nadadores asignados', celda: (u) => String(nadadoresDe(u.id)) },
        ]}
      />

      <Tarjeta
        className="mt-6"
        titulo="Grupos y nadadores asignados"
        subtitulo="Un grupo pertenece al entrenador que lo creó. Acá se puede crear un grupo a nombre de un entrenador, pasárselo a otro, y sumar o quitar nadadores por el correo de su cuenta."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (nuevo.entrenador && nuevo.nombre.trim()) {
              void hacer(async () => { await api.adminCrearGrupo(nuevo.entrenador, nuevo.nombre.trim()); setNuevo({ entrenador: nuevo.entrenador, nombre: '' }) }, `Grupo "${nuevo.nombre.trim()}" creado.`)
            }
          }}
          className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
        >
          <label className="text-sm text-[#64748B]">
            Entrenador
            <select required value={nuevo.entrenador} onChange={(e) => setNuevo({ ...nuevo, entrenador: e.target.value })} className={CAMPO}>
              <option value="">Elegí un entrenador</option>
              {entrenadores.map((u) => <option key={u.id} value={u.id}>{u.nombre}{u.rol === 'administrador' ? ' (administrador)' : ''}</option>)}
            </select>
          </label>
          <label className="min-w-[12rem] flex-1 text-sm text-[#64748B]">
            Nombre del grupo
            <input required maxLength={60} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className={CAMPO} placeholder="Por ejemplo: Avanzados" />
          </label>
          <button type="submit" className={BOTON.primario}><Plus className="size-4" /> Crear grupo</button>
        </form>
        {aviso && <div className="mb-4"><Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso></div>}
        {grupos === null && <p className="text-sm text-[#64748B]">Cargando…</p>}
        {grupos?.length === 0 && <Aviso>Ningún entrenador creó grupos todavía.</Aviso>}
        <div className="flex flex-col gap-6">
          {porEntrenador.map(([id, nombre]) => (
            <section key={id}>
              <h3 className="font-semibold text-[#0F172A]">
                {nombre}{' '}
                <span className="text-sm font-normal text-[#64748B]">
                  · {deEntrenador(id).length} {deEntrenador(id).length === 1 ? 'grupo' : 'grupos'} · {nadadoresDe(id)} {nadadoresDe(id) === 1 ? 'nadador' : 'nadadores'} sin repetir
                </span>
              </h3>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {deEntrenador(id).map((g) => (
                  <div key={g.id} className="rounded-xl border border-[#E2E8F0] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{g.nombre} <span className="text-sm font-normal text-[#94A3B8]">· {g.nadadores.length}</span></p>
                      <select
                        value={g.entrenador_id}
                        onChange={(e) => {
                          const destino = entrenadores.find((u) => u.id === e.target.value)
                          if (destino && window.confirm(`¿Pasar "${g.nombre}" (con sus ${g.nadadores.length} nadadores) a ${destino.nombre}?`)) {
                            void hacer(() => api.adminAsignarGrupo(g.id, destino.id), `"${g.nombre}" ahora es de ${destino.nombre}.`)
                          }
                        }}
                        className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1 text-xs"
                        aria-label={`Entrenador de ${g.nombre}`}
                      >
                        {!entrenadores.some((u) => u.id === g.entrenador_id) && <option value={g.entrenador_id}>{g.entrenador}</option>}
                        {entrenadores.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                      </select>
                    </div>
                    <ul className="mt-2 divide-y divide-[#F1F5F9]">
                      {g.nadadores.map((n) => (
                        <li key={n.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                          <span className="min-w-0">
                            <span className="block truncate">{n.nombre}</span>
                            <span className="block truncate text-xs text-[#94A3B8]">{n.email ?? 'sin cuenta'}{n.telefono ? ` · ${n.telefono}` : ''}</span>
                          </span>
                          <button
                            onClick={() => void hacer(() => api.quitarDeGrupo(g.id, n.id), `${n.nombre} salió de "${g.nombre}".`)}
                            className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9]"
                            aria-label={`Quitar a ${n.nombre} de ${g.nombre}`}
                          >
                            <UserMinus className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2">
                      <BuscadorNadador
                        excluir={g.nadadores.map((n) => n.id)}
                        alElegir={(n) => hacer(() => api.agregarAGrupo(g.id, n.id), `${n.nombre} agregado a "${g.nombre}".`)}
                        alEscribirCorreo={(c) => hacer(() => api.agregarAGrupoPorEmail(g.id, c), `Nadador agregado a "${g.nombre}".`)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Tarjeta>
    </>
  )
}
