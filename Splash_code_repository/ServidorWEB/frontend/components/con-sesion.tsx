'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { NOMBRE_ROL, useCuenta } from '@/lib/cuenta'
import type { Rol } from '@/lib/tipos'

/**
 * Muestra el contenido solo con la sesión iniciada (y, si se indica, con alguno de esos roles). Es solo para la
 * pantalla: quien de verdad controla los permisos es el backend.
 */
export function ConSesion({ roles, children }: { roles?: Rol[]; children: ReactNode }) {
  const { usuario, cargando } = useCuenta()

  if (cargando) return <Aviso>Cargando…</Aviso>
  if (!usuario) {
    return (
      <Aviso>
        Tenés que iniciar sesión para ver esta página.{' '}
        <Link href="/?ingresar" className="font-semibold text-blue-600 underline">Iniciar sesión</Link>
      </Aviso>
    )
  }
  if (roles && !roles.includes(usuario.rol)) {
    return (
      <Aviso>
        Esta página es para {roles.map((r) => NOMBRE_ROL[r].toLowerCase()).join(' o ')}. Ingresaste como{' '}
        {NOMBRE_ROL[usuario.rol].toLowerCase()}. <Link href="/" className="font-semibold text-blue-600 underline">Volver al inicio</Link>
      </Aviso>
    )
  }
  return <>{children}</>
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <p className="max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center text-sm text-slate-600">{children}</p>
    </main>
  )
}
