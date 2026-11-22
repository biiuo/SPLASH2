// Carga backend/.env, si existe, para correr el backend fuera de Docker sin escribir las variables en la terminal.
// Lo que ya esté definido en el entorno (la terminal, Docker) gana: el archivo solo completa lo que falta.
// En Docker no hay .env dentro de la imagen (.dockerignore): las variables las pone docker-compose.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'

/** `ruta` por defecto: backend/.env (este archivo compilado vive en backend/dist). Devuelve qué variables cargó. */
export function cargarEnv(ruta = join(__dirname, '..', '.env')): string[] {
  if (!existsSync(ruta)) return []
  // sin el BOM que agregan el Bloc de notas y PowerShell 5 al guardar en UTF-8 (si no, la primera variable no se lee)
  const texto = readFileSync(ruta, 'utf8').replace(/^﻿/, '')
  const cargadas: string[] = []
  for (const [clave, valor] of Object.entries(parseEnv(texto))) {
    if (process.env[clave] === undefined) {
      process.env[clave] = valor
      cargadas.push(clave)
    }
  }
  return cargadas
}

// Al importar este archivo ya queda cargado: tiene que ser lo primero que importa main.ts.
cargarEnv()
