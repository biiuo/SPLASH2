'use client'

import { ArrowRight, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { PerfilCuenta } from '@/features/cuenta'
import { FichaPerfil } from '@/components/nadador/perfil-deportivo'
import { BOTON, Tarjeta } from '@/components/nadador/ui'
import { api } from '@/lib/api'
import type { VistaPerfil } from '@/lib/tipos'

type MiGrupo = { id: string; nombre: string; entrenador: string; entrenador_email?: string | null; entrenador_telefono?: string | null }

/** Mi perfil del nadador: la cuenta, sus grupos y su único perfil deportivo actual. */
export default function MiPerfil() {
  const [grupos, setGrupos] = useState<MiGrupo[] | null>(null)
  const [perfil, setPerfil] = useState<VistaPerfil | null>(null)
  const [errorPerfil, setErrorPerfil] = useState(false)
  useEffect(() => {
    api.misGruposComoNadador().then(setGrupos).catch(() => setGrupos([]))
    api.miPerfilDeportivo().then(setPerfil).catch(() => setErrorPerfil(true))
  }, [])
  const entrenadores = [...new Set((grupos ?? []).map((g) => g.entrenador))]
  const completo = perfil?.estado === 'completo'

  return (
    <>
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

      <Tarjeta
        className="mt-6"
        titulo="Mi perfil deportivo"
        subtitulo={completo ? 'Tu perfil deportivo. Puedes actualizar una parte sin repetir todo el cuestionario.' : 'Completa el cuestionario para armar tu perfil deportivo.'}
        accion={
          perfil &&
          (completo ? (
            <Link href="/nadador/bienvenida?editar=1" className={BOTON.secundario}><Pencil className="size-4" /> Editar mi perfil</Link>
          ) : (
            <Link href="/nadador/bienvenida" className={BOTON.primario}>{perfil.estado === 'nuevo' ? 'Empezar' : 'Continuar'} <ArrowRight className="size-4" /></Link>
          ))
        }
      >
        {!perfil && !errorPerfil && <p className="text-sm text-[#64748B]">Cargando…</p>}
        {errorPerfil && <p className="text-sm text-[#DC2626]">No se pudo cargar tu perfil deportivo.</p>}
        {perfil && <FichaPerfil vista={perfil} />}
      </Tarjeta>

    </>
  )
}
