'use client'

import { useEffect, useState } from 'react'

import { PerfilCuenta } from '@/components/perfil-cuenta'
import { api } from '@/lib/api'

type MiGrupo = { id: string; nombre: string; entrenador: string; entrenador_email?: string | null; entrenador_telefono?: string | null }

/** Mi perfil del nadador: la cuenta y sus grupos con el contacto de cada entrenador. */
export default function MiPerfil() {
  const [grupos, setGrupos] = useState<MiGrupo[] | null>(null)
  useEffect(() => {
    api.misGruposComoNadador().then(setGrupos).catch(() => setGrupos([]))
  }, [])
  const entrenadores = [...new Set((grupos ?? []).map((g) => g.entrenador))]
  return (
    <PerfilCuenta rol="Nadador">
          <h3 className="mt-6 text-sm font-semibold text-[#0F172A]">Mis grupos y entrenadores</h3>
          {grupos === null && <p className="mt-2 text-sm text-[#64748B]">Cargando…</p>}
          {grupos?.length === 0 && <p className="mt-2 text-sm text-[#64748B]">Todavía no estás en ningún grupo{entrenadores.length ? '' : ': tu entrenador te suma con tu correo'}.</p>}
          {!!grupos?.length && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-[#94A3B8]"><tr><th className="py-2 pr-4">Grupo</th><th className="py-2 pr-4">Entrenador</th><th className="py-2 pr-4">Correo</th><th className="py-2">Teléfono</th></tr></thead>
                <tbody>
                  {grupos.map((g) => (
                    <tr key={g.id} className="border-t border-[#F1F5F9]">
                      <td className="py-2 pr-4 font-medium">{g.nombre}</td>
                      <td className="py-2 pr-4">{g.entrenador}</td>
                      <td className="py-2 pr-4">{g.entrenador_email ? <a href={`mailto:${g.entrenador_email}`} className="text-[#2563EB] hover:underline">{g.entrenador_email}</a> : '—'}</td>
                      <td className="py-2">{g.entrenador_telefono ? <a href={`tel:${g.entrenador_telefono.replace(/\s/g, '')}`} className="text-[#2563EB] hover:underline">{g.entrenador_telefono}</a> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </PerfilCuenta>
  )
}
