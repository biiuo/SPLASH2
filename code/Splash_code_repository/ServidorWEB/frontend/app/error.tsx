'use client'

import './error.css'

interface PropsError {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPagina({ reset }: PropsError) {
  return (
    <main className="error-pagina" role="alert">
      <h1 className="error-pagina__titulo">No se pudo mostrar esta página</h1>
      <p className="error-pagina__mensaje">Vuelve a intentarlo. Si el problema continúa, recarga la página.</p>
      <button className="error-pagina__boton" type="button" onClick={reset}>Volver a intentar</button>
    </main>
  )
}
