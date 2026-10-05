Tripo Studio Backup
====================

Userscript para Tampermonkey / Greasemonkey que permite escanear automáticamente los modelos disponibles en Tripo Studio y realizar una copia de seguridad de cada modelo en múltiples formatos.

El script añade un panel de control directamente dentro de Tripo Studio y automatiza el proceso completo de exportación.


CARACTERÍSTICAS
===============

- Escaneo automático de todos los modelos disponibles.
- Backup automático de todos los modelos encontrados.
- Exportación en múltiples formatos.
- Exportación de FBX con diferentes presets.
- Espera automática durante la generación de los archivos.
- Posibilidad de pausar o detener el backup.
- Registro detallado de las operaciones.
- Contador de modelos encontrados.
- Panel de control integrado en Tripo Studio.
- Los archivos se descargan mediante el sistema de exportación de Tripo Studio.
- Procesamiento secuencial para evitar lanzar varias exportaciones simultáneamente.


FORMATOS DE EXPORTACIÓN
=======================

Cada modelo se procesa en el siguiente orden:

1. USD
2. FBX - Blender
3. FBX - Mixamo
4. FBX - 3dsmax
5. OBJ
6. STL
7. GLB
8. 3MF


PRESETS FBX
===========

Los tres formatos FBX utilizan automáticamente su correspondiente preset:

Formato     Preset
----------- ----------------
FBX         Blender
FBX         Mixamo
FBX         3dsmax


CÓMO FUNCIONA
=============

El proceso completo se divide en dos fases.


1. ESCANEO
----------

El script analiza el panel de modelos de Tripo Studio y va recorriendo su contenido mediante scroll.

Los modelos encontrados se almacenan internamente y se evita duplicarlos mediante una huella identificativa.

El escaneo continúa hasta que se alcanza el final del panel y este permanece estable durante varias rondas.

Al finalizar, el panel muestra el número total de modelos encontrados.


2. BACKUP
---------

Una vez finalizado el escaneo, el usuario puede iniciar el backup.

Para cada modelo el script:

1. Abre el modelo.
2. Espera a que Tripo Studio termine de cargarlo.
3. Localiza el botón principal Export.
4. Abre el diálogo de exportación.
5. Selecciona el formato correspondiente.
6. Si el formato es FBX, selecciona automáticamente el preset correspondiente.
7. Ejecuta la exportación.
8. Espera a que Tripo genere el archivo.
9. Espera un margen adicional antes de continuar.
10. Pasa al siguiente formato.
11. Cuando termina todos los formatos, pasa al siguiente modelo.

El proceso es deliberadamente secuencial para evitar que varias exportaciones se ejecuten al mismo tiempo.


TIEMPOS DE EXPORTACIÓN
======================

Tripo Studio puede tardar aproximadamente un minuto en generar determinados formatos, especialmente OBJ y FBX.

Por este motivo, el script utiliza:

GENERATION_WAIT = 65000

Es decir, aproximadamente 65 segundos de espera después de iniciar una exportación.

Además, utiliza un margen adicional entre exportaciones:

NEXT_EXPORT_MARGIN = 15000

Esto añade otros 15 segundos antes de comenzar la siguiente exportación.

El objetivo es evitar que el siguiente export comience mientras Tripo todavía está generando o descargando el anterior.


PANEL DE CONTROL
================

El script añade un panel en la interfaz de Tripo Studio con controles para gestionar el proceso.


ESCANEAR MODELOS
----------------

Recorre el panel de modelos y obtiene todos los modelos disponibles.


INICIAR BACKUP
--------------

Comienza el proceso de backup utilizando todos los modelos encontrados.


PAUSAR
------

Solicita una pausa del proceso.

La pausa se aplica de forma segura entre operaciones para evitar interrumpir una exportación que ya esté en curso.


DETENER
-------

Detiene el proceso de backup.

También permite detener el escaneo mientras está en progreso.


COPIAR LOG
----------

