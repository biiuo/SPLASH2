import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import type { Response } from 'express'

import {
  ConflictoException,
  NoAutenticadoException,
  NoEncontradoException,
  ProhibidoException,
  ValidacionException,
} from '../../application/exceptions/aplicacion.exceptions'

// Errores de red al hablar con la base (de Node, de PostgreSQL y de Prisma: P1001 = no se alcanza el servidor).
const SIN_CONEXION = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', '57P01', '08001', '08006', 'P1001', 'P1002', 'P1017', 'P2024'])

// Algunos cortes de conexión llegan sin código, solo con un mensaje (por ejemplo, cuando el servidor se cae con una conexión abierta).
const MENSAJE_SIN_CONEXION = /connection terminated|connection refused|econnrefused|can't reach database server|timeout exceeded when trying to connect/i

function esErrorDeConexion(error: unknown): boolean {
  const codigo = (error as { code?: string } | null)?.code
  if (codigo && SIN_CONEXION.has(codigo)) return true
  return error instanceof Error && MENSAJE_SIN_CONEXION.test(error.message)
}

/** Traduce cualquier error a la respuesta HTTP que se le devuelve a quien llamó a la API. */
@Catch()
export class ExcepcionesFilter implements ExceptionFilter {
  private readonly log = new Logger('API')

  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()

    if (error instanceof ValidacionException) return res.status(400).json({ error: error.message, errores: error.detalles })
    if (error instanceof NoEncontradoException) return res.status(404).json({ error: error.message })
    if (error instanceof ConflictoException) return res.status(409).json({ error: error.message })
    if (error instanceof NoAutenticadoException) return res.status(401).json({ error: error.message })
    if (error instanceof ProhibidoException) return res.status(403).json({ error: error.message })
    if (error instanceof HttpException) return res.status(error.getStatus()).json(error.getResponse())

    if (esErrorDeConexion(error)) return res.status(503).json({ error: 'base_de_datos_no_disponible' })
    const codigo = (error as { code?: string } | null)?.code
    if (codigo === 'P2002') return res.status(409).json({ error: 'ya_existe' })
    if (codigo === 'P2003' || codigo === 'P2025') return res.status(404).json({ error: 'no_encontrado' })

    // el detalle queda en el registro del servidor, no en la respuesta
    this.log.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
    return res.status(500).json({ error: 'error_interno' })
  }
}
