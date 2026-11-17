'use client'

import { Camera, Crosshair, FolderClock, Shapes } from 'lucide-react'
import Link from 'next/link'

import { Encabezado } from '@/components/nadador/shell'
import { Tarjeta } from '@/components/nadador/ui'

const SECCIONES = [
  { href: '/configuracion', titulo: 'Piscina y cámara', texto: 'Medidas de la piscina, carriles y marcas; altura, distancia y lente de la cámara; dónde se procesa el video.', icono: Camera },
  { href: '/calibracion', titulo: 'Calibrar la homografía', texto: 'Marcar los puntos de la piscina sobre la imagen para pasar de píxeles a metros.', icono: Crosshair },
  { href: '/zonas', titulo: 'Zonas de análisis', texto: 'Dibujar los carriles que mira la IA y las zonas a ignorar.', icono: Shapes },
  { href: '/calibracion/historial', titulo: 'Calibraciones guardadas', texto: 'Cada posición de la cámara: activar, dejar de usar o eliminar.', icono: FolderClock },
]

/** Configuración del sistema: solo el administrador. */
export default function ConfiguracionAdmin() {
  return (
    <>
      <Encabezado titulo="Configuración" bajada="Antes de la primera sesión, o si se mueve la cámara o el zoom. Solo el administrador puede cambiarla." />
      <div className="grid gap-4 md:grid-cols-2">
        {SECCIONES.map(({ href, titulo, texto, icono: Icono }) => (
          <Link key={href} href={href} className="group rounded-2xl border border-[#E2E8F0] bg-white p-5 transition hover:border-[#2563EB] hover:bg-[#EFF6FF]">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB] group-hover:bg-white"><Icono className="size-4" /></span>
            <p className="mt-4 font-semibold text-[#0F172A]">{titulo}</p>
            <p className="mt-1 text-sm text-[#64748B]">{texto}</p>
          </Link>
        ))}
      </div>

      <Tarjeta className="mt-6" titulo="Parámetros de detección y monitoreo" subtitulo="Se definen en el archivo .env del servidor y se aplican al reiniciar el servidor de IA.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[#94A3B8]"><tr><th className="py-2 pr-4">Variable</th><th className="py-2 pr-4">Por defecto</th><th className="py-2">Qué controla</th></tr></thead>
            <tbody>
              {[
                ['CONF', '0,10', 'Confianza mínima del detector'],
                ['TRACK_THRESH', '0,30', 'Confianza para que ByteTrack abra un seguimiento'],
                ['MATCH_THRESH', '0,9', 'Qué tan distinta puede ser una caja de su predicción'],
                ['TRACK_BUFFER_S', '4', 'Segundos que se recuerda a un nadador perdido'],
                ['FPS_PROCESO', '10', 'Frames por segundo que se esperan procesar'],
                ['HZ_ENVIO', '3', 'Posiciones por segundo y por nadador enviadas al backend'],
                ['FRAME_CADA_S', '3', 'Cada cuánto se sube el frame para calibrar'],
              ].map(([v, d, q]) => (
                <tr key={v} className="border-t border-[#F1F5F9]"><td className="py-2 pr-4 font-mono text-xs">{v}</td><td className="py-2 pr-4">{d}</td><td className="py-2 text-[#64748B]">{q}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[#94A3B8]">Las unidades son siempre metros, segundos y m/s.</p>
      </Tarjeta>
    </>
  )
}
