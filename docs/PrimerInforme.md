# Safe Splash 2: sistema de monitoreo del rendimiento de nadadores mediante visión por computador

## Resumen / Abstract

El seguimiento del rendimiento en natación depende hoy, en gran medida, de la observación y el cronometraje manual por parte del entrenador, lo que introduce imprecisiones y limita la posibilidad de construir un historial digital y objetivo del desempeño del deportista. Safe Splash 2 propone un sistema de visión por computador que, mediante una única cámara fija instalada sobre los carriles 4 y 5 de la piscina semiolímpica de la Universidad del Norte, detecta y sigue automáticamente a los nadadores, identifica eventos de nado (inicio y fin de vuelta, cambios de dirección, períodos de descanso) y calcula métricas de desempeño —tiempo por vuelta, distancia recorrida, velocidad promedio y ritmo— sin necesidad de instrumentar al deportista con sensores portátiles. La solución se apoya en un modelo YOLO con tracking integrado (ByteTrack/DeepSORT), calibrado contra las medidas físicas predefinidas de la piscina, y se organiza en una arquitectura de dos servidores —un Servidor de IA encargado del procesamiento de video y del cálculo de métricas, y un Servidor Web encargado del almacenamiento, la autenticación y la visualización— sincronizados entre sí. 

## 1. Introducción

El entrenamiento deportivo de alto rendimiento se apoya cada vez más en tecnologías capaces de capturar información cuantitativa objetiva sobre el desempeño de los atletas, y la natación no es la excepción. En los últimos años, la visión por computador y el aprendizaje profundo han pasado de ser técnicas experimentales a convertirse en herramientas viables para el análisis deportivo: modelos de detección de objetos como la familia YOLO, combinados con algoritmos de seguimiento multiobjeto como ByteTrack o DeepSORT, permiten hoy detectar, seguir e interpretar el movimiento de personas dentro de un video sin necesidad de instrumentación física. En el ámbito de la natación en particular, el software cumple un rol cada vez más central como intermediario entre el gesto del deportista en el agua y la información que el entrenador necesita para tomar decisiones, sustituyendo progresivamente tareas que tradicionalmente exigían observación directa y registro manual.

A pesar de este avance tecnológico, la situación actual en la mayoría de los entornos de entrenamiento —incluida la piscina semiolímpica de la Universidad del Norte— sigue dependiendo casi por completo de la observación y el cronometraje manual. Esto obliga al entrenador a repartir su atención entre dirigir la sesión, cronometrar a los nadadores y registrar la información relevante, lo cual introduce errores humanos en el inicio y la parada del cronómetro y hace prácticamente inviable cronometrar con precisión a varios nadadores de forma simultánea. Además, la ausencia de un registro digital estructurado impide construir un historial de rendimiento que permita comparar sesiones, identificar tendencias y evaluar objetivamente la progresión del deportista a lo largo del tiempo, una carencia que afecta tanto a entrenadores, que pierden capacidad de análisis longitudinal, como a los propios nadadores, que no cuentan con retroalimentación cuantitativa sistemática de su evolución.

De esta situación se desprende una necesidad técnica concreta: contar con un mecanismo automático, no invasivo y de bajo costo de instrumentación, capaz de observar a los nadadores durante el entrenamiento y traducir ese video en métricas objetivas de desempeño. La oportunidad de diseño tecnológico consiste en aprovechar los avances recientes en detección y seguimiento de objetos —ya demostrados en otros contextos de natación con configuraciones de mayor infraestructura, como sistemas de ocho cámaras o de captura aérea mediante drones— para plantear una solución equivalente pero adaptada a una restricción real y frecuente en entornos universitarios: la disponibilidad de una única cámara fija que solo cubre una zona parcial de la piscina.

Sobre esta base surge Safe Splash 2, un sistema de visión por computador orientado al seguimiento automático de nadadores en la piscina semiolímpica de la Universidad del Norte mediante una cámara fija instalada sobre los carriles 4 y 5. Sus funcionalidades clave incluyen la detección y el seguimiento del nadador mediante un modelo YOLO con tracking integrado, la identificación automática de eventos de nado y el cálculo de métricas como tiempo por vuelta, distancia recorrida, velocidad promedio y ritmo, todo ello accesible mediante una plataforma web con autenticación para entrenadores y nadadores. El impacto esperado es ofrecer una herramienta objetiva, escalable y de bajo costo de instrumentación que complemente —y no reemplace— el criterio del entrenador, sirviendo de base para las secciones siguientes, en las que se detalla el problema, el alcance, los objetivos y la solución propuesta.

