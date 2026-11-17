'use client'

import { use } from 'react'

import { DetalleSesionPagina } from '@/features/historial'

export default function DetalleSesionAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <DetalleSesionPagina id={id} volver={{ href: '/admin/sesiones', texto: 'Sesiones' }} />
}
