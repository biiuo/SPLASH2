# Safe Splash 2 — Estado, decisiones y tareas

Documento de trabajo del equipo. Resume **qué hace el sistema hoy**, **las decisiones tomadas**, los **requerimientos de la
página web y de las métricas**, y **lo que falta**. Se apoya en el Segundo Informe (RF/RNF).

Leyenda: ✅ hecho y probado · 🟡 hecho pero probado solo con datos simulados o sin ver en pantalla · ❌ pendiente.

---

## 1. Qué hace el modelo hasta ahora

El sistema sigue a los nadadores de los carriles 4, 5 y 6 y calcula cuándo cruzan cada marca de la piscina, a qué velocidad y cuándo descansan.

```
cámara / video → recorte a los carriles → detector (YOLOv5s) → zonas → ByteTrack (diou)
   → identidades estables por carril → posición a 3 por segundo → envío al backend
   backend: píxeles → metros (homografía) → motor de eventos → base de datos → web
```

| Paso | Qué hace | Dónde está | Estado |
|---|---|---|---|
| Captura | Lee la cámara (RTSP, por el relé MediaMTX), un video o una webcam. Guarda la hora real de cada frame y descarta los viejos si el modelo va más lento que la cámara | `ServidorIA/ProcesamientoServidor/src/pipeline_concurrente.py` | ✅ |
| Recorte | Le pasa al modelo solo el rectángulo que contiene los carriles, para ir más rápido | `ServidorIA/ProcesamientoServidor/src/roi.py` | ✅ |
| Detección | YOLOv5s ajustado, mAP@0.5 = 0.911. Detecta nadadores | `ServidorIA/ProcesamientoServidor/modelo/best.pt` | ✅ |
| Zonas | Ignora lo que está fuera de los polígonos de análisis (`lane4`, `lane5`, `lane6`) | `ServidorIA/ProcesamientoServidor/src/zones.py`, `define_zones.py` | ✅ |
| Seguimiento | ByteTrack con asociación `diou` (mira también la distancia entre centros) y descarte de cajas casi enteras dentro de otra. Bajó los IDs de 695 a 175 en la prueba | `ServidorIA/ProcesamientoServidor/src/tracker_util.py`, `conteo.py` | ✅ |
| Identidad | Un nadador por carril: si ByteTrack lo pierde y reaparece con otro ID, se le devuelve el mismo | `ServidorIA/ProcesamientoServidor/src/identidad.py` | ✅ |
| Trayectoria | Una posición por nadador, 3 veces por segundo. Si se pierde, **no desaparece**: se extrapola con su velocidad unos segundos y luego se mantiene la última posición, marcada como *estimada* | `ServidorIA/ProcesamientoServidor/src/trayectoria.py` | ✅ |
| Envío | Manda las posiciones en píxeles a la sesión activa del backend. Reintenta si el backend cae y no duplica | `ServidorIA/ProcesamientoServidor/src/enviador.py` | 🟡 |
| Metros | Convierte píxeles a metros con la calibración de la sesión (homografía calculada en el servidor) | `ServidorWEB/backend/` | 🟡 |
| Eventos | Cruce de marca (0, 5, 10, 15, 20, 25 m) con la hora interpolada, viraje, tramos con su velocidad, largos completos y cambios NADANDO ↔ DESCANSANDO | `ServidorWEB/backend/src/domain/services/motor-eventos.ts` | ✅ |
| Resultados | Eventos y tramos guardados en PostgreSQL y consultables por sesión | `ServidorWEB/backend/`, `/api/sesiones/{id}/resultados` | ✅ |
| Web | El entrenador inicia y finaliza la sesión y ve por carril la última marca, velocidad, tramos y estado | `ServidorWEB/frontend/components/sesion-panel.tsx` | 🟡 |

**Qué se probó y con qué.** El pipeline con un detector simulado, enviando a un backend y una base reales, midió un nadador simulado a 2 m/s como 1,98–2,01 m/s. El backend tiene 97 pruebas unitarias, 13 de base de datos y 28 de punta a punta. Los cálculos de identidad y de trayectoria tienen sus pruebas.

**Qué todavía no se ha visto funcionar:**
- El flujo completo **con el modelo real** (torch y boxmot) y una calibración hecha sobre una imagen real de la piscina.
- La interfaz en un navegador (compila y sus llamadas funcionan, pero nadie la ha mirado).
- Las imágenes de Docker (nunca se construyeron).
- La app de Android (no se ha compilado).