---

## 2. Planteamiento del problema

### 2.1 Descripción del problema

En la piscina semiolímpica de la Universidad del Norte —al igual que en la mayoría de los entornos de entrenamiento de natación que no cuentan con infraestructura de análisis automatizado— el seguimiento del rendimiento de los nadadores depende casi exclusivamente de la observación directa y el cronometraje manual realizado por el entrenador. Esta situación no es un caso aislado, sino una carencia transferible a cualquier contexto de entrenamiento con recursos tecnológicos limitados: existen técnicas de visión por computador capaces de automatizar este análisis, pero no están siendo aprovechadas en la práctica cotidiana del entrenamiento.

Esta carencia se manifiesta de varias formas. En primer lugar, la carga cognitiva del entrenador se ve comprometida cuando debe simultáneamente dirigir la sesión, cronometrar y registrar datos, lo que le resta capacidad de atención a los aspectos cualitativos del entrenamiento. En segundo lugar, la precisión del cronometraje manual es limitada: los errores humanos en el inicio y la parada del cronómetro, sumados a la dificultad de cronometrar a múltiples nadadores de forma simultánea, introducen imprecisiones que pueden oscurecer la verdadera evolución del deportista. En tercer lugar, la falta de un registro digital estructurado impide construir un historial de rendimiento que permita comparar sesiones, identificar tendencias y evaluar objetivamente la progresión del nadador a lo largo del tiempo.

Las principales afectadas por esta carencia son dos poblaciones concretas: los entrenadores, que carecen de una herramienta objetiva y escalable para el análisis diario y la evaluación técnica, y los propios nadadores, que no reciben retroalimentación cuantitativa sistemática sobre su desempeño. La consecuencia directa es que las decisiones de entrenamiento —ajustes de ritmo, series, tiempos de descanso— terminan apoyándose en percepciones subjetivas en lugar de datos verificables, lo que limita la calidad del proceso de mejora deportiva.

### 2.2 Justificación

Atender este problema es pertinente desde una perspectiva deportiva, tecnológica y académica. Desde el punto de vista deportivo, un sistema como Safe Splash 2 puede proporcionar a entrenadores y nadadores información cuantitativa que complemente la observación tradicional: el registro automático de variables como tiempos, distancia, velocidad y ritmo facilita el análisis posterior de las sesiones y permite construir un historial digital del desempeño. La investigación reciente confirma que esto es alcanzable: Chern et al. (2025) desarrollaron un sistema capaz de calcular tiempos parciales a partir de video con un error absoluto medio de 0,36 segundos, y el sistema Dronaquatics (Tran et al., 2026) logró un error de estimación de velocidad inferior al 4 % (menos de 0,05 m/s) y un error en tiempo por vuelta de solo 0,03 segundos. Estos resultados demuestran que la visión por computador puede alcanzar niveles de precisión comparables o superiores a los métodos manuales, si bien cabe anotar que ambos sistemas emplean infraestructuras considerablemente más amplias (ocho cámaras y un dron, respectivamente) que la cámara única contemplada para Safe Splash 2, por lo que sus cifras de precisión deben tomarse como referencia superior y no como una meta directamente comparable.

Desde el punto de vista tecnológico, el proyecto integra diferentes áreas de la Ingeniería de Sistemas —inteligencia artificial, visión por computador, procesamiento de video, seguimiento multiobjeto, bases de datos, desarrollo web y arquitectura de software— y exige resolver un problema compuesto: un detector permite localizar al nadador en cada cuadro, pero no basta para determinar su trayectoria a lo largo del tiempo, por lo que se requiere además un algoritmo de seguimiento que mantenga una identidad asociada a las detecciones. ByteTrack constituye una alternativa relevante para este propósito: Zhang et al. (2022) plantearon un método de seguimiento multiobjeto que asocia también detecciones de baja confianza, reduciendo trayectorias fragmentadas y pérdidas de objetos durante oclusiones, un enfoque especialmente valioso en el entorno acuático, donde las salpicaduras y los cruces entre nadadores generan detecciones de confianza fluctuante.

