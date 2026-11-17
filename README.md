# SafeSplash

Sistema de visión por computador que sigue a los nadadores en la piscina y calcula sus tiempos, velocidades y largos por
carril, sin cronómetro. Universidad del Norte.

Esta guía explica cómo **levantar todo con Docker**. El código está en [`Splash_code_repository/`](Splash_code_repository/)
y la documentación en [`Splash_code_repository/docs/`](Splash_code_repository/docs/).

**Qué está hecho y qué falta:** [docs/Pendientes.md](Splash_code_repository/docs/Pendientes.md).

```
proyecto_final/
├── README.md                      ← esta guía
└── Splash_code_repository/
    ├── docker-compose.yml         ← entorno principal, usa base externa
    ├── docker-compose.dev.yml     ← desarrollo, incluye base local
    ├── .env.example               ← plantilla de variables (copiar como .env)
    ├── ServidorWEB/               web (Next.js) + API (NestJS) + base de datos
    ├── ServidorIA/                procesamiento en el servidor y en el celular
    ├── videos/                    video de prueba para el modo demo
    └── docs/                      documentación
```

---

## 1. Lo que hace falta

| | |
|---|---|
| **Docker Desktop** | <https://www.docker.com/products/docker-desktop/>. En Windows usa **WSL 2**: si `wsl --version` da error, ver [Problemas comunes](#6-problemas-comunes) |
| **Espacio en disco** | ~6 GB (la imagen del servidor de IA trae PyTorch) |
| **Internet** | La primera vez, para bajar las imágenes y las librerías. La conexión lenta solo hace que tarde más |

Comprobar que Docker funciona:

```powershell
docker version
docker compose version
```

---

## 2. Preparar (una sola vez)

Todos los comandos se corren **dentro de `Splash_code_repository`**:

```powershell
cd Splash_code_repository
copy .env.example .env
```

Abrir `.env` y completar, como mínimo:

| Variable | Qué poner |
|---|---|
| `POSTGRES_PASSWORD` | Una contraseña larga para la base local de desarrollo |
| `DATABASE_URL` | Conexión a PostgreSQL externa; obligatoria para `docker-compose.yml` |
| `JWT_SECRET` | Una clave de **al menos 32 caracteres** (firma las sesiones de la web) |
| `IA_TOKEN` | Otra clave distinta (con ella el backend reconoce al servidor de IA) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | El primer administrador: se crea solo al arrancar si no hay ninguno |

Para generar claves al azar:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

El Compose principal (`docker-compose.yml`) usa una base PostgreSQL externa y requiere `DATABASE_URL`. Para Supabase,
usa la dirección **Session pooler** (Connect → Direct), terminada en `?sslmode=require&uselibpqcompat=true`. Detalle en
[docs/BaseDeDatos.md](Splash_code_repository/docs/BaseDeDatos.md).

> El `.env` **no se sube a git** (tiene contraseñas). Lo que sí se sube es `.env.example`, sin secretos.

---

## 3. Levantar

### En modo desarrollo

Para que los cambios se ejecuten automáticamente:

```powershell
docker compose -f docker-compose.dev.yml up --watch
```

Para probar solo la web y la API en desarrollo, sin iniciar los servicios de IA/cámara:

```powershell
docker compose -f docker-compose.dev.yml up --build frontend backend
```

### Entorno principal (base de datos externa)

```powershell
docker compose -f docker-compose.yml up -d --build
```

### Con un video de prueba (sin cámara)

Poner un video de la piscina en `videos/demo.mp4` (los videos no se suben a git: hay que copiarlo a mano). Después:

```powershell
docker compose -f docker-compose.yml --profile demo up -d --build
```

El perfil `demo` agrega un servicio que **transmite ese video en bucle como si fuera la cámara**.

### Con la cámara real (RTSP)

En `.env`:

```
CAMERA_RTSP_URL=rtsp://usuario:contraseña@IP-DE-LA-CAMARA/axis-media/media.amp
```

Y levantar **sin** el perfil demo:

```powershell
docker compose -f docker-compose.yml up -d --build
```

### Procesamiento en el celular (opcional)