**Qué no hace todavía:** inicio de sesión con roles, heartbeat, reportes PDF/CSV, dashboards con datos reales, seguimiento en el celular, corrección de la distorsión del lente.

---

## 2. Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Dónde se procesa | Dos variantes que comparten la web: **A** celular y **B** servidor. El usuario nunca ve cuál se usa: un botón decide. Hoy siempre es el servidor | El celular da ~2,8 FPS con WebGPU a 640 px; hay que comparar con datos |
| Quién calcula qué | Quien mide (servidor de IA o celular) manda **solo posiciones en píxeles y la hora de captura**. Metros, cruces, velocidades y descansos los calcula el **backend**, una sola vez | Evita escribir y mantener el motor dos veces (Python y JavaScript); el celular solo necesita portar el seguimiento |
| Hora | Todo se mide con la **hora de captura del frame**, nunca la del procesamiento | La latencia no altera el dato |
| Homografía | La calcula siempre el servidor a partir de los puntos marcados; no se acepta una matriz calculada afuera | No confiar en datos del cliente |
| Marcas | Fijas en 0, 5, 10, 15, 20 y 25 m. Piscina de 25 × 12,5 m, 8 carriles de 1,5625 m; se analizan los carriles 4, 5 y 6 | Es lo que cubre la cámara |
| Cámara | Altura 2,8 m, distancia al borde 6,6 m (estimada entre 6,2 y 7,0; con cinta salió 5 m, sin resolver), lente 2,8–8 mm | Configurable en la web por el entrenador |
| Calibración | Se guardan todas; solo una está activa. Cada sesión **conserva la calibración con la que empezó** aunque después se active otra | Los resultados de una sesión no cambian a posteriori |
| Sesiones | Solo una activa a la vez (hay una cámara). Quien mide se une solo a la sesión activa; sin sesión descarta lo que mide | Una persona decide cuándo empieza |
| Identidad | Un nadador por carril; los carriles salen de las zonas nombradas `lane4`, `lane5`, `lane6` | Sin carril no hay a dónde asignar la posición |
| Posición perdida | Se estima y se marca; el backend la usa para no perder la identidad, pero marca como **inferido** (`observado: false`) lo que dependa de ella y **no la cuenta como quieto** | Un nadador que no se ve no está descansando |
| Cruces | La hora se interpola entre dos muestras; se confirma al alejarse 0,3 m de la marca (el temblor no genera cruces); la pared cuenta al llegar a 0,4 m | Estabilidad del tracker |
| Reenvíos | Los eventos tienen un id calculado a partir de sesión, nadador, tipo y hora: reenviar un lote no duplica nada | Celular con conexión inestable |
| Backend | NestJS con arquitectura limpia (dominio, aplicación, infraestructura, presentación), Prisma sobre PostgreSQL, Swagger en `/docs` | Mantenible y probable sin base real |
| Base de datos | Migraciones en SQL (índices parciales, restricciones y vista que Prisma no expresa) | Integridad en la base |
| Repositorio | `ServidorIA/ProcesamientoServidor/` (modelo), `ServidorWEB/backend/`, `ServidorWEB/frontend/`, `ServidorIA/ProcesamientoCelular/`, `app-android/`, `docs/`. Ramas: `feature/modelo` y `proyecto-completo` | Cada parte se puede probar y subir por separado |
| Docker | Un servicio por responsabilidad: db, migraciones, backend, frontend, mediamtx, ia, y según perfil stream-ws y camara-simulada | Mismo arranque en cualquier máquina |
| Seguridad | El inicio de sesión con roles **se hace después**. Hoy la API no autentica y los roles de la interfaz son decorativos | Primero validar el modelo |

**Valores iniciales sin respaldo con datos reales** (hay que calibrarlos con video): velocidad mínima de descanso 0,2 m/s, ventana de confirmación 3 s, histéresis 0,3 m, margen de pared 0,4 m, umbrales de error de calibración (10 y 25 cm).

---

## 3. Requerimientos de la página web

### 3.1 Usuarios y permisos

| Rol | Puede |
|---|---|
| **Nadador** | Ver su propio historial, métricas y evolución |
| **Entrenador** | Lo anterior para los nadadores a su cargo, iniciar y finalizar sesiones, ver tiempo real, generar reportes PDF/CSV, calibrar la cámara |
| **Administrador** | Gestionar usuarios y roles |