Finalmente, desde una perspectiva académica, el proyecto permite estudiar la integración de algoritmos de inteligencia artificial dentro de un sistema de software completo, en lugar de limitarse al entrenamiento aislado de un modelo de detección. Safe Splash 2 contempla una cadena de procesamiento completa —captura, preprocesamiento, detección, tracking, procesamiento de eventos, cálculo de métricas, almacenamiento y visualización— organizada mediante una arquitectura modular que separa el procesamiento de inteligencia artificial, el backend, la base de datos y el frontend, siguiendo las mejores prácticas de ingeniería de software documentadas en sistemas similares.

### 2.3 Restricciones y supuestos iniciales

El planteamiento de la solución asume las siguientes restricciones y supuestos:

- **Cámara única y campo visual parcial:** el sistema dispone de una sola cámara fija instalada sobre los carriles 4 y 5, la cual no cubre los extremos completos de la piscina ni el resto de los carriles. En consecuencia, ciertos eventos (p. ej. el viraje contra la pared) deberán ser inferidos y no observados directamente.
- **Calibración basada en medidas físicas predefinidas:** se asume que las medidas físicas de la piscina (longitud de carril, marcas de fondo, banderas de vuelta) son estables, conocidas de antemano y accesibles para realizar la calibración del sistema.
- **Disponibilidad de la piscina y de usuarios de prueba:** el desarrollo y la validación dependen de la disponibilidad de horarios de acceso a la piscina semiolímpica y de la colaboración voluntaria de nadadores y entrenadores para las pruebas de campo.
- **Ausencia de un dataset propio previo:** no existe, al inicio del proyecto, un conjunto de datos anotado de nadadores específico de esta piscina; su construcción (captura y etiquetado de imágenes) forma parte del trabajo a realizar y condiciona los tiempos de la fase de entrenamiento del modelo.
- **Recursos computacionales acotados:** el proyecto se desarrolla con los recursos de cómputo disponibles en un contexto académico, sin garantía de acceso permanente a hardware GPU de alto rendimiento, lo cual condiciona las decisiones sobre el tamaño y la complejidad del modelo a emplear.
- **Condiciones ambientales variables no controladas en su totalidad:** aunque se busca mitigar el efecto de reflejos, salpicaduras e iluminación variable mediante preprocesamiento, no se garantiza un desempeño óptimo bajo condiciones ambientales extremas.
- **Tiempo de desarrollo acotado al calendario académico:** el alcance del prototipo y el plan de trabajo están condicionados por la duración del período académico en el que se desarrolla el proyecto.

---

## 3. Alcance del proyecto

El alcance de este proyecto comprende el diseño e implementación de un prototipo inicial de un sistema de visión por computador para el seguimiento automático de nadadores. El prototipo contempla una cámara fija calibrada mediante las medidas físicas predefinidas de la piscina, un modelo YOLO con tracking integrado para la detección y seguimiento del nadador, y un Servidor de IA que calcula las métricas básicas de entrenamiento (tiempo por vuelta, distancia recorrida y velocidad promedio) y las envía a un Servidor Web para su almacenamiento. El acceso se realiza mediante una página web con autenticación, donde el usuario puede visualizar las estadísticas del entrenamiento.

**Incluye**

- Captura de video en tiempo real mediante una cámara fija ubicada en la piscina semiolímpica.
- Calibración del sistema mediante las medidas físicas predefinidas de la piscina (longitud de carril, marcas de fondo, banderas de vuelta).
- Preprocesamiento y estandarización de los frames (redimensionamiento, corrección de iluminación, mejora de contraste, reducción de ruido, corrección de perspectiva, normalización) antes de su envío al modelo de IA.
- Detección y seguimiento automático del nadador mediante un modelo YOLO con tracking integrado.
- Identificación automática del inicio y final de cada vuelta.
- Cálculo automático de: tiempo total de entrenamiento, tiempo por vuelta, número de largos completados, distancia recorrida, velocidad promedio, ritmo de nado y tiempo de descanso entre series.
- Arquitectura de dos servidores: Servidor de IA (preprocesamiento, detección, tracking, motor de eventos y motor analítico) y Servidor Web (backend + frontend), con comunicación y sincronización de estado entre ambos (heartbeat).
- Almacenamiento de las métricas obtenidas en una base de datos.
- Plataforma web para visualizar estadísticas individuales e históricas en tiempo real.
- Generación de reportes de desempeño y evolución del entrenamiento con posibilidad de exportar.
- Panel para entrenadores con seguimiento de los nadadores a su cargo.
- Módulo de autenticación con roles diferenciados (administrador, entrenador, nadador).