Agrega el servicio que le pasa el video al celular por WebSocket (puerto 8765):

```powershell
docker compose -f docker-compose.yml --profile demo --profile phone up -d --build
```

Hace falta el modelo en `ServidorWEB/frontend/public/modelo/best_640.onnx` **antes** de construir. Cómo generarlo:
[ServidorIA/ProcesamientoCelular/README.md](Splash_code_repository/ServidorIA/ProcesamientoCelular/README.md).

> **La primera vez tarda** (10 a 30 minutos según la conexión): baja las imágenes y PyTorch. Las siguientes, segundos.

---

## 4. Comprobar y usar

```powershell
docker compose -f docker-compose.yml ps -a
```

| Servicio | Tiene que decir |
|---|---|
| `backend` | `running (healthy)` |
| `migraciones` | `exited (0)`: creó o actualizó las tablas y terminó |
| `frontend`, `ia`, `mediamtx` | `running` |
| `camara-simulada` | `running` (solo con `--profile demo`) |

El Compose principal no inicia PostgreSQL local; `db` corresponde al entorno de desarrollo.

| Qué | Dónde |
|---|---|
| **La web** | <http://localhost:3000> (desde otro dispositivo de la red: `http://IP-DE-LA-PC:3000`) |
| Documentación de la API (Swagger) | <http://localhost:3001/docs> (solo desde esta PC) |

### Primer uso

1. Entrar a la web con `ADMIN_EMAIL` / `ADMIN_PASSWORD` del `.env`.
2. **Piscina y cámara**: revisar las medidas y elegir dónde se procesa (servidor o celular).
3. **Calibrar la homografía**: subir una imagen o el video, marcar los puntos y las corcheras, y **guardar** (se guarda
   también la imagen).
4. **Zonas de análisis**: dibujar los carriles `lane4`, `lane5`, `lane6` y **guardar**.
5. **Mi grupo** (entrenador): agregar a los nadadores por el correo de su cuenta.
6. **Iniciar sesión**: elegir los carriles y quién va en cada uno. El servidor de IA empieza a medir solo.

Cada nadador entra con su cuenta y ve **solo su carril**. Puede sumarse a la sesión de su entrenador o empezar una sesión
libre en un carril que esté libre.

---

## 5. Comandos

Todos dentro de `Splash_code_repository`.

### Día a día

| Comando | Qué hace |
|---|---|
| `docker compose -f docker-compose.yml --profile demo up -d` | Arranca el entorno principal con video de prueba |
| `docker compose -f docker-compose.yml ps -a` | Estado de cada servicio del entorno principal |
| `docker compose -f docker-compose.yml logs -f ia` | Mensajes de IA en vivo (Ctrl+C para salir) |
| `docker compose -f docker-compose.yml logs --tail 30 backend` | Las últimas 30 líneas |
| `docker compose -f docker-compose.yml restart ia` | Reinicia un servicio |
| `docker compose -f docker-compose.yml stop` | Apaga el entorno principal **sin borrar datos** |
| `docker compose -f docker-compose.yml down` | Quita los contenedores principales **sin borrar datos** |
| `docker compose -f docker-compose.dev.yml up --watch` | Inicia el entorno de desarrollo y observa cambios |
| `docker compose -f docker-compose.dev.yml ps -a` | Estado de los servicios de desarrollo |
| `docker compose -f docker-compose.dev.yml logs -f backend` | Logs del backend en desarrollo |
| `docker compose -f docker-compose.dev.yml down` | Apaga el entorno de desarrollo **sin borrar datos** |

### Después de cambiar algo

| Cambiaste… | Comando |
|---|---|
| Código de la **web** (principal) | `docker compose -f docker-compose.yml up -d --build frontend` |
| Código del **backend** (principal) | `docker compose -f docker-compose.yml up -d --build backend` |
| Una **migración** de la base (principal) | `docker compose -f docker-compose.yml up -d --build migraciones backend` |
| Código o librerías de la **IA** | `docker compose -f docker-compose.yml up -d --build ia` |
| El **`.env`** (principal) | `docker compose -f docker-compose.yml up -d` |
| El modelo **`best.pt`** | `docker compose -f docker-compose.yml restart ia` |
| El **video** de la demo | `docker compose -f docker-compose.yml --profile demo restart camara-simulada` |

