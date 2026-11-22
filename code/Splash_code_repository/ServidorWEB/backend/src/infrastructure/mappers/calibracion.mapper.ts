import type { ArchivoCalibracion, CalibracionGuardada, Llegada, Zona } from '../../domain/entities/calibracion.entity'
import type { CalibracionResumen, ExtrasCalibracion } from '../../domain/repositories/calibracion.repository'
import type { Distorsion } from '../../domain/services/homografia'
import type { Prisma, Calibracion as FilaCalibracion } from '../persistence/generated/prisma/client'

const json = (v: unknown) => v as Prisma.InputJsonValue

/** La fila sin la imagen: la imagen se lee aparte, solo cuando se pide. */
export type FilaSinImagen = Omit<FilaCalibracion, 'imagen'>

/**
 * La columna "zonas" guarda la lista de zonas. NULL (calibraciones viejas) o una lista vacía (zonas borradas) se leen
 * como "sin zonas": así no hace falta el valor especial DbNull de Prisma para vaciarla.
 */
function zonasDe(valor: Prisma.JsonValue | null): Zona[] | null {
  return Array.isArray(valor) && valor.length > 0 ? (valor as unknown as Zona[]) : null
}

function distorsionDe(valor: Prisma.JsonValue | null): Distorsion | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const v = valor as { k1?: unknown; centro?: unknown; escala?: unknown }
  const ok =
    typeof v.k1 === 'number' &&
    typeof v.escala === 'number' &&
    Array.isArray(v.centro) &&
    v.centro.length === 2 &&
    v.centro.every((n) => typeof n === 'number')
  return ok ? (v as unknown as Distorsion) : null
}

function llegadaDe(valor: Prisma.JsonValue | null): Llegada | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const v = valor as { inicio_m?: unknown; fin_m?: unknown }
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
  const l = { inicio_m: num(v.inicio_m), fin_m: num(v.fin_m) }
  return l.inicio_m === null && l.fin_m === null ? null : l
}

/** Traduce entre la entidad del dominio y la fila de la base de datos. */
export class CalibracionMapper {
  static toDomain(fila: FilaSinImagen): CalibracionGuardada {
    return {
      id: fila.id,
      nombre: fila.nombre,
      image_size: [fila.image_width, fila.image_height],
      puntos: fila.puntos as unknown as ArchivoCalibracion['puntos'],
      cuerdas: Array.isArray(fila.cuerdas) ? (fila.cuerdas as unknown as ArchivoCalibracion['cuerdas']) : [],
      H: fila.homografia as unknown as ArchivoCalibracion['H'],
      distorsion: distorsionDe(fila.distorsion),
      geometria: fila.geometria as unknown as ArchivoCalibracion['geometria'],
      zonas: zonasDe(fila.zonas),
      llegada: llegadaDe(fila.llegada),
      rmse_m: fila.rmse_m === null ? null : fila.rmse_m.toNumber(),
      cruzado_m: fila.cruzado_m === null ? null : fila.cruzado_m.toNumber(),
      completa: fila.completa,
      omitidos: [],
      creada: fila.creado_en.toISOString(),
    }
  }

  static toResumen(fila: FilaSinImagen, tieneImagen = false): CalibracionResumen {
    return {
      id: fila.id,
      nombre: fila.nombre,
      image_size: [fila.image_width, fila.image_height],
      creada: fila.creado_en.toISOString(),
      completa: fila.completa,
      rmse_m: fila.rmse_m === null ? null : fila.rmse_m.toNumber(),
      cruzado_m: fila.cruzado_m === null ? null : fila.cruzado_m.toNumber(),
      n_puntos: Array.isArray(fila.puntos) ? fila.puntos.length : 0,
      zonas: zonasDe(fila.zonas)?.map((z) => z.name) ?? [],
      activa: fila.activa,
      tiene_imagen: tieneImagen,
    }
  }

  static toPrismaCreate(c: ArchivoCalibracion, usuarioId: string | null, extras: ExtrasCalibracion = {}): Prisma.CalibracionUncheckedCreateInput {
    return {
      creada_por: usuarioId,
      nombre: extras.nombre ?? null,
      image_width: c.image_size[0],
      image_height: c.image_size[1],
      puntos: json(c.puntos),
      cuerdas: json(c.cuerdas),
      homografia: json(c.H),
      ...(c.distorsion ? { distorsion: json(c.distorsion) } : {}),
      geometria: json(c.geometria),
      zonas: json(extras.zonas ?? []),
      ...(extras.llegada ? { llegada: json(extras.llegada) } : {}),
      ...(extras.imagen ? { imagen: extras.imagen as Uint8Array<ArrayBuffer> } : {}),
      rmse_m: c.rmse_m,
      cruzado_m: c.cruzado_m,
      completa: c.completa,
      activa: true,
    }
  }

  /** Solo lo que vino: undefined no toca la columna; null la vacía. */
  static toPrismaUpdate(cambios: ExtrasCalibracion): Prisma.CalibracionUncheckedUpdateInput {
    const datos: Prisma.CalibracionUncheckedUpdateInput = {}
    if (cambios.nombre !== undefined) datos.nombre = cambios.nombre
    if (cambios.zonas !== undefined) datos.zonas = json(cambios.zonas ?? [])
    // "sin línea corrida" se guarda como un objeto con los dos lados en null (así no hace falta DbNull)
    if (cambios.llegada !== undefined) datos.llegada = json(cambios.llegada ?? { inicio_m: null, fin_m: null })
    if (cambios.imagen !== undefined) datos.imagen = cambios.imagen as Uint8Array<ArrayBuffer> | null
    return datos
  }
}
