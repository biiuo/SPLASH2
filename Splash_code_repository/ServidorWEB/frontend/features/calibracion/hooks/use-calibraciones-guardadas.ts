'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CalibracionResumen } from '@/domain/calibracion/calibracion-resumen'
import { listarCalibraciones } from '../model/listar-calibraciones'
import type { PuertoAdministrarCalibraciones } from '../model/puerto-calibraciones'

export function useCalibracionesGuardadas(puerto: PuertoAdministrarCalibraciones) {
  const [lista, setLista] = useState<CalibracionResumen[] | null>(null)
  const [problema, setProblema] = useState<string | null>(null)
  const [activando, setActivando] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null)

  const cargar = useCallback(() => {
    return listarCalibraciones(puerto)
      .then((calibraciones) => {
        setLista(calibraciones)
        setProblema(null)
      })
      .catch((error: unknown) => {
        setProblema(puerto.mensajeError(error, 'No se pudieron cargar las calibraciones.'))
      })
  }, [puerto])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function activar(id: string) {
    setActivando(id)
    try {
      await puerto.activar(id)
      await cargar()
    } catch (error) {
      setProblema(puerto.mensajeError(error, 'No se pudo activar la calibración.'))
    } finally {
      setActivando(null)
    }
  }

  async function desactivar() {
    if (!window.confirm('¿Dejar de usar esta posición? No va a quedar ninguna activa y no se podrán empezar sesiones hasta elegir una.')) return
    setActivando('ninguna')
    try {
      await puerto.desactivar()
      await cargar()
    } catch (error) {
      setProblema(puerto.mensajeError(error, 'No se pudo desactivar la calibración.'))
    } finally {
      setActivando(null)
    }
  }

  async function eliminar(calibracion: CalibracionResumen) {
    const nombre = calibracion.nombre ?? 'esta posición sin nombre'
    if (!window.confirm(`¿Eliminar «${nombre}»? Se borran sus puntos, zonas e imagen y no se puede deshacer. Las sesiones que ya la usaron conservan sus resultados.`)) return
    setActivando(`eliminar:${calibracion.id}`)
    try {
      await puerto.eliminar(calibracion.id)
      await cargar()
    } catch (error) {
      setProblema(puerto.mensajeError(error, 'No se pudo eliminar la calibración.'))
    } finally {
      setActivando(null)
    }
  }

  async function renombrar() {
    if (!editando) return
    try {
      await puerto.renombrar(editando.id, editando.nombre.trim() || null)
      setEditando(null)
      await cargar()
    } catch (error) {
      setProblema(puerto.mensajeError(error, 'No se pudo cambiar el nombre.', true))
    }
  }

  return { lista, problema, activando, editando, setEditando, activar, desactivar, eliminar, renombrar }
}