### Mirar por dentro

| Comando | Qué hace |
|---|---|
| `docker compose -f docker-compose.yml exec backend printenv DATABASE_URL` | Qué base usa el backend principal |
| `docker compose -f docker-compose.dev.yml exec db psql -U safesplash -d safesplash` | Entrar a la base **local de desarrollo** (`\dt` lista tablas, `\q` sale) |
| `docker stats` | CPU y memoria de cada contenedor |
| `docker system df` | Cuánto espacio ocupa Docker |

### Con cuidado

| Comando | ⚠️ |
|---|---|
| `docker compose -f docker-compose.dev.yml down -v` | **Borra la base de datos local de desarrollo** y la caché. No toca la base externa |
| `docker system prune` | Borra contenedores parados, redes e imágenes sin usar. Puede causar el error `network … not found` (ver abajo) |
| `docker builder prune` | Borra la caché de construcción: la próxima vez vuelve a bajar todo |

---

## 6. Problemas comunes

| Síntoma | Qué hacer |
|---|---|
| `wsl --version` da *"Clase no registrada"* y Docker no arranca | WSL quedó instalado a medias. En PowerShell **como administrador**: `Get-AppxPackage MicrosoftCorporationII.WindowsSubsystemForLinux \| Remove-AppxPackage`, instalar el `.msi` de <https://github.com/microsoft/WSL/releases> y reiniciar |
| `failed to set up container networking: network … not found` | `docker compose -f docker-compose.yml --profile demo --profile phone down --remove-orphans` y volver a levantar (no borra datos) |
| `npm ci … package.json and package-lock.json … are not in sync` | El lock se generó con otro npm. En la carpeta de esa parte: `npx npm@10 install --package-lock-only` |
| `THESE PACKAGES DO NOT MATCH THE HASHES` al construir la IA | Una descarga se cortó (conexión lenta). Repetir `docker compose -f docker-compose.yml build ia` |
| `backend` queda `unhealthy` | `docker compose -f docker-compose.yml logs backend` muestra por qué. Revisa `JWT_SECRET` y la conexión a la base |
| `migraciones` termina en `Exited (1)` | `docker compose -f docker-compose.yml logs migraciones`. `P1001` = no llega a la base (revisar `DATABASE_URL`) |
| `ia` se reinicia una y otra vez | `docker compose -f docker-compose.yml logs ia`. Sin cámara ni `--profile demo` no tiene video para leer |
| La IA dice `en pausa: sin sesión` | Es normal: no corre el modelo hasta que alguien inicia una sesión en la web |
| La web dice *"This page couldn't load"* después de reconstruir | Una pestaña vieja: recargar con **Ctrl+F5** |
| *"Correo o contraseña incorrectos"* con el administrador | Es la de `ADMIN_PASSWORD` del `.env`, no la del `.env.example`. El administrador se crea **una sola vez**: cambiar el `.env` después no le cambia la contraseña |
| No se ve nada en Supabase | Revisa que `DATABASE_URL` en `.env` apunte al proyecto correcto |

---

## Más información

| Tema | Documento |
|---|---|
| Cómo está armado el sistema y por qué | [docs/Arquitectura.md](Splash_code_repository/docs/Arquitectura.md) |
| Docker en detalle (servicios, volúmenes, redes) | [docs/Docker.md](Splash_code_repository/docs/Docker.md) |
| Correr sin Docker (para desarrollar) | [docs/Ejecutar.md](Splash_code_repository/docs/Ejecutar.md) |
| Base de datos: local, Docker o Supabase | [docs/BaseDeDatos.md](Splash_code_repository/docs/BaseDeDatos.md) |
| Calibración de la cámara | [docs/Calibracion.md](Splash_code_repository/docs/Calibracion.md) |
| Procesamiento en el celular | [ServidorIA/ProcesamientoCelular/README.md](Splash_code_repository/ServidorIA/ProcesamientoCelular/README.md) |
| **Lo que falta hacer** | [docs/Pendientes.md](Splash_code_repository/docs/Pendientes.md) |