**No incluye / Limitaciones**

- Medición de variables fisiológicas como frecuencia cardíaca, saturación de oxígeno o consumo energético.
- Corrección automática de la técnica de nado mediante análisis biomecánico avanzado.
- Identificación de los diferentes estilos de natación (libre, espalda, pecho, mariposa) con evaluación técnica detallada; el sistema no distingue el estilo que emplea el nadador, únicamente su desplazamiento y posición.
- Sincronización entre múltiples cámaras: al utilizarse una sola cámara, el sistema no contempla la fusión, calibración cruzada ni sincronización temporal entre distintas fuentes de video.
- Cobertura limitada de carriles o campo visual: el seguimiento simultáneo de múltiples carriles con una sola cámara queda sujeto a validación técnica posterior y no está garantizado dentro del alcance actual.
- Condiciones adversas del entorno: el sistema no garantiza su desempeño óptimo ante variaciones fuertes de iluminación, reflejos en el agua, salpicaduras, sombras o condiciones climáticas que afecten la calidad de la captura de video.
- Limitaciones del tracking: pérdida temporal o permanente del identificador de un nadador en escenarios de oclusión prolongada, alta similitud visual entre nadadores (mismo color de gorro/traje) o movimientos bruscos fuera del campo de visión de la cámara.
- Latencia en el procesamiento con múltiples nadadores simultáneos: cuando existe un número elevado de nadadores en el campo visual, el tiempo de procesamiento por frame puede incrementarse, afectando la actualización de métricas en tiempo real.
- Integración con relojes inteligentes u otros dispositivos wearables.
- Gestión administrativa de reservas o acceso a la piscina.

---

## 4. Objetivos

### 4.1 Objetivo general

Diseñar e implementar un sistema inteligente basado en visión por computador que permita realizar el seguimiento automático de nadadores durante sus sesiones de entrenamiento en la piscina semiolímpica de la Universidad del Norte, mediante una única cámara calibrada contra las medidas físicas predefinidas de la piscina, registrando tiempos, recorridos e indicadores de desempeño que apoyen el análisis objetivo del entrenamiento por parte de entrenadores y deportistas.

### 4.2 Objetivos específicos

1. Capturar y calibrar el video de entrenamiento mediante una cámara fija, estableciendo la correspondencia entre coordenadas de imagen y distancias reales a partir de las medidas estáticas predefinidas de la piscina (longitud de carril, marcas de fondo, banderas de vuelta).
2. Preprocesar y estandarizar los frames capturados (redimensionamiento, corrección de iluminación, mejora de contraste, reducción de ruido, corrección de perspectiva y normalización), garantizando que únicamente frames estandarizados y validados sean enviados al modelo de inteligencia artificial.
3. Detectar y realizar seguimiento (tracking) automático de los nadadores presentes en el carril mediante un modelo YOLO con capacidades integradas de detección y tracking (p. ej. YOLO + ByteTrack/DeepSORT), manteniendo la identidad de cada nadador durante toda la sesión, incluso ante oclusiones temporales o cambios de dirección.
4. Identificar automáticamente eventos de nado, tales como el inicio y fin de cada vuelta, cambios de dirección, períodos de descanso y finalización del entrenamiento.
5. Calcular métricas de desempeño por nadador —tiempo por vuelta, tiempo total, distancia recorrida, velocidad promedio, ritmo de entrenamiento, número de largos y tiempos de descanso— a partir de los datos generados por el módulo de tracking.
6. Diseñar una arquitectura de comunicación entre el Servidor de IA y el Servidor Web que permita el envío confiable de métricas, la validación de la información recibida y la sincronización del estado de ambos servicios (activo/inactivo, heartbeat).
7. Desarrollar una plataforma web (backend + frontend) que permita a entrenadores y nadadores visualizar estadísticas en tiempo real, consultar el historial de entrenamientos y comparar sesiones anteriores.
8. Generar reportes de desempeño exportables en formato PDF y CSV, que resuman las métricas individuales y la evolución del rendimiento del nadador.
9. Gestionar los roles de usuario (administrador, entrenador, nadador) mediante un módulo de autenticación y autorización que restrinja el acceso a las funciones según el perfil correspondiente.

