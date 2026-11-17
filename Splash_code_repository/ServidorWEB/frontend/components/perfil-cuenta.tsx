'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Encabezado, iniciales } from '@/components/nadador/shell'
import { Aviso, BOTON, CAMPO, Tarjeta } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import { useCuenta } from '@/lib/cuenta'
import { fechaCorta } from '@/lib/largos'

const mensaje = (e: unknown, porDefecto: string) => (e instanceof ErrorApi ? [e.message, ...e.detalles].join(' ') : porDefecto)

/**
 * El perfil de la cuenta (cualquier rol): datos personales, editar nombre y teléfono, cambiar la contraseña y cerrar
 * sesión. `children` agrega lo propio de cada rol debajo de los datos (por ejemplo, los grupos del nadador).
 */
export function PerfilCuenta({ rol, children }: { rol: string; children?: React.ReactNode }) {
  const cuenta = useCuenta()
  const router = useRouter()
  const usuario = cuenta.usuario

  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [avisoNombre, setAvisoNombre] = useState<{ tipo: 'info' | 'error'; texto: string } | null>(null)

  const [claves, setClaves] = useState({ actual: '', nueva: '', repetida: '' })
  const [guardandoClave, setGuardandoClave] = useState(false)
  const [avisoClave, setAvisoClave] = useState<{ tipo: 'info' | 'error'; texto: string } | null>(null)

  if (!usuario) return null

  async function guardarNombre(e: React.FormEvent) {
    e.preventDefault()
    setGuardandoNombre(true)
    setAvisoNombre(null)
    try {
      const { usuario: nuevo } = await api.actualizarPerfil({ nombre: nombre.trim(), telefono: telefono.trim() || null })
      cuenta.actualizado(nuevo)
      setEditando(false)
      setAvisoNombre({ tipo: 'info', texto: 'Datos actualizados.' })
    } catch (err) {
      setAvisoNombre({ tipo: 'error', texto: mensaje(err, 'No se pudo guardar el nombre.') })
    } finally {
      setGuardandoNombre(false)
    }
  }

  async function cambiarClave(e: React.FormEvent) {
    e.preventDefault()
    setAvisoClave(null)
    if (claves.nueva !== claves.repetida) {
      setAvisoClave({ tipo: 'error', texto: 'Las dos contraseñas nuevas no coinciden.' })
      return
    }
    setGuardandoClave(true)
    try {
      await api.cambiarContrasena({ actual: claves.actual, nueva: claves.nueva })
      setClaves({ actual: '', nueva: '', repetida: '' })
      setAvisoClave({ tipo: 'info', texto: 'Contraseña cambiada.' })
    } catch (err) {
      setAvisoClave({ tipo: 'error', texto: mensaje(err, 'No se pudo cambiar la contraseña.') })
    } finally {
      setGuardandoClave(false)
    }
  }

  async function salir() {
    await cuenta.salir()
    router.push('/')
  }


  return (
    <>
      <Encabezado titulo="Mi perfil" bajada="Tu información personal. Las estadísticas y los datos administrativos no se modifican desde acá." />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Tarjeta
          titulo="Información personal"
          accion={
            !editando && (
              <button
                onClick={() => {
                  setNombre(usuario.nombre)
                  setTelefono(usuario.telefono ?? '')
                  setEditando(true)
                  setAvisoNombre(null)
                }}
                className={BOTON.secundario}
              >
                Editar perfil
              </button>
            )
          }
        >
          <div className="flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-xl font-semibold text-[#1D4ED8]" aria-hidden="true">
              {iniciales(usuario.nombre)}
            </span>
            <div className="min-w-0">
              {editando ? (
                <form onSubmit={guardarNombre} className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[14rem] flex-1 text-sm text-[#64748B]">
                    Nombre completo
                    <input required autoFocus maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} />
                  </label>
                  <label className="min-w-[10rem] flex-1 text-sm text-[#64748B]">
                    Teléfono (opcional)
                    <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={CAMPO} />
                  </label>
                  <button type="submit" disabled={guardandoNombre || !nombre.trim()} className={BOTON.primario}>{guardandoNombre ? 'Guardando…' : 'Guardar'}</button>
                  <button type="button" onClick={() => setEditando(false)} className={BOTON.terciario}>Cancelar</button>
                </form>
              ) : (
                <>
                  <p className="truncate text-lg font-semibold text-[#0F172A]">{usuario.nombre}</p>
                  <p className="text-sm text-[#64748B]">{rol}</p>
                </>
              )}
            </div>
          </div>
          {avisoNombre && <div className="mt-4"><Aviso tipo={avisoNombre.tipo}>{avisoNombre.texto}</Aviso></div>}

          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <Dato k="Correo electrónico" v={usuario.email} />
            <Dato k="Teléfono" v={usuario.telefono ?? '—'} />
            <Dato k="Identificación" v={<span className="font-mono text-xs">{usuario.id}</span>} />
            <Dato k="Fecha de registro" v={usuario.creado_en ? fechaCorta(usuario.creado_en) : '—'} />
            <Dato
              k="Estado de la cuenta"
              v={
                usuario.activo ? (
                  <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-semibold text-[#166534]">Activa</span>
                ) : (
                  <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-xs font-semibold text-[#991B1B]">Desactivada</span>
                )
              }
            />
          </dl>

          {children}
          <p className="mt-6 text-xs text-[#94A3B8]">La fotografía de perfil todavía no está disponible: se muestran tus iniciales.</p>
        </Tarjeta>

        <div className="flex flex-col gap-6">
          <Tarjeta titulo="Cambiar contraseña" subtitulo="Por seguridad, primero escribí la actual.">
            <form onSubmit={cambiarClave} className="flex flex-col gap-3">
              <label className="text-sm text-[#64748B]">
                Contraseña actual
                <input required type="password" autoComplete="current-password" value={claves.actual} onChange={(e) => setClaves({ ...claves, actual: e.target.value })} className={CAMPO} />
              </label>
              <label className="text-sm text-[#64748B]">
                Contraseña nueva
                <input required type="password" minLength={8} autoComplete="new-password" placeholder="Al menos 8 caracteres" value={claves.nueva} onChange={(e) => setClaves({ ...claves, nueva: e.target.value })} className={CAMPO} />
              </label>
              <label className="text-sm text-[#64748B]">
                Repetí la contraseña nueva
                <input required type="password" minLength={8} autoComplete="new-password" value={claves.repetida} onChange={(e) => setClaves({ ...claves, repetida: e.target.value })} className={CAMPO} />
              </label>
              {avisoClave && <Aviso tipo={avisoClave.tipo}>{avisoClave.texto}</Aviso>}
              <button type="submit" disabled={guardandoClave} className={BOTON.secundario}>{guardandoClave ? 'Cambiando…' : 'Cambiar contraseña'}</button>
            </form>
          </Tarjeta>

          <Tarjeta titulo="Sesión">
            <button onClick={salir} className={`${BOTON.terciario} w-full`}><LogOut className="size-4" /> Cerrar sesión</button>
          </Tarjeta>
        </div>
      </div>
    </>
  )
}

function Dato({ k, v, nota }: { k: string; v: React.ReactNode; nota?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#64748B]">{k}</dt>
      <dd className="mt-0.5 break-words font-semibold text-[#0F172A]">{v}</dd>
      {nota && <dd className="text-xs text-[#94A3B8]">{nota}</dd>}
    </div>
  )
}