### 3.2 Funcionales

- [ ] **RF-07** Registro e inicio de sesión con tres roles. Contraseñas cifradas (bcrypt), sesión por JWT con el rol dentro.
- [ ] **RF-08** El nadador consulta su historial y su evolución.
- [ ] **RF-09** El entrenador sigue a sus nadadores y exporta reportes en **PDF y CSV**.
- [ ] **RF-10** El administrador gestiona usuarios y roles.
- [ ] **RF-11** Calibración de la cámara desde la web, sin tocar código:
  - [x] mostrar un frame de referencia,
  - [x] guiar los clics sobre los nodos (0, 5, 10, 15, 20 y 25 m, izquierda y derecha) con un evaluador que dice cuántos faltan,
  - [x] calcular la homografía y mostrar el error de ajuste y el de validación cruzada,
  - [ ] grilla de validación sobre la imagen (sin verificar en pantalla),
  - [x] guardarla como "calibración activa", ver el historial y volver a una anterior.
- [x] **Configuración** de piscina y cámara editable por el entrenador (con precisión esperada por marca).
- [x] **Zonas de análisis** (carriles, bloques de salida, borde) dibujadas en la web y exportables a `zones.json`.
- [x] **Zonas guardadas junto con la calibración** en el backend. Cada calibración es una *posición de la cámara*
  (con nombre) y guarda sus zonas; se elige cuál está activa en "Posiciones de la cámara". Al unirse a una sesión, el
  servidor de IA pide las zonas de la calibración de esa sesión. 🟡 Falta verlo en el navegador. Por ahora todos ven
  todas las posiciones: se guarda quién la creó (`creada_por`) para filtrar por usuario cuando haya inicio de sesión.
- [x] **Sesiones:** botones *Iniciar* y *Finalizar*. 🟡 Falta la selección de carril y nadador.
- [ ] **Disponibilidad de carriles** (4, 5 y 6): libre / en uso, según las sesiones activas.
- [ ] **Dashboard del nadador:** velocidad media, tiempo nadando, distancia total, mejor ritmo, gráfico, última sesión, calendario (hoy son datos de ejemplo).
- [ ] **Dashboard del entrenador:** nadadores activos, sesiones por semana, mejora promedio, progreso por nadador (hoy son datos de ejemplo). 🟡 El panel de sesión sí muestra datos reales.
- [ ] **Comparar sesiones** del mismo nadador a lo largo del tiempo.
- [ ] **Estado del sistema:** indicador real de "piscina conectada" (hoy es decorativo), basado en el heartbeat.

### 3.3 API (Swagger en `http://localhost:3001/docs`)

Implementada:

| Método y ruta | Qué hace |
|---|---|
| `GET /api/salud` | El servicio está vivo |
| `GET`, `PUT /api/configuracion` · `POST /api/configuracion/analisis` | Configuración de piscina y cámara; análisis sin guardar |
| `GET /api/calibracion/puntos-referencia` · `POST /api/calibracion/evaluar` | Puntos a marcar y evaluación en vivo |
| `GET`, `POST /api/calibracion` | Calibración activa; guardar una nueva |
| `GET /api/calibracion/historial` · `POST /api/calibracion/{id}/activar` | Elegir entre las guardadas |
| `PATCH /api/calibracion/{id}` · `GET /api/calibracion/{id}/zonas` | Nombre y zonas de una posición de la cámara; las zonas como `zones.json` |
| `POST /api/sesiones` · `GET /api/sesiones/activa` · `POST /api/sesiones/{id}/finalizar` | Ciclo de la sesión |
| `POST /api/sesiones/{id}/trayectorias` | Recibe posiciones en píxeles; **idempotente** |
| `GET /api/sesiones/{id}/resultados` | Eventos y tramos de la sesión |

Pendiente:
- [ ] `POST /heartbeat` — el servidor de IA y los celulares avisan que están activos (con él se decide dónde procesar).
- [ ] `POST /auth/login`, `POST /auth/registro`.
- [ ] Autenticación del cliente de IA con **token**, y CORS.
- [ ] Endpoints de métricas agregadas por nadador y por sesión.

### 3.4 Base de datos (PostgreSQL)