---

## 5. Solución propuesta

Safe Splash 2 propone construir un sistema compuesto por una cámara fija, un **Servidor de IA** y un **Servidor Web** que trabajan de forma coordinada para transformar video en información útil de entrenamiento. A alto nivel, el flujo de procesamiento sigue la secuencia: *Cámara → Captura de video → Preprocesamiento → Detector de nadadores (YOLO) → Tracker (ByteTrack/DeepSORT) → Motor de eventos → Calibración/transformación espacial → Cálculo de métricas → Base de datos → API/Backend → Dashboard web*.

El **Servidor de IA** concentra el procesamiento más intensivo: recibe el video capturado, lo estandariza (redimensionamiento, corrección de iluminación y contraste, reducción de ruido, corrección de perspectiva), detecta y sigue al nadador mediante un modelo YOLO con tracking integrado, identifica eventos de nado a partir de la trayectoria (cruces de líneas virtuales, cambios de dirección) y calcula las métricas de desempeño. El **Servidor Web**, por su parte, recibe estas métricas ya calculadas, las almacena en una base de datos, gestiona la autenticación y los roles de usuario, y expone la información mediante una plataforma con frontend accesible a entrenadores y nadadores. Ambos servidores se comunican mediante una arquitectura con sincronización de estado (heartbeat), lo que permite detectar caídas de servicio y mantener la confiabilidad del envío de métricas.

Los usuarios del sistema son tres: **nadadores**, que consultan su historial y evolución de desempeño; **entrenadores**, que además pueden hacer seguimiento a los nadadores a su cargo y generar reportes exportables; y **administradores**, encargados de la gestión general de usuarios y roles. Esta solución constituye una respuesta adecuada al problema planteado porque automatiza precisamente las tareas que hoy recaen por completo en el entrenador —cronometraje, registro y cálculo de métricas—, sin requerir instrumentación física del nadador ni una infraestructura de cámaras múltiples, ajustándose así a una restricción real y común en entornos universitarios: la disponibilidad de una sola cámara fija con cobertura parcial de la piscina.

---

## 6. Estado del arte / soluciones relacionadas

La literatura especializada muestra una evolución desde sistemas basados exclusivamente en sensores portátiles hacia soluciones capaces de utilizar video para realizar mediciones sin instrumentar físicamente al nadador. A continuación se presentan cinco antecedentes representativos, evaluados frente a los criterios de funcionalidad, escalabilidad, costo/infraestructura, usabilidad y limitaciones técnicas, seguidos de los vacíos identificados que justifican la propuesta de Safe Splash 2.

**Chern et al. (2025) — Sistema de análisis de estilo mariposa.** Desarrollaron un sistema inteligente para registrar y analizar el estilo mariposa mediante ocho cámaras (cuatro sobre el agua y cuatro bajo el agua) distribuidas a lo largo de una piscina de 25 metros, junto con acelerómetros. El modelo de reconocimiento fue entrenado mediante transfer learning sobre 120.031 imágenes etiquetadas, utilizando YOLOv4 como base, y alcanzó un IoU de 81,51 % y un error absoluto medio de 0,36 segundos en tiempos parciales. Es un antecedente clave por demostrar la viabilidad de YOLO en el dominio acuático, pero su infraestructura (ocho cámaras + sensores portátiles) es considerablemente mayor que la de Safe Splash 2, lo que limita su escalabilidad a contextos con recursos reducidos.

**Dronaquatics (Tran et al., 2026) — Análisis de natación con drones.** Sistema completamente basado en visión que utiliza imágenes aéreas capturadas por drones para eliminar la necesidad de dispositivos portátiles o equipos subacuáticos. Reportó un error de estimación de velocidad inferior al 4 % (menos de 0,05 m/s) y un error en tiempo por vuelta de 0,03 segundos. Ofrece alta funcionalidad y buena usabilidad de operación (un solo operador de dron), pero su escalabilidad está condicionada por la necesidad de personal capacitado para el vuelo del dron y por restricciones normativas de uso de drones en instalaciones cerradas, además de un costo de hardware mayor al de una cámara fija.

