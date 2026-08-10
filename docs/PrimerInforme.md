# Guía para el primer informe del proyecto

## Resumen / Abstract

Presenta una síntesis breve del problema abordado, la solución propuesta, el alcance del proyecto, la metodología de desarrollo y el plan general de trabajo. Debe permitir al lector comprender la esencia del proyecto sin necesidad de leer el documento completo.

## 1. Introducción

Redacta la introducción como un texto continuo de 4 párrafos. El primero debe describir el dominio o sector del proyecto, las tendencias tecnológicas relevantes y el rol del software en ese contexto. El segundo debe exponer la situación actual: limitaciones del mercado, carencias funcionales y el impacto en los usuarios. El tercero debe presentar la necesidad técnica identificada y la oportunidad de diseño tecnológico. El cuarto, opcional, debe cerrar con una presentación general de la solución propuesta (nombre, funcionalidades clave e impacto esperado), sirviendo de transición hacia las secciones siguientes.

### Contextos

- **Dominio o sector** (ej. educación, industria, salud, ciudades inteligentes, TI).
- **Tendencias tecnológicas relevantes**.
- **Rol de los sistemas de información / software / datos** en ese contexto.

### Situación actual

- **Limitaciones del mercado actual**.
- **Carencias funcionales o de diseño**.
- **Impacto en usuarios**.

### Necesidad identificada

- **Necesidad técnica clara**.
- **Oportunidad de diseño tecnológico**.

### Propuesta general

- **Nombre del sistema**.
- **Funcionalidades clave**.
- **Impacto esperado**.

## 2. Planteamiento del problema

Define y delimita el problema central, explicando qué se busca resolver y por qué es relevante.

El problema se define como una **carencia o déficit** que se manifiesta como un **estado negativo** en una situación real (no teórica), localizado en una **población objetivo bien definida**. No debe confundirse con la falta de un servicio específico ni con la inexistencia de una solución tecnológica. El problema no es "hace falta un sistema que integre X", sino la evidencia de una situación deficiente: por ejemplo, "existen aplicaciones diferentes e incompatibles en los distintos departamentos de la empresa, lo que genera desconexión entre las unidades y pérdida de calidad en la información para la toma de decisiones". Tampoco se trata de un trabajo para una empresa en particular, sino de una **problemática transferible** a contextos similares.

### 2.1 Descripción del problema

Expone con claridad la problemática, sus causas, a quién afecta y cuáles son sus principales consecuencias.

### 2.2 Justificación

Explica por qué el problema debe ser atendido y cuál es la pertinencia académica, técnica, social o práctica del proyecto.

### 2.3 Restricciones y supuestos iniciales

Indica las principales limitaciones y condiciones asumidas para plantear la solución, tales como tiempo, recursos, acceso a información, disponibilidad de usuarios, infraestructura o restricciones técnicas.

## 3. Alcance del proyecto
El alcance de este proyecto comprende el diseño e implementación de un **prototipo inicial** de un sistema de visión por computador para el seguimiento automático de nadadores. El prototipo contempla una **cámara fija** calibrada mediante las **medidas físicas predefinidas de la piscina**, un modelo **YOLO con tracking integrado** para la detección y seguimiento del nadador, y un **Servidor de IA** que calcula las métricas básicas de entrenamiento (tiempo por vuelta, distancia recorrida y velocidad promedio) y las envía a un **Servidor Web** para su almacenamiento. El acceso se realiza mediante una **página web con autenticación**, donde el usuario puede visualizar las estadísticas del entrenamiento.

### Incluye