Tablas: `usuarios`, `nadadores`, `configuracion`, `calibraciones`, `sesiones`, `sesion_nadadores`, `eventos`, `tramos`, `latidos` y la vista `resumen_sesion`. Hoy se llenan `configuracion`, `calibraciones`, `sesiones`, `eventos` y `tramos`.

### 3.5 No funcionales

- [ ] **RNF-05 Seguridad:** acceso según rol, credenciales cifradas, secretos fuera del repositorio. (Secretos fuera del repositorio ✅.)
- [x] **RNF-06 Disponibilidad:** si el backend cae, el servidor de IA conserva las posiciones (hasta 20.000) y las reenvía. 🟡 El celular aún no existe.
- [ ] **RNF-07 Usabilidad:** entrenadores y nadadores usan la plataforma, y recalibran, sin conocimientos técnicos. Funciona en celular.
- [x] **RNF-08 Mantenibilidad:** servidor de IA y servidor web desacoplados por la API.
- [ ] Mantener las dependencias sin vulnerabilidades críticas (`npm audit`).

---

## 4. Requerimientos para calcular las métricas

### 4.1 Entradas necesarias

| Entrada | De dónde sale | Estado |
|---|---|---|
| Detecciones por frame | YOLOv5 | ✅ |
| Identidad estable por nadador | ByteTrack + gestor de identidades | ✅ (falta medir MOTA e IDF1) |
| Hora de captura de cada frame | Servidor de captura | ✅ |
| Posición en metros | Homografía en el backend | 🟡 con calibración sintética; falta una real |
| Frame sin distorsión | Calibración de lente (tablero de ajedrez) | ❌ |
| Zonas activas | `zones.json` | ✅ código; falta definirlas con la cámara real |
| Carril de cada nadador | Zona `lane*` donde cae | ✅ |

### 4.2 Eventos

- [x] **Cruce de nodo** en 0, 5, 10, 15, 20 y 25 m, con la hora interpolada.
- [x] **Viraje:** se registra en el punto más cercano a la pared.
- [x] **Largo completo:** al llegar a la pared opuesta a la de salida (se cuenta en el resumen del nadador).
- [x] **Cambio de estado** NADANDO ↔ DESCANSANDO.
- [x] Cada evento es **observado** o **inferido** (hueco de muestras o posición estimada).
- [ ] Qué hacer si el nadador cambia de carril o sale del área observable.

### 4.3 Métricas y fórmulas

| Métrica | Cálculo | Estado |
|---|---|---|
| Distancia recorrida | Múltiplos de 5 m según los nodos cruzados | ✅ |
| Velocidad por tramo | `v = distancia / Δt`, con Δt entre cruces consecutivos | ✅ |
| Velocidad media | Distancia total / tiempo total de los tramos (se muestra en el panel) | 🟡 por carril, no por sesión guardada |
| Conteo de largos | Largos completos | ✅ en el motor; falta exponerlo por la API |
| Tiempo de descanso | Suma de los intervalos DESCANSANDO | ✅ en el motor; falta exponerlo |
| Tiempo por vuelta | Entre el inicio y el fin de cada largo | ❌ |
| Tiempo total de sesión | Fin − inicio | ✅ |
| Ritmo | min/100 m | ❌ |

### 4.4 Mensaje de trayectoria (contrato con quien mide)

`POST /api/sesiones/{id}/trayectorias`:

```json
{
  "muestras": [
    { "carril": 5, "identidad": 1, "t": 1800000000000, "px": [812.4, 340.0] },
    { "carril": 5, "identidad": 1, "t": 1800000000333, "px": [830.1, 341.2], "estimada": true }
  ]
}
```

`t` es la hora de captura en milisegundos desde 1970. Máximo 5.000 muestras por envío. Cada nadador se manda en orden de tiempo.

### 4.5 Requisitos de calidad

- [ ] **RNF-01** Procesamiento cercano al tiempo real, evaluado por tramo de 5 m y no cuadro a cuadro.
- [ ] **RNF-02** Error absoluto medio **< 2 s por tramo** frente a cronometraje manual.
- [ ] **RNF-04** Hasta **3 nadadores simultáneos**, uno por carril.
- [ ] Tracker: medir **MOTA** e **IDF1** sobre video anotado a mano.
- [ ] Detector: calcular el **IoU promedio** (pendiente del informe, sección 13.1).

### 4.6 Riesgos que afectan las métricas