**SwimmerNET (Giulietti et al., 2023) — Estimación de pose subacuática.** Método sin marcadores para estimación de pose 2D bajo el agua mediante una única cámara gran angular de 8 Megapíxeles y redes neuronales completamente convolucionales, probado en los estilos libre, mariposa y espalda con un error promedio de ~1 mm y una desviación estándar de ~10 mm en el peor escenario. Es el antecedente más cercano a Safe Splash 2 en términos de infraestructura (cámara única), lo que respalda la viabilidad técnica de esta configuración; sin embargo, su enfoque está orientado a la estimación de pose biomecánica y no a métricas de desplazamiento agregadas por sesión, ni incorpora una plataforma web de consulta.

**SMU y SUTD (2025) — Análisis con drones para nadadores de élite.** Sistema desplegado en marzo de 2025 por investigadores de Singapore Management University y Singapore University of Technology and Design para el equipo nacional de natación de Singapur, que analiza en tiempo real duración de la brazada, velocidad de nado y simetría corporal segmentando el cuerpo del atleta en 17 puntos. Tiene alta funcionalidad y validación en contexto de alto rendimiento, pero de nuevo depende de un dron operado por personal especializado, lo que eleva su costo y limita su replicabilidad en entornos universitarios con recursos acotados.

**Proyectos de código abierto en GitHub.** YOLO-swimmer-detection (DBDoco) implementa detección de nadadores en Python con YOLO, un frontend HTTP simple y un servidor Flask. SwimmingStyleAnalysis (Sapna24Sangmitra, 2024) implementa un pipeline más completo basado en YOLOv8 que combina extracción de cuadros, detección, estimación de pose (YOLOv8-pose) y clasificación de estilo de nado, con suavizado temporal. Ambos son gratuitos y de bajo costo de infraestructura, lo que los hace altamente escalables, pero carecen de módulos de calibración física de la piscina, de cálculo de métricas de entrenamiento (tiempo por vuelta, distancia, ritmo) y de una plataforma web orientada a entrenadores y nadadores, quedándose en el nivel de prueba de concepto técnico.

| Sistema | Funcionalidad | Escalabilidad | Costo / infraestructura | Usabilidad | Limitaciones técnicas |
|---|---|---|---|---|---|
| Chern et al. (2025) | Tiempos parciales, conteo de brazadas, ángulos de rodilla | Baja (8 cámaras + acelerómetros) | Alto | Requiere instalación fija compleja | No aplicado fuera del estilo mariposa validado |
| Dronaquatics (2026) | Velocidad, tiempo por vuelta, conteo de brazadas | Media (requiere operador de dron) | Medio-alto | Buena una vez en vuelo | Restricciones normativas y de espacio para volar en piscinas cubiertas |
| SwimmerNET (2023) | Pose 2D detallada del nadador | Alta (cámara única) | Bajo | Orientado a análisis técnico especializado | No calcula métricas agregadas de sesión ni tiene interfaz web |
| SMU/SUTD (2025) | Brazada, velocidad, simetría corporal en tiempo real | Media (requiere dron y personal) | Alto | Alta en contexto de selección nacional | Difícil de replicar con recursos universitarios limitados |
| Proyectos open-source (DBDoco; Sapna24Sangmitra, 2024) | Detección de nadadores; detección + pose + clasificación de estilo | Alta (gratuitos, cámara única) | Muy bajo | Nivel de prototipo técnico, sin UI orientada a usuario final | Sin calibración física, sin métricas de entrenamiento ni plataforma web |

