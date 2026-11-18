'use client'

// Lo que usan casi todas las páginas del entrenador: sus nadadores (los de sus grupos), sus sesiones y los objetivos.
import { useCallback, useEffect, useState } from 'react'

import { ErrorApi, api } from '@/lib/api'
import type { Grupo, NadadorDeLaLista, Objetivo, ResumenSesion } from '@/lib/tipos'

export type DatosEntrenador = {
  nadadores: NadadorDeLaLista[]
  grupos: Grupo[]
  sesiones: ResumenSesion[]
  objetivos: Objetivo[]
}

export function useDatosEntrenador() {
  const [datos, setDatos] = useState<DatosEntrenador | null>(null)
  const [problema, setProblema] = useState<string | null>(null)
  const [actualizado, setActualizado] = useState(() => Date.now())

  const cargar = useCallback(() => {
    return Promise.all([api.todosLosNadadores(), api.grupos(), api.sesionesRecientes(500), api.objetivos()])
      .then(([nadadores, grupos, sesiones, objetivos]) => {
        setDatos({ nadadores, grupos, sesiones, objetivos })
        setActualizado(Date.now())
        setProblema(null)
      })
      .catch((e: unknown) => {
        setProblema(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el servidor.')
      })
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { datos, problema, recargar: cargar, actualizado }
}

const DIA = 24 * 60 * 60 * 1000
/** Desde cuándo cuenta un período ('7', '30', '90', '365' días o 'todo'). */
export const desdePeriodo = (p: string) => (p === 'todo' ? 0 : Date.now() - Number(p) * DIA)

/** Las filas de un nadador (por su cuenta) en las sesiones, con la sesión de cada una. */
export function carrilesDe(usuarioId: string | null, sesiones: ResumenSesion[]) {
  if (!usuarioId) return []
  return sesiones.flatMap((s) => s.por_carril.filter((c) => c.usuario_id === usuarioId).map((c) => ({ sesion: s, carril: c })))
}

/** Métricas de un nadador sobre un conjunto de filas (velocidad media ponderada por distancia; récords solo detectados). */
export function metricas(filas: ReturnType<typeof carrilesDe>) {
  const metros = filas.reduce((a, f) => a + f.carril.distancia_m, 0)
  const segundos = filas.reduce((a, f) => a + (f.carril.velocidad_media_ms ? f.carril.distancia_m / f.carril.velocidad_media_ms : 0), 0)
  const vmax = filas.map((f) => f.carril.velocidad_max_ms).filter((v): v is number => v !== null)
  const mejores = filas.map((f) => f.carril.mejor_largo_s).filter((v): v is number => v !== null)
  const tramos = filas.reduce((a, f) => a + f.carril.tramos, 0)
  const estimados = filas.reduce((a, f) => a + f.carril.tramos_estimados, 0)
  return {
    sesiones: new Set(filas.map((f) => f.sesion.id)).size,
    distancia_m: metros,
    velocidad_media_ms: segundos > 0 ? metros / segundos : null,
    velocidad_max_ms: vmax.length ? Math.max(...vmax) : null,
    mejor_largo_s: mejores.length ? Math.min(...mejores) : null,
    largos: filas.reduce((a, f) => a + f.carril.largos, 0),
    estimados_pct: tramos ? (estimados / tramos) * 100 : null,
    ultima: filas.map((f) => f.sesion.inicio).sort().at(-1) ?? null,
  }
}