| Riesgo | Efecto | Mitigación |
|---|---|---|
| ~2,8 FPS en el celular (WebGPU, 640 px) | Más movimiento entre frames, el tracker pierde IDs | Recorte de zona (hecho en el servidor), fp16, app nativa, o variante en la nube |
| Fragmentación de identidades | Cruces atribuidos a nadadores distintos | `diou`, gestor de identidades por carril (hecho) |
| Banderines de espalda tapan al nadador | Detecciones perdidas | Posición estimada (hecho); bajar umbral en esa zona; sumar esos casos al dataset (`mine_missed_frames.py`) |
| El centro de la caja no coincide con el punto en el agua | Error en los metros | Revisar con la calibración real; usar el punto inferior de la caja si hace falta |
| Umbrales de descanso sin respaldo | Descansos falsos o perdidos | Calibrarlos con video real |
| La cámara se mueve entre sesiones | La homografía deja de valer | Recalibración rápida desde la web y chequeo al iniciar sesión |

---

## 5. Lista de tareas

> **Esta lista quedó vieja.** La lista actualizada de lo que falta está en [Pendientes.md](Pendientes.md).

### Ya hecho
- [x] Detector entrenado y validado
- [x] Seguimiento: ByteTrack con `diou`, cajas contenidas y gestor de identidades por carril
- [x] Procesamiento concurrente (captura e inferencia independientes) y recorte a los carriles
- [x] Trayectoria a 3 por segundo con posiciones estimadas
- [x] Streaming por WebSocket y relé RTSP con MediaMTX
- [x] Backend con configuración, calibración, historial, sesiones, trayectorias y resultados
- [x] Motor de eventos y máquina de estados NADANDO / DESCANSANDO
- [x] Base de datos con migraciones y pruebas
- [x] Web: configuración, calibración, zonas, historial y panel de sesión
- [x] Swagger para probar los endpoints
- [x] Docker Compose (sin construir aún las imágenes)
- [x] Repositorio ordenado, con ramas por feature

### Ahora (validar con datos reales)
- [ ] Correr el flujo completo con el **modelo real** y una sesión iniciada desde la web
- [ ] Calibrar sobre un fotograma real de la piscina y comprobar los metros
- [ ] Definir las zonas `lane4`, `lane5`, `lane6` con la cámara real
- [ ] Confirmar la distancia de la cámara al borde (5 m medidos contra ~6,6 m del ajuste)
- [ ] Construir las imágenes de Docker y comprobar que arrancan

### Medición
- [ ] Video de la piscina con **cronometraje manual** en paralelo
- [ ] Calibrar velocidad mínima de descanso y ventana de confirmación
- [ ] MOTA e IDF1 del tracker
- [ ] Calibración de lente

### Web y backend
- [ ] Inicio de sesión con roles y protección de los endpoints
- [ ] Heartbeat y el estado real de "piscina conectada"
- [ ] Disponibilidad de carriles, selección de carril y nadador
- [ ] Métricas por sesión y por nadador (largos, descanso, ritmo, tiempo por vuelta)
- [ ] Conectar los dashboards a datos reales
- [ ] Reportes PDF/CSV
- [x] Guardar las zonas en el backend, junto con su calibración
- [ ] Unir zonas y marcas en una sola pantalla
- [ ] Guardar el fotograma de referencia con la calibración (hoy hay que volver a subir la imagen para dibujar las zonas)
- [ ] Limpiar lockfiles duplicados (`pnpm-lock.yaml` vs `package-lock.json`)

### Variantes
- [ ] **A:** modelo en el celular — app nativa con TFLite y/o navegador con WebGPU; portar a JavaScript el seguimiento y las identidades; envío con buffer (Room + WorkManager)
- [ ] **B:** servidor de IA con el pipeline de Python (listo salvo la prueba con el modelo real)
- [ ] Decidir cómo llegar a ≥ 5 FPS en el celular sin bajar la resolución
- [ ] Comparar A y B (FPS, latencia, precisión, costo, batería) para la sección 9.4 del informe

### Cierre
- [ ] Pruebas de campo en la piscina (error contra cronómetro)
- [ ] Pruebas de robustez (oclusión, 3 nadadores, iluminación)
- [ ] Retroalimentación de entrenadores y nadadores
- [ ] Compilar y probar la app de Android
- [ ] Actualizar el informe y los diagramas con la arquitectura final