Copia el registro de operaciones para poder guardarlo o compartirlo.


LIMPIAR LOG
-----------

Limpia el registro mostrado en el panel.


RESET
-----

Restablece el estado del panel.


INSTALACIÓN
===========

REQUISITOS
----------

Necesitas un gestor de userscripts compatible, por ejemplo:

- Tampermonkey
- Greasemonkey

También necesitas acceso a:

https://studio.tripo3d.ai/


INSTALACIÓN
-----------

1. Instala Tampermonkey o Greasemonkey.
2. Crea un nuevo userscript.
3. Copia el código del script.
4. Pégalo en el editor del userscript.
5. Guarda los cambios.
6. Abre Tripo Studio.
7. Accede al workspace de generación de modelos.

El script se ejecutará automáticamente en:

https://studio.tripo3d.ai/workspace/generate*


USO
===

PASO 1 - ABRIR TRIPO STUDIO
---------------------------

Accede al workspace de generación de Tripo Studio.


PASO 2 - ESCANEAR MODELOS
-------------------------

Pulsa:

Escanear modelos

Espera a que termine el escaneo.

El contador del panel indicará cuántos modelos se han encontrado.


PASO 3 - INICIAR BACKUP
-----------------------

Pulsa:

Iniciar backup

El script comenzará a procesar los modelos uno por uno.


PASO 4 - ESPERAR
----------------

No es necesario cambiar manualmente los formatos.

El script selecciona automáticamente:

USD
FBX / Blender
FBX / Mixamo
FBX / 3dsmax
OBJ
STL
GLB
3MF

y realiza las exportaciones en ese orden.


RESULTADO
=========

Para cada modelo se generan las exportaciones correspondientes.

Los sufijos utilizados por el script son:

USD
FBX_Blender
FBX_Mixamo
FBX_3dsmax
OBJ
STL
GLB
3MF

Por ejemplo:

<modelo>_USD
<modelo>_FBX_Blender
<modelo>_FBX_Mixamo
<modelo>_FBX_3dsmax
<modelo>_OBJ
<modelo>_STL
<modelo>_GLB
<modelo>_3MF

El nombre final depende también del sistema de nombres utilizado por Tripo Studio durante la descarga.


SEGURIDAD DEL PROCESO
=====================

El script no intenta descargar directamente los archivos desde una API externa.

La exportación se realiza utilizando el flujo normal de exportación de Tripo Studio.

El script automatiza la interfaz:

Modelo
  |
  v
Export
  |
  v
Format
  |
  v
Preset (si es FBX)
  |
  v
Export
  |
  v
Espera de generación
  |
  v
Siguiente formato

Esto permite mantener el proceso dentro del flujo normal de exportación de Tripo Studio.


ORDEN DEL PROCESO
=================

El backup completo sigue esta estructura:

MODELO 1
  |
  +-- USD
  |
  +-- FBX Blender
  |
  +-- FBX Mixamo
  |
  +-- FBX 3dsmax
  |
  +-- OBJ
  |
  +-- STL
  |
  +-- GLB
  |
  +-- 3MF
        |
        v
MODELO 2
  |
  +-- USD
  |
  +-- FBX Blender
  |
  +-- FBX Mixamo
  |
  +-- FBX 3dsmax
  |
  +-- OBJ
  |
  +-- STL
  |
  +-- GLB
  |
  +-- 3MF
        |
        v
      ...
        |
        v
MODELO N

El siguiente modelo no comienza hasta que se ha terminado el procesamiento del modelo anterior.


EJEMPLO DE LOG
==============

Durante la ejecución se muestra información similar a:

🚀 Iniciando backup de 801 modelos.

MODELO 1/801

Nombre: example-model

Export 1/8: USD
✓ Formato seleccionado: USD

Export 2/8: FBX_Blender
✓ Formato seleccionado: FBX
✓ Preset seleccionado: Blender

Export 3/8: FBX_Mixamo
✓ Formato seleccionado: FBX
✓ Preset seleccionado: Mixamo

