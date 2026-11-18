'use client'

import { useSyncExternalStore } from 'react'

const suscribir = () => () => {}
const buscarEnServidor = () => ''
const buscarEnNavegador = () => window.location.search

/** Lee la consulta del navegador sin acceder a window durante el render del servidor. */
export function useParametroUrl(nombre: string): string | null {
  const busqueda = useSyncExternalStore(suscribir, buscarEnNavegador, buscarEnServidor)
  return new URLSearchParams(busqueda).get(nombre)
}
