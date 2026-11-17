'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { use } from 'react'

import { DetalleSesion } from '@/components/nadador/detalle-sesion'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, useMisSesiones } from '@/components/nadador/ui'
import { fechaCorta, horaCorta } from '@/lib/largos'

/** Detalle de una sesión del nadador (el backend solo devuelve las suyas, y de ellas solo su carril). */
export default function DetalleDeSesion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { filas, problema } = useMisSesiones()
  const fila = filas?.find((f) => f.sesion.id === id) ?? null

  return (
    <>
      <Link href="/nadador/sesiones" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:underline">
        <ArrowLeft className="size-4" /> Mis sesiones
      </Link>
      <Encabezado
        titulo="Detalle de la sesión"
        bajada={fila ? `${fechaCorta(fila.sesion.inicio)}, ${horaCorta(fila.sesion.inicio)}${fila.sesion.iniciada_por ? ` · iniciada por ${fila.sesion.iniciada_por}` : ''}` : undefined}
      />
      {problema && <Aviso tipo="error">{problema}</Aviso>}
      {!problema && filas === null && <p className="text-sm text-[#64748B]">Cargando…</p>}
      {filas && !fila && <Aviso>No encontramos esa sesión entre las tuyas.</Aviso>}
      {fila && <DetalleSesion sesion={fila.sesion} />}
    </>
  )
}
