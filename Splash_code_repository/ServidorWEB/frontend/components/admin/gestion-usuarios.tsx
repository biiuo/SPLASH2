'use client'

import { ChevronLeft, ChevronRight, KeyRound, Pencil, Plus, Search, UserCheck, UserX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Aviso, BOTON, CAMPO, Tarjeta } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import { NOMBRE_ROL, useCuenta } from '@/lib/cuenta'
import { fechaCorta } from '@/lib/largos'
import type { Rol, Usuario } from '@/lib/tipos'

const ROLES: Rol[] = ['nadador', 'entrenador', 'administrador']
const POR_PAGINA = 10
const mensaje = (e: unknown, d: string) => (e instanceof ErrorApi ? [e.message, ...e.detalles].join(' ') : d)

/**
 * Buscar, crear, editar, activar o desactivar cuentas y restablecer contraseñas. Con `rol`, la lista y las cuentas
 * nuevas son solo de ese rol (Nadadores, Entrenadores); sin él, de todos (Usuarios y permisos, donde se cambia el rol).
 * `extra` agrega columnas propias de cada página (por ejemplo, las estadísticas de un nadador).
 */
export function GestionUsuarios({
  rol,
  extra,
  alCambiar,
}: {
  rol?: Rol
  extra?: { titulo: string; celda: (u: Usuario) => React.ReactNode }[]
  alCambiar?: () => void
}) {
  const yo = useCuenta().usuario
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [texto, setTexto] = useState('')
  const [filtroRol, setFiltroRol] = useState<Rol | ''>(rol ?? '')
  const [activo, setActivo] = useState<'' | 'true' | 'false'>('')
  const [aviso, setAviso] = useState<{ tipo: 'info' | 'error'; texto: string } | null>(null)
  const [creando, setCreando] = useState(false)
  const [nuevo, setNuevo] = useState({ nombre: '', email: '', telefono: '', contrasena: '', rol: rol ?? ('nadador' as Rol) })
  const [editando, setEditando] = useState<{ id: string; nombre: string; telefono: string; rol: Rol } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await api.adminUsuarios({ texto: texto.trim(), rol: rol ?? filtroRol, activo, pagina, porPagina: POR_PAGINA })
      // si se borró la última de una página (o cambió el filtro), volver a una que exista
      if (!r.usuarios.length && r.total && pagina > 1) return setPagina(Math.ceil(r.total / POR_PAGINA))
      setUsuarios(r.usuarios)
      setTotal(r.total)
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensaje(e, 'No se pudieron cargar los usuarios.') })
    }
  }, [texto, rol, filtroRol, activo, pagina])

  // un filtro nuevo vuelve a la primera página
  useEffect(() => setPagina(1), [texto, filtroRol, activo])

  // la búsqueda espera a que se deje de escribir
  useEffect(() => {
    const t = setTimeout(() => void cargar(), 250)
    return () => clearTimeout(t)
  }, [cargar])

  async function hacer(accion: () => Promise<unknown>, ok: string) {
    setOcupado(true)
    setAviso(null)
    try {
      await accion()
      setAviso({ tipo: 'info', texto: ok })
      await cargar()
      alCambiar?.()
      return true
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensaje(e, 'No se pudo hacer el cambio.') })
      return false
    } finally {
      setOcupado(false)
    }
  }

  const etiqueta = rol ? NOMBRE_ROL[rol].toLowerCase() : 'usuario'

  return (
    <Tarjeta
      titulo={rol ? `${NOMBRE_ROL[rol]}es` : 'Usuarios'}
      subtitulo={`Buscá por correo o nombre. ${total} ${total === 1 ? 'cuenta' : 'cuentas'}, de a ${POR_PAGINA} por página.`}
      accion={<button onClick={() => setCreando(!creando)} className={BOTON.primario}><Plus className="size-4" /> Registrar {etiqueta}</button>}
    >
      {creando && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await hacer(
              () => api.adminCrearUsuario({ ...nuevo, telefono: nuevo.telefono.trim() || null }),
              `Cuenta de ${nuevo.nombre} creada. Pasale su correo y la contraseña inicial.`,
            )
            if (ok) {
              setCreando(false)
              setNuevo({ nombre: '', email: '', telefono: '', contrasena: '', rol: rol ?? 'nadador' })
            }
          }}
          className="mb-5 grid gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="text-sm text-[#64748B]">Nombre completo<input required maxLength={80} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className={CAMPO} /></label>
          <label className="text-sm text-[#64748B]">Correo<input required type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} className={CAMPO} /></label>
          <label className="text-sm text-[#64748B]">Teléfono (opcional)<input type="tel" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} className={CAMPO} /></label>
          <label className="text-sm text-[#64748B]">Contraseña inicial<input required minLength={8} type="text" value={nuevo.contrasena} onChange={(e) => setNuevo({ ...nuevo, contrasena: e.target.value })} className={CAMPO} placeholder="Al menos 8 caracteres" /></label>
          {!rol && (
            <label className="text-sm text-[#64748B]">
              Rol
              <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as Rol })} className={CAMPO}>
                {ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
              </select>
            </label>
          )}
          <div className="flex items-end gap-2">
            <button type="submit" disabled={ocupado} className={BOTON.primario}>Crear cuenta</button>
            <button type="button" onClick={() => setCreando(false)} className={BOTON.terciario}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 focus-within:border-[#2563EB]">
          <Search className="size-4 text-[#94A3B8]" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por correo o nombre" className="flex-1 text-sm outline-none" aria-label="Buscar usuario" />
        </label>
        {!rol && (
          <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value as Rol | '')} className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm" aria-label="Filtrar por rol">
            <option value="">Todos los roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
          </select>
        )}
        <select value={activo} onChange={(e) => setActivo(e.target.value as '' | 'true' | 'false')} className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm" aria-label="Filtrar por estado">
          <option value="">Activas e inactivas</option>
          <option value="true">Solo activas</option>
          <option value="false">Solo desactivadas</option>
        </select>
      </div>

      {aviso && <div className="mb-4"><Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso></div>}
      {usuarios === null && <p className="text-sm text-[#64748B]">Cargando…</p>}
      {usuarios?.length === 0 && <Aviso>Ninguna cuenta coincide.</Aviso>}
      {!!usuarios?.length && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[#94A3B8]">
              <tr>
                <th className="py-2 pr-4 font-semibold">Nombre</th>
                <th className="py-2 pr-4 font-semibold">Correo</th>
                <th className="py-2 pr-4 font-semibold">Teléfono</th>
                {!rol && <th className="py-2 pr-4 font-semibold">Rol</th>}
                <th className="py-2 pr-4 font-semibold">Estado</th>
                <th className="py-2 pr-4 font-semibold">Registro</th>
                {extra?.map((x) => <th key={x.titulo} className="py-2 pr-4 font-semibold">{x.titulo}</th>)}
                <th className="py-2 font-semibold"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) =>
                editando?.id === u.id ? (
                  <tr key={u.id} className="border-t border-[#F1F5F9] bg-[#F8FAFC]">
                    <td className="py-2 pr-2"><input value={editando.nombre} maxLength={80} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} className={CAMPO} aria-label="Nombre" /></td>
                    <td className="py-2 pr-4 text-[#64748B]">{u.email}</td>
                    <td className="py-2 pr-2"><input value={editando.telefono} onChange={(e) => setEditando({ ...editando, telefono: e.target.value })} className={CAMPO} aria-label="Teléfono" /></td>
                    {!rol && (
                      <td className="py-2 pr-2">
                        <select value={editando.rol} onChange={(e) => setEditando({ ...editando, rol: e.target.value as Rol })} className={CAMPO} aria-label="Rol">
                          {ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
                        </select>
                      </td>
                    )}
                    <td colSpan={2 + (extra?.length ?? 0)} />
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={ocupado}
                          onClick={async () => {
                            const ok = await hacer(
                              () => api.adminActualizarUsuario(u.id, { nombre: editando.nombre.trim(), telefono: editando.telefono.trim() || null, ...(rol ? {} : { rol: editando.rol }) }),
                              'Cambios guardados.',
                            )
                            if (ok) setEditando(null)
                          }}
                          className={`${BOTON.primario} px-3 py-1.5 text-xs`}
                        >
                          Guardar
                        </button>
                        <button onClick={() => setEditando(null)} className={`${BOTON.terciario} px-3 py-1.5 text-xs`}>Cancelar</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.id} className="border-t border-[#F1F5F9]">
                    <td className="py-3 pr-4 font-medium text-[#0F172A]">{u.nombre}{u.id === yo?.id && <span className="ml-1 text-xs text-[#94A3B8]">(vos)</span>}</td>
                    <td className="py-3 pr-4 text-[#64748B]">{u.email}</td>
                    <td className="py-3 pr-4 text-[#64748B]">{u.telefono ?? '—'}</td>
                    {!rol && <td className="py-3 pr-4">{NOMBRE_ROL[u.rol]}</td>}
                    <td className="py-3 pr-4">
                      {u.activo ? (
                        <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-semibold text-[#166534]">Activa</span>
                      ) : (
                        <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-xs font-semibold text-[#991B1B]">Desactivada</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-[#64748B]">{u.creado_en ? fechaCorta(u.creado_en) : '—'}</td>
                    {extra?.map((x) => <td key={x.titulo} className="py-3 pr-4">{x.celda(u)}</td>)}
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button title="Editar" aria-label={`Editar a ${u.nombre}`} onClick={() => setEditando({ id: u.id, nombre: u.nombre, telefono: u.telefono ?? '', rol: u.rol })} className="rounded-lg p-2 text-[#64748B] hover:bg-[#F1F5F9]"><Pencil className="size-4" /></button>
                        <button
                          title="Restablecer contraseña"
                          aria-label={`Restablecer la contraseña de ${u.nombre}`}
                          onClick={() => {
                            const nueva = window.prompt(`Contraseña nueva para ${u.nombre} (al menos 8 caracteres). Pasásela por un medio seguro.`)
                            if (nueva) void hacer(() => api.adminRestablecerContrasena(u.id, nueva), `Contraseña de ${u.nombre} restablecida.`)
                          }}
                          className="rounded-lg p-2 text-[#64748B] hover:bg-[#F1F5F9]"
                        >
                          <KeyRound className="size-4" />
                        </button>
                        {u.id !== yo?.id && (
                          <button
                            title={u.activo ? 'Desactivar' : 'Activar'}
                            aria-label={`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}`}
                            onClick={() => {
                              if (!u.activo || window.confirm(`¿Desactivar la cuenta de ${u.nombre}? No va a poder iniciar sesión.`)) {
                                void hacer(() => api.adminActualizarUsuario(u.id, { activo: !u.activo }), u.activo ? `${u.nombre} desactivado.` : `${u.nombre} activado.`)
                              }
                            }}
                            className={`rounded-lg p-2 hover:bg-[#F1F5F9] ${u.activo ? 'text-[#DC2626]' : 'text-[#166534]'}`}
                          >
                            {u.activo ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
      {total > POR_PAGINA && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#64748B]">
          <span>
            {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPagina(pagina - 1)} disabled={pagina <= 1} className={`${BOTON.terciario} px-3 py-1.5`} aria-label="Página anterior"><ChevronLeft className="size-4" /></button>
            <span>Página {pagina} de {Math.ceil(total / POR_PAGINA)}</span>
            <button onClick={() => setPagina(pagina + 1)} disabled={pagina >= Math.ceil(total / POR_PAGINA)} className={`${BOTON.terciario} px-3 py-1.5`} aria-label="Página siguiente"><ChevronRight className="size-4" /></button>
          </div>
        </div>
      )}
    </Tarjeta>
  )
}
