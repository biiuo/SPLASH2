'use client'

// Quién tiene la sesión iniciada. Se pregunta al backend una vez (GET /api/auth/yo) y se comparte entre todas las
// pantallas. El token no pasa por acá: vive en una cookie que solo ve la web (ver app/api/[...ruta]/route.ts).
import { useEffect, useSyncExternalStore } from 'react'

import { EVENTO_SIN_SESION, ErrorApi, api } from './api'
import type { Rol, Usuario } from './tipos'

type Estado = { usuario: Usuario | null; cargando: boolean }

let estado: Estado = { usuario: null, cargando: true }
let pedido: Promise<void> | null = null
const oyentes = new Set<() => void>()

function fijar(nuevo: Estado) {
  estado = nuevo
  oyentes.forEach((o) => o())
}

function cargar() {
  pedido ??= api
    .yo()
    .then((usuario) => fijar({ usuario, cargando: false }))
    .catch((e) => {
      // 401 = no hay sesión; cualquier otro error (backend caído) también deja la pantalla de ingreso
      if (!(e instanceof ErrorApi) || e.estado !== 401) console.warn('No se pudo saber quién tiene la sesión:', e)
      fijar({ usuario: null, cargando: false })
    })
  return pedido
}

const ESTADO_SERVIDOR: Estado = { usuario: null, cargando: true }

export function useCuenta() {
  const actual = useSyncExternalStore(
    (o) => {
      oyentes.add(o)
      return () => oyentes.delete(o)
    },
    () => estado,
    () => ESTADO_SERVIDOR,
  )

  useEffect(() => {
    void cargar()
    const sinSesion = () => fijar({ usuario: null, cargando: false })
    window.addEventListener(EVENTO_SIN_SESION, sinSesion)
    return () => window.removeEventListener(EVENTO_SIN_SESION, sinSesion)
  }, [])

  return {
    ...actual,
    async ingresar(email: string, contrasena: string) {
      const { usuario } = await api.ingresar({ email, contrasena })
      fijar({ usuario, cargando: false })
      return usuario
    },
    async registrarse(datos: { email: string; nombre: string; contrasena: string; rol: 'nadador' | 'entrenador' }) {
      const { usuario } = await api.registrarse(datos)
      fijar({ usuario, cargando: false })
      return usuario
    },
    async salir() {
      await api.salir()
      pedido = null
      fijar({ usuario: null, cargando: false })
    },
  }
}

export const NOMBRE_ROL: Record<Rol, string> = { administrador: 'Administrador', entrenador: 'Entrenador', nadador: 'Nadador' }

export const puedeCalibrar = (u: Usuario | null) => u?.rol === 'entrenador' || u?.rol === 'administrador'
