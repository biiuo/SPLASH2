import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SafeSplash · Entrena mejor. Nada seguro.',
  description: 'Seguimiento inteligente de velocidad, tiempos y progreso para nadadores.',
  icons: {
    icon: '/icono-uninorte.png',
    apple: '/icono-uninorte.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#2563eb',
  userScalable: false,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  )
}
