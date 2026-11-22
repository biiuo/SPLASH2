'use client'

import { AlertTriangle, Camera, Cpu, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { Encabezado } from '@/components/nadador/shell'
import { Aviso, Tarjeta } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import { formatearMetros, formatearVel, horaCorta } from '@/lib/largos'
import { formatearDuracion } from '@/lib/resultados'
import type { EstadoComponente, ResumenSesion } from '@/lib/tipos'

/** Monitoreo de mis sesiones en curso, cada 5 s: quién nada, distancia, velocidad, largos y errores de detección. */
export default function MonitoreoEntrenador() {
  const [activas, setActivas] = useState<ResumenSesion[] | null>(null)
  const [ia, setIa] = useState<EstadoComponente | null | undefined>(undefined)
  const [problema, setProblema] = useState<string | null>(null)
  const [hora, setHora] = useState(0)

  const cargar = useCallback(() => {
    return Promise.all([api.sesionesRecientes(30), api.estadoComponentes().catch(() => [])])
      .then(([lista, comp]) => {
        setActivas(lista.filter((s) => s.estado === 'activa'))
        setIa(comp.find((c) => c.componente === 'ia') ?? null)
        setProblema(null)
        setHora(Date.now())
      })
      .catch((e: unknown) => {
        setProblema(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el servidor.')
      })
  }, [])
  useEffect(() => {
    void cargar()
    const t = setInterval(() => void cargar(), 5000)
    return () => clearInterval(t)
  }, [cargar])

  const alertas: string[] = []
  if (activas?.length) {
    if (ia === null) alertas.push('El servidor de IA no avisó que está vivo: avisale al administrador.')
    else if (ia && !ia.vivo) alertas.push(`El servidor de IA no responde desde hace ${ia.hace_s} s: avisale al administrador.`)
    else if (ia && !ia.estado.camara_conectada) alertas.push('La cámara no está transmitiendo.')
    for (const s of activas) {
      if (hora - Date.parse(s.inicio) > 2 * 60000 && s.tramos === 0) alertas.push(`La sesión de las ${horaCorta(s.inicio)} lleva más de 2 minutos sin datos.`)
      for (const c of s.por_carril) if (c.tramos >= 4 && c.tramos_estimados / c.tramos > 0.5) alertas.push(`Carril ${c.carril} (${c.nadador ?? 'sin nadador'}): más de la mitad de los tramos son estimados; la cámara lo pierde seguido.`)
    }
  }

  return (
    <>
      <Encabezado
        titulo="Monitoreo"
        bajada="Tus sesiones en curso. Se actualiza solo cada 5 segundos."
        accion={hora ? <span className="inline-flex items-center gap-1 text-xs text-[#94A3B8]"><RefreshCw className="size-3.5" /> {new Date(hora).toLocaleTimeString('es-CO')}</span> : undefined}
      />
      {problema && <div className="mb-4"><Aviso tipo="error">{problema}</Aviso></div>}
      {alertas.length > 0 && (
        <div role="alert" className="mb-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4">
          <p className="flex items-center gap-2 font-semibold text-[#991B1B]"><AlertTriangle className="size-4" /> Posibles problemas</p>
          <ul className="mt-2 list-disc pl-6 text-sm text-[#991B1B]">{alertas.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
      {ia && (
        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          <Chip ok={ia.vivo} icono={Cpu} texto={ia.vivo ? `Análisis en línea · ${ia.estado.fps ?? 0} fps` : 'Análisis sin respuesta'} />
          <Chip ok={ia.vivo && !!ia.estado.camara_conectada} icono={Camera} texto={ia.vivo && ia.estado.camara_conectada ? 'Cámara transmitiendo' : 'Cámara sin video'} />
        </div>
      )}
      {activas?.length === 0 && <Aviso>No tenés sesiones en curso. Iniciá una desde el Dashboard.</Aviso>}
      <div className="flex flex-col gap-4">
        {activas?.map((s) => (
          <Tarjeta key={s.id} titulo={`${s.grupo ?? 'Sesión libre'} · desde las ${horaCorta(s.inicio)}`} subtitulo={`En curso hace ${formatearDuracion(hora - Date.parse(s.inicio))}`} accion={<Link href={`/entrenador/historial/${s.id}`} className="text-sm font-semibold text-[#2563EB] hover:underline">Ver detalle</Link>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm tabular-nums">
                <thead className="text-xs uppercase tracking-wider text-[#94A3B8]"><tr><th className="py-2 pr-4">Carril</th><th className="py-2 pr-4">Nadador</th><th className="py-2 pr-4 text-right">Distancia</th><th className="py-2 pr-4 text-right">Velocidad</th><th className="py-2 pr-4 text-right">Largos</th><th className="py-2 pr-4 text-right">Detectados / estimados</th></tr></thead>
                <tbody>
                  {s.por_carril.map((c) => (
                    <tr key={c.carril} className="border-t border-[#F1F5F9]">
                      <td className="py-2.5 pr-4">{c.carril}</td>
                      <td className="py-2.5 pr-4">{c.nadador ?? 'reservado'}</td>
                      <td className="py-2.5 pr-4 text-right">{formatearMetros(c.distancia_m)}</td>
                      <td className="py-2.5 pr-4 text-right">{formatearVel(c.velocidad_media_ms)}</td>
                      <td className="py-2.5 pr-4 text-right">{c.largos}</td>
                      <td className="py-2.5 pr-4 text-right">{c.tramos - c.tramos_estimados} / <span className={c.tramos_estimados ? 'text-[#C2410C]' : ''}>{c.tramos_estimados}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        ))}
      </div>
    </>
  )
}

function Chip({ ok, icono: Icono, texto }: { ok: boolean; icono: typeof Cpu; texto: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ok ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}><Icono className="size-3.5" /> {texto}</span>
}