1. Captura de video en tiempo real mediante una cámara fija ubicada en la piscina semiolímpica.
2. Calibración del sistema mediante las medidas físicas predefinidas de la piscina (longitud de carril, marcas de fondo, banderas de vuelta).
3. Preprocesamiento y estandarización de los frames (redimensionamiento, corrección de iluminación, mejora de contraste, reducción de ruido, corrección de perspectiva, normalización) antes de su envío al modelo de IA.
4. Detección y seguimiento automático del nadador mediante un modelo YOLO con tracking integrado.
5. Identificación automática del inicio y final de cada vuelta.
6. Cálculo automático de: tiempo total de entrenamiento, tiempo por vuelta, número de largos completados, distancia recorrida, velocidad promedio, ritmo de nado y tiempo de descanso entre series.
7. Arquitectura de dos servidores: **Servidor de IA** (preprocesamiento, detección, tracking, motor de eventos y motor analítico) y **Servidor Web** (backend + frontend), con comunicación y sincronización de estado entre ambos (heartbeat).
8. Almacenamiento de las métricas obtenidas en una base de datos.
9. Plataforma web para visualizar estadísticas individuales e históricas en tiempo real.
10. Generación de reportes de desempeño y evolución del entrenamiento con posibilidad de exportar
11. Panel para entrenadores con seguimiento de los nadadores a su cargo.
12. Módulo de autenticación con roles diferenciados (administrador, entrenador, nadador).

### No incluye / Limitaciones

1. Medición de variables fisiológicas como frecuencia cardíaca, saturación de oxígeno o consumo energético.
2. Corrección automática de la técnica de nado mediante análisis biomecánico avanzado.
3. **Identificación de los diferentes estilos de natación** (libre, espalda, pecho, mariposa) con evaluación técnica detallada; el sistema no distingue el estilo que emplea el nadador, únicamente su desplazamiento y posición.
4. **Sincronización entre múltiples cámaras**: al utilizarse una sola cámara, el sistema no contempla la fusión, calibración cruzada ni sincronización temporal entre distintas fuentes de video.
5. **Cobertura limitada de carriles o campo visual**: el seguimiento simultáneo de múltiples carriles con una sola cámara queda sujeto a validación técnica posterior y no está garantizado dentro del alcance actual.
6. **Condiciones adversas del entorno**: el sistema no garantiza su desempeño óptimo ante variaciones fuertes de iluminación, reflejos en el agua, salpicaduras, sombras o condiciones climáticas que afecten la calidad de la captura de video.
7. **Limitaciones del tracking**: pérdida temporal o permanente del identificador de un nadador en escenarios de oclusión prolongada, alta similitud visual entre nadadores (mismo color de gorro/traje) o movimientos bruscos fuera del campo de visión de la cámara.
8. **Latencia en el procesamiento con múltiples nadadores simultáneos**: cuando existe un número elevado de nadadores en el campo visual, el tiempo de procesamiento por frame puede incrementarse, afectando la actualización de métricas en tiempo real.
9. Integración con relojes inteligentes u otros dispositivos wearables.
10. Gestión administrativa de reservas o acceso a la piscina.

## 4. Objetivos

### 4.1 Objetivo general

Diseñar e implementar un sistema inteligente basado en visión por computador que permita realizar el seguimiento automático de nadadores durante sus sesiones de entrenamiento en la piscina semiolímpica de la Universidad del Norte, mediante una única cámara calibrada contra las medidas físicas predefinidas de la piscina, registrando tiempos, recorridos e indicadores de desempeño que apoyen el análisis objetivo del entrenamiento por parte de entrenadores y deportistas.

### 4.2 Objetivos específicos

