/// <reference types="node" />
// (este archivo está fuera de src/: sin la línea de arriba el editor no sabe que corre en Node)
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { defineConfig } from 'prisma/config'

// La dirección de la base viene de la variable de entorno DATABASE_URL, o de backend/.env si existe (lo que ya esté
// definido en la terminal gana). `prisma generate` no necesita conectarse; `prisma migrate deploy` sí.
// (Misma lógica que src/cargar-env.ts; acá se repite porque Prisma lee este archivo por su cuenta.)
if (existsSync('.env')) {
  const texto = readFileSync('.env', 'utf8').replace(/^﻿/, '')
  for (const [clave, valor] of Object.entries(parseEnv(texto))) process.env[clave] ??= valor
}
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://invalida:invalida@localhost:5432/invalida',
  },
})
