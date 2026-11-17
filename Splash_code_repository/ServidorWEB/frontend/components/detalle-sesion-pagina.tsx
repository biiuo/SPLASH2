'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { DetalleSesion } from '@/components/nadador/detalle-sesion'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import { fechaCorta, horaCorta } from '@/lib/largos'
import type { ResumenSesion } from '@/lib/tipos'

/** Detalle de una sesión que puede ver quien mira, con sus carriles (`?carril=` elige uno). */
export function DetalleSesionPagina({ id, volver }: { id: string; volver: { href: string; texto: string } }) {
  const [carril, setCarril] = useState<number | null>(null)
  const [sesion, setSesion] = useState<ResumenSesion | null | undefined>(undefined)
  const [problema, setProblema] = useState<string | null>(null)

  useEffect(() => {
    try {
      const c = new URLSearchParams(window.location.search).get('carril')
      if (c) setCarril(Number(c))
    } catch {
      /* sin URL */
    }
    api
      .sesionesRecientes(500)
      .then((l) => setSesion(l.find((s) => s.id === id) ?? null))
      .catch((e) => setProblema(e instanceof ErrorApi ? e.message : 'No se pudo cargar la sesión.'))
  }, [id])

  return (
    <>
      <Link href={volver.href} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:underline"><ArrowLeft className="size-4" /> {volver.texto}</Link>
      <Encabezado
        titulo="Detalle de la sesión"
        bajada={sesion ? `${fechaCorta(sesion.inicio)}, ${horaCorta(sesion.inicio)} · iniciada por ${sesion.iniciada_por ?? '—'}${sesion.grupo ? ` · grupo ${sesion.grupo}` : ''}` : undefined}
      />
      {problema && <Aviso tipo="error">{problema}</Aviso>}
      {sesion === undefined && !problema && <p className="text-sm text-[#64748B]">Cargando…</p>}
      {sesion === null && <Aviso>No encontramos esa sesión entre las 500 más recientes.</Aviso>}
      {sesion && <DetalleSesion key={`${sesion.id}:${carril}`} sesion={sesion} carrilInicial={carril} />}
    </>
  )
}