Export 4/8: FBX_3dsmax
✓ Formato seleccionado: FBX
✓ Preset seleccionado: 3dsmax

Export 5/8: OBJ
✓ Formato seleccionado: OBJ

Export 6/8: STL
✓ Formato seleccionado: STL

Export 7/8: GLB
✓ Formato seleccionado: GLB

Export 8/8: 3MF
✓ Formato seleccionado: 3MF

✓ Modelo completado.


PAUSAR Y DETENER
================

PAUSAR
------

La pausa no cancela una exportación que ya haya comenzado.

El script termina la operación actual y, posteriormente, mantiene el proceso detenido hasta que se reanude.


DETENER
-------

La detención cancela el procesamiento posterior.

Esto permite detener un backup largo sin tener que cerrar Tripo Studio ni desactivar el userscript.


CONFIGURACIÓN
=============

Los tiempos principales pueden modificarse en el código:

const GENERATION_WAIT = 65000;
const NEXT_EXPORT_MARGIN = 15000;

Donde:

GENERATION_WAIT
---------------

Tiempo de espera después de iniciar una exportación.


NEXT_EXPORT_MARGIN
------------------

Margen adicional antes de comenzar la siguiente exportación.


CONFIGURACIÓN DEL ESCÁNER
-------------------------

El escaneo utiliza:

const SCAN_CONFIG = {
    scrollWait: 1200,
    maxRounds: 400,
    stableRounds: 8,
    logEvery: 10
};


PARÁMETROS DEL ESCÁNER
----------------------

Parámetro       Valor   Descripción
--------------- ------- ------------------------------------------
scrollWait      1200    Tiempo entre movimientos de scroll
maxRounds       400     Número máximo de rondas de escaneo
stableRounds    8       Rondas estables para terminar el escaneo
logEvery        10      Frecuencia de mensajes de progreso


PROBLEMAS CONOCIDOS
===================

El script depende de la estructura actual de la interfaz de Tripo Studio.

Si Tripo cambia:

- Los selectores del botón Export.
- El diálogo de exportación.
- El selector Format.
- Los elementos del desplegable.
- Los presets FBX.
- La estructura de las tarjetas de modelos.

puede ser necesario actualizar el script.

En caso de problemas, el log del panel es la información más útil para diagnosticar qué paso ha fallado.


RECOMENDACIONES
===============

Para backups grandes:

- Utiliza una conexión estable.
- Mantén Tripo Studio abierto.
- Evita utilizar la misma pestaña para otras tareas.
- No cambies manualmente de modelo mientras el backup está activo.
- No abras otros diálogos de exportación manualmente.
- Comprueba que el navegador permite las descargas automáticas del sitio.
- Si el backup contiene cientos de modelos, deja suficiente tiempo para que termine.


LICENCIA
========

Este proyecto se distribuye bajo la licencia que se indique en el repositorio.

Si no se especifica otra licencia, consulta los términos incluidos en el repositorio antes de redistribuir o modificar el proyecto.


DISCLAIMER
==========

Este proyecto es un userscript de automatización desarrollado para facilitar copias de seguridad mediante la interfaz web de Tripo Studio.

No es un producto oficial de Tripo ni está afiliado necesariamente con Tripo.

El funcionamiento depende de la interfaz y funcionalidades disponibles en Tripo Studio en el momento de utilizar el script.

Los usuarios son responsables de comprobar que el uso de la automatización y las copias realizadas cumplen las condiciones de servicio aplicables a su cuenta y contenido.


CONTRIBUCIONES
==============

Las mejoras, correcciones y sugerencias son bienvenidas.

Si encuentras un problema:

1. Comprueba el log del script.
2. Indica qué modelo estaba procesándose.
3. Indica qué formato estaba intentando exportar.
4. Incluye el mensaje de error completo.
5. Indica la versión del userscript utilizada.

Esto facilita la reproducción y corrección del problema.