**Resultados esperados de la revisión.** La revisión evidencia que existen soluciones consolidadas para partes aisladas del problema —detección de nadadores, seguimiento de objetos (ByteTrack, DeepSORT), estimación de pose y cálculo de métricas de desplazamiento—, pero ninguna de ellas combina, con una única cámara fija de bajo costo, la calibración física de la piscina, el cálculo de métricas de entrenamiento orientadas al entrenador (tiempo por vuelta, distancia, ritmo, descansos) y una plataforma web con roles diferenciados para consulta histórica. Los sistemas con mayor precisión reportada (Chern et al., 2025; Dronaquatics, 2026; SMU/SUTD, 2025) dependen de infraestructuras de captura amplias (múltiples cámaras o drones) inviables en un entorno universitario típico, mientras que las soluciones de cámara única (SwimmerNET, 2023; proyectos open-source) no cubren el cálculo de métricas de entrenamiento ni la capa de aplicación web. Esta combinación de restricciones —cámara única, bajo costo y orientación a entrenamiento— constituye el vacío técnico que Safe Splash 2 busca atender, y su aporte no debe plantearse como la creación de un nuevo algoritmo de detección o tracking, sino como la integración y adaptación de técnicas existentes a un escenario específico con restricciones reales de hardware, campo visual y procesamiento.

---

## 7. Metodología de desarrollo y plan de trabajo

### 7.1 Enfoque metodológico

El desarrollo de Safe Splash 2 seguirá un enfoque de **prototipado iterativo**, en el cual la solución se construye mediante ciclos sucesivos de diseño, construcción, prueba y ajuste, en lugar de intentar entregar el sistema completo en una sola etapa. Esta elección responde a la naturaleza incierta de varios componentes del proyecto —en particular, la precisión alcanzable del detector y del tracker en condiciones reales de la piscina de la Universidad del Norte, que no puede conocerse con certeza antes de experimentar— por lo que resulta más apropiado avanzar validando supuestos técnicos en cada ciclo (p. ej. calidad de detección, estabilidad del tracking, viabilidad de la calibración) antes de comprometer decisiones de arquitectura definitivas para las etapas siguientes.

### 7.2 Iteraciones o fases de desarrollo

- **Fase 0 — Investigación y preparación:** definición de requerimientos, medición y documentación física de la piscina (longitud de carril, marcas de fondo, banderas de vuelta), y revisión del estado del arte para fijar la línea base técnica.
- **Fase 1 — Prototipo de detección:** construcción de un conjunto de datos propio de imágenes de nadadores en la piscina de la universidad, y ajuste (fine-tuning) de un modelo YOLO para la detección del nadador dentro de la zona observable.
- **Fase 2 — Integración de tracking y motor de eventos:** incorporación de un algoritmo de seguimiento multiobjeto (ByteTrack o DeepSORT) sobre las detecciones del modelo, y diseño del motor de eventos basado en líneas o zonas virtuales para identificar entradas, salidas y cruces.
- **Fase 3 — Calibración y cálculo de métricas:** implementación de la homografía para transformar coordenadas de imagen a coordenadas físicas, y cálculo de las métricas de desempeño (tiempo por vuelta, distancia, velocidad, ritmo, descansos).
- **Fase 4 — Arquitectura Servidor de IA / Servidor Web:** desarrollo del canal de comunicación entre ambos servidores, incluyendo el mecanismo de sincronización de estado (heartbeat) y la persistencia de métricas en base de datos.
- **Fase 5 — Plataforma web:** desarrollo del backend y frontend, del módulo de autenticación con roles diferenciados (administrador, entrenador, nadador) y de la generación de reportes exportables (PDF/CSV).
- **Fase 6 — Integración, pruebas de campo y ajuste final:** pruebas del sistema completo en la piscina semiolímpica, recolección de retroalimentación de entrenadores y nadadores, y ajustes finales antes de la entrega.

### 7.3 Estrategia de validación

La validación de cada iteración combinará varias estrategias complementarias:

- **Comparación contra registros manuales de referencia:** contraste de los tiempos y distancias calculados por el sistema frente a cronometraje manual realizado en paralelo, empleando el error absoluto medio como métrica principal (siguiendo el precedente metodológico de Chern et al., 2025).
- **Pruebas funcionales por módulo:** verificación independiente del detector, el tracker, el motor de eventos, el cálculo de métricas y la plataforma web antes de su integración.
- **Métricas estándar de seguimiento multiobjeto:** evaluación del módulo de tracking mediante métricas MOTA e IDF1, conforme al protocolo CLEAR MOT (Bernardin & Stiefelhagen, 2008).
- **Retroalimentación cualitativa de usuarios:** sesiones breves con entrenadores y nadadores voluntarios al cierre de cada fase relevante, para evaluar la usabilidad de la plataforma web y la utilidad percibida de las métricas presentadas.
- **Pruebas de robustez:** evaluación del comportamiento del sistema ante escenarios de oclusión, múltiples nadadores simultáneos y variaciones de iluminación, documentando explícitamente los casos en los que el sistema no logra un desempeño confiable.

