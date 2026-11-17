'use client'

import { use } from 'react'

import { DetalleSesionPagina } from '@/components/detalle-sesion-pagina'

export default function DetalleSesionAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <DetalleSesionPagina id={id} volver={{ href: '/admin/sesiones', texto: 'Sesiones' }} />
}
