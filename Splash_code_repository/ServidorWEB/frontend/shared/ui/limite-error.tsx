'use client'

import { Component, type ReactNode } from 'react'
import './limite-error.css'

interface PropsLimiteError {
  children: ReactNode
}

interface EstadoLimiteError {
  fallo: boolean
}

/** Contiene los errores de renderizado sin ocultar el resto de la página. */
export class LimiteError extends Component<PropsLimiteError, EstadoLimiteError> {
  state: EstadoLimiteError = { fallo: false }

  static getDerivedStateFromError(): EstadoLimiteError {
    return { fallo: true }
  }

  render() {
    if (this.state.fallo) {
      return (
        <div role="alert" className="limite-error">
          <p>No se pudo mostrar el editor. Recarga la página para volver a intentarlo.</p>
          <button type="button" onClick={() => window.location.reload()} className="limite-error__boton">
            Recargar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