Capturar y calibrar el video de entrenamiento mediante una cámara fija, estableciendo la correspondencia entre coordenadas de imagen y distancias reales a partir de las medidas estáticas predefinidas de la piscina (longitud de carril, marcas de fondo, banderas de vuelta).
- Preprocesar y estandarizar los frames capturados (redimensionamiento, corrección de iluminación, mejora de contraste, reducción de ruido, corrección de perspectiva y normalización), garantizando que únicamente frames estandarizados y validados sean enviados al modelo de inteligencia artificial.
- Detectar y realizar seguimiento (tracking) automático de los nadadores presentes en el carril mediante un modelo YOLO con capacidades integradas de detección y tracking (p. ej. YOLO + ByteTrack/DeepSORT), manteniendo la identidad de cada nadador durante toda la sesión, incluso ante oclusiones temporales o cambios de dirección.
- Identificar automáticamente eventos de nado, tales como el inicio y fin de cada vuelta, cambios de dirección, períodos de descanso y finalización del entrenamiento.
- Calcular métricas de desempeño por nadador —tiempo por vuelta, tiempo total, distancia recorrida, velocidad promedio, ritmo de entrenamiento, número de largos y tiempos de descanso— a partir de los datos generados por el módulo de tracking.
- Diseñar una arquitectura de comunicación entre el Servidor de IA y el Servidor Web que permita el envío confiable de métricas, la validación de la información recibida y la sincronización del estado de ambos servicios (activo/inactivo, heartbeat).
- Desarrollar una plataforma web (backend + frontend) que permita a entrenadores y nadadores visualizar estadísticas en tiempo real, consultar el historial de entrenamientos y comparar sesiones anteriores.
- Generar reportes de desempeño exportables en formato PDF y CSV, que resuman las métricas individuales y la evolución del rendimiento del nadador.
- Gestionar los roles de usuario (administrador, entrenador, nadador) mediante un módulo de autenticación y autorización que restrinja el acceso a las funciones según el perfil correspondiente.
## 5. Solución propuesta

Describe a alto nivel la solución planteada para abordar el problema identificado. Explica qué se propone construir, quiénes serían sus usuarios, cómo funcionaría de manera general y por qué constituye una respuesta adecuada dentro del alcance definido.

## 6. Estado del arte / soluciones relacionadas

Presenta antecedentes o soluciones existentes relevantes, con el fin de contextualizar la propuesta y mostrar oportunidades de diferenciación, mejora o aporte.

Responde a las preguntas: ¿qué soluciones existen hoy?, ¿cómo abordan el problema?, ¿qué limitaciones presentan?

### Revisar

- Productos comerciales.
- Soluciones open-source.
- Arquitecturas o enfoques técnicos relevantes.

### Comparar

- Funcionalidad.
- Escalabilidad.
- Costos.
- Usabilidad.
- Limitaciones técnicas.

### Resultados esperados

- Identificación de **vacíos, oportunidades o problemas no resueltos**.
- **Justificación técnica** de por qué se requiere una nueva solución.

## 7. Metodología de desarrollo y plan de trabajo

Describe el enfoque metodológico que orientará el desarrollo del proyecto y la forma en que este se traducirá en actividades, iteraciones y entregables concretos. Debe explicar cómo se construirá, validará y refinará la solución a lo largo del proceso.

### 7.1 Enfoque metodológico

Explica la metodología adoptada para el desarrollo del proyecto, justificando su elección. En particular, debe describirse el uso de un enfoque de prototipado iterativo, indicando cómo se plantea avanzar mediante ciclos sucesivos de diseño, construcción, prueba y ajuste de la solución.

### 7.2 Iteraciones o fases de desarrollo

Describe las principales fases o iteraciones previstas para el proyecto, indicando el propósito de cada una, las actividades principales a realizar y la manera en que cada ciclo contribuirá al refinamiento progresivo de la solución.

### 7.3 Estrategia de validación

Explica cómo se evaluarán los avances en cada iteración, por ejemplo mediante retroalimentación de usuarios, pruebas funcionales, revisión de requerimientos o validaciones técnicas y de usabilidad.

### 7.4 Plan de trabajo, cronograma o hitos

Presenta la planificación general del proyecto en forma de cronograma, tabla o listado de hitos, indicando las actividades principales, los entregables esperados y, cuando aplique, la temporalidad estimada de cada fase.

## 8. Referencias

Incluye las fuentes consultadas y citadas en el documento, en el formato de citación definido para el curso o proyecto.
