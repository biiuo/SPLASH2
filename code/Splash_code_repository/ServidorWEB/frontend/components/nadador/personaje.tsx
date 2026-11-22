// Los personajes que acompañan el cuestionario: nadador o nadadora, con traje de baño azul y gorro azul con "UN"
// (ilustraciones en public/images/personajes, fondo transparente).
// Sin sexo indicado (o "prefiero no indicarlo") se muestra una figura neutra en el agua, sin sexo asociado.
import type { Sexo } from '@/lib/tipos'

const IMAGEN: Record<'masculino' | 'femenino', { src: string; alt: string; ancho: number; alto: number }> = {
  masculino: { src: '/images/personajes/nadador.webp', alt: 'Nadador con gorro y bañador azul de la UN', ancho: 329, alto: 923 },
  femenino: { src: '/images/personajes/nadadora.webp', alt: 'Nadadora con gorro y traje de baño azul de la UN', ancho: 289, alto: 921 },
}

/** `animar`: flota suavemente (en la ficha del perfil va quieto). `className` fija el alto (h-48, h-72…). */
export function Personaje({ sexo, animar = true, className = '' }: { sexo?: Sexo; animar?: boolean; className?: string }) {
  if (sexo !== 'masculino' && sexo !== 'femenino') return <PersonajeNeutro animar={animar} className={className} />
  const img = IMAGEN[sexo]
  // la flotación va en el contenedor: la imagen usa su propia animación de entrada (al cambiar de sexo)
  return (
    <span className={`inline-flex justify-center ${animar ? 'personaje-flotar' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- la web usa imágenes sin optimizar (next.config: unoptimized) */}
      <img
        key={sexo}
        src={img.src}
        alt={img.alt}
        width={img.ancho}
        height={img.alto}
        draggable={false}
        className={`select-none object-contain animate-in fade-in zoom-in-95 duration-300 ${className}`}
      />
    </span>
  )
}

const PIEL = '#F5CBA7'
const PIEL_SOMBRA = '#E9B48C'
const AZUL = '#1677B8'
const AZUL_OSCURO = '#123B5D'
const TURQUESA = '#36C5C9'

/** Sin sexo asociado: la cabeza con el gorro UN asomando del agua. */
function PersonajeNeutro({ animar, className = '' }: { animar: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 200 280" className={className} role="img" aria-label="Deportista con gorro UN en el agua">
      <defs>
        <clipPath id="agua-neutro"><rect x="16" y="150" width="168" height="104" rx="34" /></clipPath>
      </defs>
      <g className={animar ? 'personaje-flotar' : undefined}>
        <g transform="translate(0 70)">
          <circle cx="68" cy="72" r="6" fill={PIEL_SOMBRA} />
          <circle cx="132" cy="72" r="6" fill={PIEL_SOMBRA} />
          <circle cx="100" cy="68" r="32" fill={PIEL} />
          {/* gorro azul con "UN" y gafas en la frente */}
          <path d="M67 68 C67 26, 133 26, 133 68 Q100 59 67 68 Z" fill={AZUL} />
          <path d="M72 46 Q100 36 128 46" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="3" fill="none" />
          <text x="100" y="53" textAnchor="middle" fontSize="17" fontWeight="800" fill="#ffffff" fontFamily="ui-sans-serif, system-ui, sans-serif">UN</text>
          <rect x="72" y="61" width="56" height="4" rx="2" fill={AZUL_OSCURO} />
          <rect x="78" y="57" width="19" height="11" rx="5.5" fill={TURQUESA} stroke={AZUL_OSCURO} strokeWidth="2" />
          <rect x="103" y="57" width="19" height="11" rx="5.5" fill={TURQUESA} stroke={AZUL_OSCURO} strokeWidth="2" />
          <circle cx="89" cy="78" r="3.3" fill={AZUL_OSCURO} />
          <circle cx="111" cy="78" r="3.3" fill={AZUL_OSCURO} />
          <path d="M90 89 Q100 98 110 89" stroke={AZUL_OSCURO} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      </g>
      <g clipPath="url(#agua-neutro)">
        <g className={animar ? 'personaje-olas' : undefined}>
          <path d="M-20 176 q20 -10 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V280 H-20 Z" fill={AZUL} opacity="0.85" />
          <path d="M-20 190 q20 -10 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V280 H-20 Z" fill={TURQUESA} opacity="0.45" />
        </g>
      </g>
    </svg>
  )
}
