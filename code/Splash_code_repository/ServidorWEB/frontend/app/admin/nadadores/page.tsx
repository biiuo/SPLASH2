'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { estadisticasDe } from '@/components/admin/comun'
import { GestionUsuarios } from '@/components/admin/gestion-usuarios'
import { Encabezado } from '@/components/nadador/shell'
import { api } from '@/lib/api'
import { fechaCorta, formatearMetros, formatearVel } from '@/lib/largos'
import type { ResumenSesion } from '@/lib/tipos'

/** Gestión de nadadores: cuentas, estado y sus estadísticas individuales. */
export default function NadadoresAdmin() {
  const [sesiones, setSesiones] = useState<ResumenSesion[]>([])
  useEffect(() => {
    api.sesionesRecientes(500).then(setSesiones).catch(() => setSesiones([]))
  }, [])
  const est = (id: string) => estadisticasDe(id, sesiones)

  return (
    <>
      <Encabezado titulo="Nadadores" bajada="Registrar, editar, activar o desactivar nadadores y ver sus estadísticas." />
      <GestionUsuarios
        rol="nadador"
        extra={[
          { titulo: 'Sesiones', celda: (u) => String(est(u.id).sesiones) },
          { titulo: 'Distancia', celda: (u) => formatearMetros(est(u.id).distancia_m) },
          { titulo: 'Mejor velocidad', celda: (u) => formatearVel(est(u.id).velocidad_max_ms) },
          { titulo: 'Última sesión', celda: (u) => (est(u.id).ultima ? fechaCorta(est(u.id).ultima as string) : '—') },
          {
            titulo: 'Historial',
            celda: (u) => (est(u.id).sesiones ? <Link href={`/admin/sesiones?usuario=${u.id}`} className="text-xs font-semibold text-[#2563EB] hover:underline">Ver sesiones</Link> : '—'),
          },
        ]}
      />
    </>
  )
}
