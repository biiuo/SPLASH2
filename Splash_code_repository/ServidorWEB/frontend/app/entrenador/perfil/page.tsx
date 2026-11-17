'use client'

import { useEffect, useState } from 'react'

import { PerfilCuenta } from '@/components/perfil-cuenta'
import { api } from '@/lib/api'
import type { Grupo } from '@/lib/tipos'

/** Mi perfil del entrenador: la cuenta y sus grupos. */
export default function PerfilEntrenador() {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  useEffect(() => {
    api.grupos().then(setGrupos).catch(() => setGrupos([]))
  }, [])
  return (
    <PerfilCuenta rol="Entrenador">
      <h3 className="mt-6 text-sm font-semibold text-[#0F172A]">Mis grupos</h3>
      {grupos === null && <p className="mt-2 text-sm text-[#64748B]">Cargando…</p>}
      {grupos?.length === 0 && <p className="mt-2 text-sm text-[#64748B]">Todavía no tenés grupos: crealos en Mis nadadores.</p>}
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {grupos?.map((g) => (
          <li key={g.id}><span className="font-medium">{g.nombre}</span> <span className="text-[#64748B]">· {g.nadadores.length} {g.nadadores.length === 1 ? 'nadador' : 'nadadores'}</span></li>
        ))}
      </ul>
    </PerfilCuenta>
  )
}
