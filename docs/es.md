# Téléray

## Qué hace

Lleva a Gladys la **tasa de dosis gamma ambiental** medida por las balizas de la red **Téléray** de la ASNR
(autoridad francesa de seguridad nuclear y protección radiológica, antes IRSN): unas 480 balizas en Francia, en sus
territorios de ultramar y en algunas embajadas, una medición cada 10 minutos. La integración lee el mapa público
Téléray ([teleray.asnr.fr](https://teleray.asnr.fr)), sin cuenta.

Para cada baliza seguida: la tasa de dosis, su media de 24 horas, el fondo natural de la baliza, la hora y el estado
de la medición, un widget de panel con la curva de 24 horas y disparadores de escena cuando la tasa sube por encima
del fondo.

**Esta integración no es un sistema de alerta oficial**: en caso de emergencia, siga las instrucciones de las
autoridades. Los niveles naturales varían: la lluvia arrastra al suelo los descendientes del radón y puede añadir de
20 a 50 nSv/h durante unas horas. La integración no está afiliada a la ASNR. Datos © ASNR.

## Requisitos

- Gladys 5.3.0 o posterior.
- Acceso a Internet desde Gladys.
- La ubicación de su casa (Ajustes → Casas), para seguir automáticamente la baliza más cercana.

## Configuración

1. Instale la integración: Integraciones → Instalar desde GitHub, dirección
   `https://github.com/guim31/gladys-teleray`.
2. **Balizas**: déjelo vacío para seguir la baliza más cercana a su casa, o escriba hasta 5 números o nombres de
   balizas separados por comas (p. ej. `1411, PARIS-BERCY`). El botón **Buscar las balizas alrededor de una casa**
   lista las más cercanas con su número y su distancia.
3. **Idioma**: idioma de los nombres de las funciones (fijados al añadir un dispositivo) y de los textos.
4. Abra la pestaña **Descubrimiento** y añada la baliza.

## Dispositivos

Un dispositivo por baliza, con su nombre (p. ej. `TOULOUSE (Téléray)`):

| Función               | Qué es                                                                          |
| --------------------- | ------------------------------------------------------------------------------- |
| Tasa de dosis (nSv/h) | tasa de dosis gamma ambiental de la última medición, en nanosieverts por hora   |
| Media 24 h (nSv/h)    | media de las mediciones válidas de las últimas 24 horas                         |
| Fondo natural (nSv/h) | el nivel habitual de la baliza, calculado por la ASNR                           |
| Hora de la medición   | hora de la última medición (el mapa la publica de 20 a 40 minutos después)      |
| Estado de la baliza   | Medición validada, Aún no validada, Medición invalidada o Sin medición reciente |

Gladys no tiene unidad de radiactividad: la unidad está en el nombre de las funciones. Una medición de más de 2 horas
ya no se publica como actual (el estado indica entonces «Sin medición reciente»), como en el mapa de la ASNR.

## Widget

**Tasa de dosis Téléray**: la tasa de dosis, la media de 24 h y el fondo en mosaicos, la curva de las últimas
24 horas con el fondo, y la hora, el estado y la fuente de la medición. Ajustes: la baliza (vacío: la primera
añadida), y dos interruptores para ocultar la curva o la hora y el estado.

## Escenas

- Disparador **Tasa de dosis por encima del fondo**: una medición validada o pendiente supera el fondo de la baliza en
  el margen elegido (+20, +40, +100 o +200 nSv/h). Se activa una vez al superarlo; el margen sigue alcanzado mientras
  la tasa no baje 10 nSv/h por debajo. +40 nSv/h es el umbral del mapa de la ASNR. Variables: nombre de la baliza,
  tasa de dosis, fondo, exceso, hora de la medición.
- Disparador **Tasa de dosis de nuevo normal**: tras un exceso, la tasa vuelve a estar a menos de 10 nSv/h del fondo.
- Acción **Obtener la tasa de dosis de una baliza**: los últimos valores y una frase lista (`summary`) para una
  notificación.

Los dispositivos también dan sus valores a las condiciones de escena habituales.

## Ejemplos de escenas

- Avisarme cuando la tasa supere el fondo en 40 nSv/h: disparador «Tasa de dosis por encima del fondo», margen
  +40 nSv/h, luego «Obtener la tasa de dosis de una baliza» y una notificación con su resumen.
- Un informe semanal: una escena programada, «Obtener la tasa de dosis de una baliza», y un mensaje con el resumen.

## Solución de problemas

- **«Ninguna baliza»**: indique la ubicación de una casa (Ajustes → Casas) o escriba una baliza en la configuración.
- **«Balizas desconocidas»**: no se encontró el número o el nombre; use el botón de búsqueda y copie el número.
- **«El mapa Téléray no responde»**: las mediciones se vuelven a leer cada 10 minutos.
- **«Sin medición reciente»**: la baliza no ha publicado nada desde hace 2 horas (mantenimiento, transmisión). Los
  valores vuelven con su siguiente medición.

## Límites

- La integración lee el servidor del mapa público Téléray, que no tiene una API documentada: puede cambiar sin previo
  aviso.
- Las mediciones llegan de 20 a 40 minutos después de tomarse; una petición por baliza cada 10 minutos, la lista de
  balizas una vez al día.
- 5 balizas como máximo.
- Los nombres de las funciones se fijan al añadir el dispositivo; cambiar el idioma después no los renombra.
