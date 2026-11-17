'use client'

import { Clock, Plus, Users } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { metricas, useDatosEntrenador } from '@/components/entrenador/datos'
import { DiasSemana, FondoAgua, Nivel, textoHorario } from '@/components/entrenador/grupos-ui'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, CAMPO } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import { formatearMetros, formatearVel } from '@/lib/largos'

const MES = 30 * 24 * 60 * 60 * 1000

/** Mis grupos: una tarjeta grande por grupo, con su horario, sus nadadores y cómo le fue el último mes. */
export default function MisGrupos() {
  const { datos, problema, recargar } = useDatosEntrenador()
  const [nuevo, setNuevo] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    const n = nuevo.trim()
    if (!n) return
    try {
      await api.crearGrupo(n)
      setNuevo('')
      setAviso(null)
      await recargar()
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo crear el grupo.')
    }
  }

  return (
    <>
      <Encabezado titulo="Mis grupos" bajada="Cada grupo con su horario y sus nadadores. Entrá a uno para sumar nadadores, configurarlo y ver sus estadísticas." />
      {problema && <div className="mb-6"><Aviso tipo="error">{problema}</Aviso></div>}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {datos?.grupos.map((g, i) => {
          // el último mes, en las sesiones de este grupo
          const filas = datos.sesiones
            .filter((s) => s.grupo_id === g.id && s.estado !== 'cancelada' && Date.parse(s.inicio) >= Date.now() - MES)
            .flatMap((s) => s.por_carril.map((c) => ({ sesion: s, carril: c })))
          const m = metricas(filas)
          const horario = textoHorario(g.horario)
          return (
            <Link key={g.id} href={`/entrenador/grupos/${g.id}`} className="group block rounded-3xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300">
              <FondoAgua paleta={i} className="flex h-full min-h-[15rem] flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl font-bold leading-tight tracking-tight">{g.nombre}</h2>
                  <Nivel n={g.nivel} claro />
                </div>
                {g.descripcion && <p className="mt-1 line-clamp-2 text-sm text-blue-100">{g.descripcion}</p>}
                <div className="mt-5 flex items-end gap-2">
                  <span className="text-5xl font-bold leading-none">{g.nadadores.length}</span>
                  <span className="pb-1 text-sm text-blue-100">{g.nadadores.length === 1 ? 'nadador' : 'nadadores'}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <DiasSemana h={g.horario} claro />
                  <span className="inline-flex items-center gap-1 text-xs text-blue-100"><Clock className="size-3.5" />{horario ? `${g.horario?.inicio}–${g.horario?.fin}` : 'Sin horario'}</span>
                </div>
                <div className="mt-auto flex gap-4 pt-5 text-xs text-blue-100">
                  <span>Último mes: <strong className="text-white">{formatearMetros(m.distancia_m)}</strong></span>
                  <span>Vel. media: <strong className="text-white">{formatearVel(m.velocidad_media_ms)}</strong></span>
                </div>
              </FondoAgua>
            </Link>
          )
        })}

        {/* nuevo grupo */}
        <form onSubmit={crear} className="flex min-h-[15rem] flex-col justify-center gap-3 rounded-3xl border-2 border-dashed border-[#BFDBFE] bg-white p-6">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]"><Users className="size-5" /></span>
          <p className="font-semibold text-[#0F172A]">Nuevo grupo</p>
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} maxLength={60} placeholder="Por ejemplo: Avanzados mañana" className={CAMPO} aria-label="Nombre del grupo nuevo" />
          <button type="submit" disabled={!nuevo.trim()} className={BOTON.primario}><Plus className="size-4" /> Crear grupo</button>
          {aviso && <p className="text-xs text-[#991B1B]">{aviso}</p>}
        </form>
      </div>
      {datos && datos.grupos.length === 0 && <p className="mt-4 text-sm text-[#64748B]">Todavía no tenés grupos: creá el primero.</p>}
    </>
  )
}
