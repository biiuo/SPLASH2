import assert from 'node:assert/strict'
import test from 'node:test'

import { aplicar, metrosAImagen } from '../domain/calibracion/proyeccion.ts'
import { listarCalibraciones } from '../features/calibracion/model/listar-calibraciones.ts'
import { esCarril } from '../domain/zonas/carriles.ts'
import { resumenPorCarril } from '../domain/sesion/resumen-carriles.ts'

test('la proyección de identidad conserva las coordenadas', () => {
  const identidad = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  assert.deepEqual(aplicar(identidad, [12, 8]), [12, 8])
  assert.deepEqual(metrosAImagen(identidad, null, [12, 8]), [12, 8])
})

test('la proyección inválida no produce coordenadas', () => {
  assert.equal(aplicar([[1, 0, 0], [0, 1, 0], [0, 0, 0]], [12, 8]), null)
})

test('los nombres de carril se reconocen sin distinguir mayúsculas', () => {
  assert.equal(esCarril('LANE4'), true)
  assert.equal(esCarril('Carril5'), true)
  assert.equal(esCarril('blocks'), false)
})

test('el resumen calcula la velocidad con distancia y tiempo totales', () => {
  const tramos = [
    { carril: 4, t_inicio: '2026-01-01T00:00:00Z', t_fin: '2026-01-01T00:00:10Z', distancia_m: 20, velocidad_ms: 2, observado: true },
    { carril: 4, t_inicio: '2026-01-01T00:00:10Z', t_fin: '2026-01-01T00:00:30Z', distancia_m: 20, velocidad_ms: 1, observado: false },
  ]
  const [resumen] = resumenPorCarril({ eventos: [], tramos, largos: [], largo_m: 25 })
  assert.equal(resumen.velocidadMedia_ms, 40 / 30)
  assert.equal(resumen.inferidos, 1)
})

test('listar calibraciones usa el puerto sin necesitar red', async () => {
  const esperadas = [{ id: 'una' }]
  let llamadas = 0
  const resultado = await listarCalibraciones({
    listar: async () => {
      llamadas += 1
      return esperadas
    },
  })
  assert.equal(llamadas, 1)
  assert.equal(resultado, esperadas)
})

test('listar calibraciones conserva los errores del puerto', async () => {
  const error = new Error('sin conexión')
  await assert.rejects(listarCalibraciones({ listar: async () => { throw error } }), (recibido) => recibido === error)
})