### 7.4 Plan de trabajo, cronograma o hitos

| Fase | Actividades principales | Entregable esperado | Duración estimada |
|---|---|---|---|
| Fase 0 | Definición de requerimientos, medición física de la piscina, revisión de literatura | Documento de requerimientos y estado del arte | 2 semanas |
| Fase 1 | Captura y etiquetado de dataset propio, fine-tuning del detector YOLO | Modelo de detección entrenado y evaluado (IoU) | 3 semanas |
| Fase 2 | Integración de tracker y motor de eventos | Módulo de tracking + detección de eventos funcional | 2 semanas |
| Fase 3 | Calibración por homografía y cálculo de métricas | Módulo de métricas validado con datos de prueba | 2 semanas |
| Fase 4 | Arquitectura Servidor de IA / Servidor Web, heartbeat, base de datos | Comunicación entre servidores operativa | 2 semanas |
| Fase 5 | Backend, frontend, autenticación por roles, reportes exportables | Plataforma web funcional | 3 semanas |
| Fase 6 | Pruebas de campo, retroalimentación de usuarios, ajustes finales | Prototipo validado y documentación final | 1 semanas |



---

## 8. Referencias

Bernardin, K., & Stiefelhagen, R. (2008). Evaluating multiple object tracking performance: the CLEAR MOT metrics. *EURASIP Journal on Image and Video Processing*.

Chern, Y.-R., Chen, Y.-H., Lin, F.-S., Lin, H.-C., Chen, G.-T., Chu, C.-P., Machtsiras, G., Huang, T.-H., Lien, J.-J. J., & Huang, C.-H. (2025). A butterfly stroke swimming recording and performance analysis system based on computer vision and machine learning. *Measurement, 251*, 117171. https://doi.org/10.1016/j.measurement.2025.117171

Giulietti, N., Caputo, A., Chiariotti, P., & Castellini, P. (2023). SwimmerNET: Underwater 2D Swimmer Pose Estimation Exploiting Fully Convolutional Neural Networks. *Sensors, 23*(4), 2364. https://doi.org/10.3390/s23042364

Tran, T., Joseph, H. A., Lee, K., Choo, K. T. W., Ma, D., Foong, S., Kandappu, T., Ko, J., & Balan, R. (2026). Dronaquatics: Real-time Swimming Analytics Using Drone Captured Imagery. *Proceedings of the IEEE/CVF Winter Conference on Applications of Computer Vision (WACV)*, 4881-4889. https://doi.org/10.1109/WACV61042.2026.00474

Wojke, N., Bewley, A., & Paulus, D. (2017). Simple online and realtime tracking with a deep association metric. *IEEE International Conference on Image Processing (ICIP)*, 3645-3649.

Zhang, Y., Sun, P., Jiang, Y., Yu, D., Weng, F., Yuan, Z., Luo, P., Liu, W., & Wang, X. (2022). ByteTrack: Multi-object tracking by associating every detection box. *Computer Vision – ECCV 2022: 17th European Conference, Tel Aviv, Israel, Proceedings, Part XXII*, 1-21.

Ultralytics. (2023). *YOLOv8 Documentation*. https://docs.ultralytics.com/

SMU and SUTD. (2025). SMU and SUTD Deploy Drone and AI-Driven Analytics To Improve Performance of National Swimmers. *SMU Newsroom*, 4 de marzo de 2025. https://news.smu.edu.sg/news/2025/03/04/smu-and-sutd-deploy-drone-and-ai-driven-analytics-improve-performance-national

DBDoco. (2024). *YOLO-swimmer-detection*. GitHub repository. https://github.com/DBDoco/YOLO-swimmer-detection

Sapna24Sangmitra. (2024). *SwimmingStyleAnalysis*. GitHub repository. https://github.com/Sapna24Sangmitra/SwimmingStyleAnalysis
