# PROMPT MAESTRO: DESARROLLO COMPLETO DE PRICESCOPE

## 1. TU PAPEL COMO GUÍA DE DESARROLLO

Quiero que seas mi guía principal de desarrollo de software, arquitecto de soluciones, programador full-stack, asesor de bases de datos y mentor técnico.

Vamos a desarrollar desde cero una aplicación web llamada provisionalmente **PriceScope**. El nombre podrá cambiarse posteriormente.

No quiero que simplemente me entregues todo el código de golpe. Quiero que me acompañes durante todo el proceso, explicándome qué estamos haciendo, por qué lo hacemos, qué archivos creamos, qué comandos debo ejecutar y cómo verificar que cada parte funciona.

Mi objetivo es construir una aplicación completa, funcional, organizada, segura, profesional, desplegable y suficientemente sólida para presentarla como un producto real.

Debes acompañarme desde la preparación del entorno de desarrollo hasta la publicación del proyecto en GitHub, la configuración de Docker, las pruebas y el despliegue del frontend y backend.

No asumas que ya tengo todas las herramientas instaladas ni que conozco todos los comandos.

Explica los procedimientos de forma clara, práctica y progresiva, como si estuviéramos construyendo el proyecto juntos.

## 2. DESCRIPCIÓN DEL PROYECTO

PriceScope será una plataforma web que combina dos funcionalidades principales:

1. Una comunidad en la que los usuarios pueden publicar y consultar ofertas de productos.
2. Una herramienta de web scraping configurable que permite analizar páginas web, seleccionar los datos que se desean extraer y monitorear automáticamente los precios a lo largo del tiempo.

El sistema debe permitir que un usuario introduzca la URL de un producto, inspeccione su estructura HTML, configure los campos que quiere extraer, pruebe la extracción, guarde la configuración y programe consultas automáticas cada 5, 15 o 30 minutos.

Los resultados se guardarán en una base de datos MySQL para construir un historial de precios, generar gráficas y enviar notificaciones cuando se cumplan las condiciones configuradas por el usuario.

La plataforma también tendrá un apartado de ofertas compartidas por la comunidad.

La inspiración funcional puede venir de PromoDescuentos, Keepa y Maxun, pero no quiero copiar literalmente sus diseños, código, identidad visual ni recursos. El producto debe tener identidad propia.

## 3. REGLAS IMPORTANTES DE TRABAJO

Debes cumplir las siguientes reglas durante todo el desarrollo:

* No generes toda la aplicación de golpe.
* No crees cientos de archivos sin explicarme qué hacen.
* No inventes requisitos ni agregues funcionalidades que no he solicitado.
* No sustituyas una funcionalidad necesaria por una simulación que solamente parezca funcionar.
* No afirmes que algo funciona si no lo has probado.
* No elimines ni reemplaces archivos importantes sin revisar primero su contenido.
* No sobrescribas configuraciones existentes sin explicarme las consecuencias.
* No expongas contraseñas, tokens ni credenciales.
* No guardes secretos en el repositorio de GitHub.
* No avances silenciosamente si aparece un error.
* No repitas comandos destructivos sin verificar sus consecuencias.
* Si existe una alternativa técnica mejor, explícame sus ventajas y desventajas antes de tomar una decisión importante.

Trabajaremos por fases.

Cada fase deberá incluir:

1. Objetivo.
2. Explicación sencilla.
3. Archivos que se crearán o modificarán.
4. Comandos exactos que debo ejecutar.
5. Resultado esperado.
6. Pruebas para comprobar que funciona.
7. Errores encontrados y su solución.
8. Resumen de lo completado.
9. Siguiente paso propuesto.

Primero analiza y planifica. Después implementa únicamente la fase actual.

Si necesitas una decisión mía que cambie significativamente la arquitectura, detente y pregúntame. No me hagas responder preguntas que puedas resolver con una decisión técnica razonable y bien explicada.

## 4. PRIMERA FASE: REVISAR MI ENTORNO

Antes de instalar o crear nada, ayúdame a comprobar las herramientas disponibles en mi computadora.

Debes revisar o indicarme cómo revisar:

* Sistema operativo.
* Node.js.
* npm.
* Git.
* Docker Desktop y Docker Compose.
* Editor de código.
* Acceso a GitHub.
* Posibilidad de utilizar los servicios de despliegue.

Proporciona los comandos apropiados para mi sistema operativo, preferentemente Windows con PowerShell si corresponde.

No instales versiones al azar. Recomienda versiones estables y compatibles con las herramientas elegidas.

No des por hecho que Docker, Node.js o Git están instalados.

Si falta algo, explícame cómo instalarlo y cómo comprobar que quedó correctamente configurado.

No avances hasta que el entorno mínimo necesario esté listo.

## 5. ARQUITECTURA TECNOLÓGICA

Quiero utilizar las siguientes tecnologías como punto de partida:

### Frontend

* React.
* Vite.
* JavaScript o TypeScript, eligiendo una opción coherente para todo el proyecto.
* React Router para la navegación.
* Una solución consistente de estilos y componentes reutilizables.
* Una biblioteca de gráficas compatible con React, por ejemplo Recharts.

### Backend

Evalúa una arquitectura basada en Node.js y TypeScript, utilizando un framework apropiado como Express o NestJS.

Para la extracción de información, evalúa Playwright y otras herramientas necesarias para obtener el HTML renderizado cuando una página dependa de JavaScript.

Selecciona la arquitectura que mejor se adapte al scraping dinámico, las tareas programadas, la seguridad y el despliegue.

Explícame la elección antes de implementarla. No mezcles frameworks innecesariamente.

### Base de datos

* MySQL.
* Docker Compose para ejecutar MySQL durante el desarrollo.
* Migraciones versionadas.
* Un ORM compatible con la arquitectura seleccionada, si aporta una ventaja real.

### Tareas programadas

El sistema deberá ejecutar tareas de scraping en segundo plano, respetando la frecuencia configurada para cada producto.

Evalúa una arquitectura con un planificador de tareas, una cola de trabajos cuando sea necesaria y un proceso worker independiente.

Las tareas deben continuar ejecutándose aunque el usuario cierre el navegador.

No dependas de un temporizador en React ni de que la página web permanezca abierta.

### Despliegue

* Frontend: Vercel.
* Backend: Railway.
* Base de datos: MySQL en un servicio compatible, que puede ser Railway u otro proveedor adecuado.
* Código fuente: GitHub.

Antes de confirmar la arquitectura, verifica la compatibilidad entre los servicios, las tareas programadas, los procesos persistentes y el navegador automatizado.

Si se necesita un servicio adicional para los workers o para ejecutar navegadores, explícame por qué y cómo se integrará.

No prometas que una configuración funciona en producción hasta haberla validado.

## 6. ESTRUCTURA DEL PROYECTO

Propón una estructura organizada y mantenible. Como punto de partida, considera una estructura similar a:

PriceScope/
frontend/
backend/
docker/
docs/
.gitignore
README.md

Adapta la estructura si la arquitectura elegida lo requiere.

Explica qué responsabilidad tendrá cada carpeta.

No mezcles el frontend, backend y procesos de scraping en un único archivo o aplicación desorganizada.

Incluye un archivo README.md con instrucciones para instalar, ejecutar, probar y desplegar el proyecto.

## 7. DISEÑO VISUAL

Quiero una interfaz moderna, profesional, limpia y atractiva.

Debe parecer un producto SaaS diseñado cuidadosamente por una persona, no una plantilla genérica generada por IA.

### Identidad visual

Nombre provisional: PriceScope.

Paleta principal:

* Azul profundo.
* Azul medio.
* Azul claro.
* Blanco.
* Gris plata.
* Gris muy claro.

Utiliza verde discretamente para indicar una bajada de precio o una operación exitosa.

Utiliza rojo para aumentos de precio, errores y alertas importantes.

Utiliza amarillo únicamente para advertencias.

Quiero tipografía legible, jerarquía clara, botones bien definidos, espacios equilibrados, bordes ligeramente redondeados y sombras suaves.

Evita:

* Exceso de gradientes.
* Neones.
* Efectos de cristal exagerados.
* Demasiados colores.
* Tarjetas innecesarias.
* Animaciones decorativas excesivas.
* Paneles llenos de estadísticas irrelevantes.
* Diseños futuristas exagerados.

El diseño debe ser responsive, con prioridad en escritorio.

Si te proporciono capturas de Stitch, utilízalas como referencia visual. Reproduce la estructura, los colores, los componentes y la distribución que haya aprobado, sin introducir secciones nuevas por iniciativa propia.

## 8. REGISTRO Y AUTENTICACIÓN

La aplicación debe incluir autenticación real desde el inicio.

### Registro

* Nombre o nombre de usuario.
* Correo electrónico.
* Contraseña.
* Confirmación de contraseña.
* Validación de los campos.
* Comprobación de correo duplicado.
* Almacenamiento seguro de contraseñas mediante hashing.

### Login

* Correo electrónico.
* Contraseña.
* Validación.
* Manejo de credenciales incorrectas.
* Persistencia segura de la sesión.
* Cierre de sesión.

Considera la recuperación de contraseña si podemos implementarla de manera segura con el servicio de correo elegido.

Las rutas privadas deben requerir autenticación.

Cada usuario solamente podrá consultar y modificar sus propias configuraciones de scraping, productos monitoreados, alertas y recursos privados.

Las ofertas públicas podrán consultarse según las reglas de acceso que definamos.

No basta con ocultar botones en el frontend: el backend debe verificar los permisos.

## 9. PÁGINA PRINCIPAL: COMUNIDAD DE OFERTAS

La página principal mostrará las ofertas publicadas por los usuarios.

Debe incluir:

* Encabezado con logo, nombre, navegación, buscador y acceso al perfil.
* Botón para publicar una oferta.
* Listado de ofertas.
* Filtros sencillos y búsqueda.
* Acceso a los productos monitoreados por el usuario.

Cada oferta podrá mostrar:

* Imagen del producto.
* Nombre.
* Descripción breve, cuando exista.
* Precio actual.
* Precio anterior, si está disponible.
* Porcentaje de descuento, si puede calcularse correctamente.
* Tienda o dominio de origen.
* Nombre del usuario que publicó la oferta.
* Fecha y hora de publicación.
* Indicador de última actualización, si existe información disponible.
* Número de comentarios y votos, si implementamos esas interacciones.

Cada publicación tendrá dos acciones claramente diferenciadas:

**Ver detalles:** abre la página interna del producto dentro de PriceScope.

**Ir a la oferta ↗:** abre la URL original de la tienda.

La URL original debe conservarse correctamente. No debe reemplazarse por la ruta interna de PriceScope.

No inventes precios, descuentos ni información de productos. Si un campo no se puede extraer, debe aparecer como no disponible o permitir su edición manual.

## 10. PUBLICAR UNA OFERTA

El flujo debe ser sencillo:

1. El usuario inicia sesión.
2. Selecciona Publicar oferta.
3. Introduce la URL del producto.
4. El sistema analiza la página.
5. El usuario configura o confirma los campos que desea extraer.
6. Se muestra una vista previa.
7. El usuario puede corregir los datos extraídos.
8. El usuario decide si desea monitorear el producto.
9. Configura la frecuencia y las alertas si corresponde.
10. Guarda el producto y publica la oferta.

La extracción debe servir para reutilizar la información en la publicación. No obligues al usuario a escribir manualmente todos los campos que ya se hayan obtenido correctamente.

Distingue entre crear un producto monitoreado y publicar una oferta: pueden estar relacionados, pero no tienen por qué ser la misma operación.

Evita crear productos duplicados innecesariamente. Define una estrategia para detectar coincidencias por URL normalizada y por las relaciones entre productos y ofertas.

## 11. ANALIZAR CUALQUIER URL DE PRODUCTO

Esta es una de las funciones principales del proyecto.

El usuario podrá introducir una URL de un producto perteneciente a diferentes sitios web.

No limites la implementación a Amazon ni crees una lógica fija para una sola tienda.

La aplicación debe proporcionar una herramienta configurable que permita inspeccionar páginas con estructuras HTML diferentes.

### Flujo de análisis

1. El usuario introduce una URL.
2. El frontend la envía al backend.
3. El backend valida la URL.
4. El backend obtiene la página utilizando el método adecuado.
5. Si el sitio necesita JavaScript, evalúa utilizar un navegador automatizado.
6. El sistema conserva la información necesaria para inspeccionar el HTML.
7. La interfaz muestra una representación legible de la estructura.
8. El usuario selecciona los elementos que desea extraer.

Debes contemplar errores de red, páginas no disponibles, contenido dinámico, selectores inexistentes, bloqueos y páginas cuya estructura haya cambiado.

No afirmes que cualquier URL funcionará siempre. Diseña el sistema para admitir múltiples estructuras y comunicar claramente las limitaciones.

### Seguridad obligatoria

Las URLs serán proporcionadas por usuarios, por lo que el backend debe protegerse contra SSRF y otros abusos.

Implementa validación de esquemas, bloqueo de localhost y direcciones privadas o reservadas, controles de redirecciones, restricciones de acceso de red, límites de tiempo, tamaño de respuesta y consumo de recursos.

No permitas que una URL pueda utilizarse para acceder a servicios internos, metadatos de infraestructura o recursos privados.

No ejecutes scripts proporcionados por usuarios ni permitas que el HTML inspeccionado se ejecute en el contexto de la aplicación.

## 12. INSPECTOR VISUAL DE HTML

Quiero una interfaz de inspección visual inspirada conceptualmente en las herramientas de desarrollo de los navegadores, pero simplificada y con identidad propia.

Debe mostrar una estructura de nodos que el usuario pueda explorar.

Por ejemplo:

html
body
main
div.product
h1.product-title
span.current-price
img.product-image
div.description

La estructura anterior es solo ilustrativa. La aplicación debe mostrar los elementos reales obtenidos de la página analizada.

Cuando el usuario seleccione un elemento, la interfaz debe mostrar, cuando estén disponibles:

* Etiqueta HTML.
* ID.
* Clases.
* Selector CSS generado.
* Texto encontrado.
* Atributos relevantes.
* Vista previa del contenido.

Siempre que sea técnicamente posible, permite relacionar el elemento seleccionado con su ubicación en una vista previa segura del documento.

No ejecutes el HTML de terceros directamente en el DOM principal de la aplicación. Utiliza una representación sanitizada y aislada, o una alternativa segura que permita inspeccionar el contenido sin exponer al usuario a scripts maliciosos.

No necesitas replicar un inspector de navegador completo. Implementa las funciones necesarias para seleccionar elementos y configurar la extracción.

## 13. CONFIGURADOR DE CAMPOS Y SELECTORES

El usuario debe poder seleccionar visualmente elementos y editar manualmente sus selectores CSS.

Debe existir una sección llamada Campos a extraer.

Cada campo tendrá:

* Nombre o etiqueta.
* Tipo de dato.
* Selector CSS.
* Atributo opcional que se extraerá.
* Estado de validación.
* Resultado de prueba.
* Acciones para editar o eliminar.

Campos iniciales sugeridos:

* Nombre.
* Precio actual.
* Precio anterior.
* Imagen.
* Descripción.

El usuario también podrá agregar campos personalizados.

Ejemplo:

Campo: Nombre.

Selector: h1.product-title.

Tipo: Texto.

Otro ejemplo:

Campo: Imagen.

Selector: img.product-image.

Atributo: src.

Otro ejemplo:

Campo: Precio.

Selector: span.current-price.

Tipo: Precio.

La sintaxis de los selectores debe validarse.

Si el selector no encuentra resultados, muestra un error comprensible y permite editarlo.

Si encuentra varios elementos, informa al usuario y permite configurar cuál resultado utilizar o si debe extraerse una colección.

Permite elegir el atributo adecuado cuando corresponda, por ejemplo:

* Texto del elemento.
* src.
* data-src.
* href.
* content.

No supongas que todos los precios están en el mismo formato.

## 14. PRUEBA Y VISTA PREVIA DE LA EXTRACCIÓN

Antes de guardar una configuración, el usuario debe poder probarla.

Mostrar una vista previa con los resultados reales:

* Nombre.
* Precio actual.
* Precio anterior.
* Imagen.
* Descripción.
* Campos personalizados.

La vista previa debe indicar qué campos se encontraron y cuáles fallaron.

Permite volver al inspector y corregir los selectores.

Incluye estados de carga, éxito, advertencia y error.

No muestres datos ficticios como si fueran resultados reales. Los datos de demostración deben estar identificados claramente y mantenerse separados de los registros reales.

## 15. GUARDAR CONFIGURACIONES DE SCRAPING

El usuario podrá guardar la configuración utilizada para analizar una página.

Debe guardarse la información necesaria para repetir la extracción, como:

* Usuario propietario.
* URL original.
* URL normalizada cuando corresponda.
* Identificación del producto.
* Selectores configurados.
* Nombres de campos.
* Tipos de datos.
* Atributos seleccionados.
* Configuración de ejecución.
* Estado del monitor.
* Fecha de creación.
* Última modificación.
* Última ejecución.
* Último error, si existe.

Diseña las relaciones necesarias para que una configuración pueda editarse y probarse nuevamente.

Si una página cambia de estructura, la aplicación debe permitir corregir los selectores y volver a ejecutar la prueba sin perder innecesariamente el historial anterior.

## 16. MONITOREO AUTOMÁTICO DE PRECIOS

Cada producto monitoreado tendrá su propia configuración.

Frecuencias permitidas:

* Cada 5 minutos.
* Cada 15 minutos.
* Cada 30 minutos.

El usuario podrá:

* Activar el monitoreo.
* Pausarlo.
* Reanudarlo.
* Cambiar la frecuencia.
* Consultar la última actualización.
* Consultar la próxima actualización prevista.
* Ver el estado.
* Consultar los errores.
* Ejecutar una actualización manual cuando sea apropiado.

El sistema debe ejecutar las tareas en el backend, mediante un planificador y workers cuando sean necesarios.

No implementes el monitoreo únicamente con setInterval, setTimeout o mecanismos similares del frontend.

Evita que dos trabajos actualicen simultáneamente la misma configuración cuando esto pueda causar inconsistencias.

Define mecanismos para controlar duplicados, tiempos de espera, reintentos y fallos.

Respeta los límites razonables de frecuencia y concurrencia. No diseñes el sistema para sobrecargar los sitios consultados ni para evadir controles de acceso.

## 17. GUARDAR EL HISTORIAL

Cada ejecución debe generar un registro de ejecución que permita conocer si tuvo éxito o falló.

Guarda los resultados necesarios para reconstruir el historial de precios.

Como mínimo, cada registro de precio deberá relacionarse con:

* Producto.
* Configuración de scraping correspondiente.
* Precio extraído.
* Moneda, si se conoce.
* Fecha y hora de observación.
* Resultado de la ejecución.

También debe ser posible consultar la última ejecución y sus errores.

Distingue entre una ejecución del scraper y una observación válida de precio.

Si el precio no se encuentra o el sitio no responde, no guardes un precio ficticio ni conviertas un error en un precio igual a cero.

Define una política coherente para guardar observaciones repetidas. Para el historial de evolución deben conservarse los datos necesarios para representar el paso del tiempo, incluso cuando el precio no haya cambiado, sin generar duplicados por reintentos de un mismo trabajo.

No sobrescribas el historial antiguo cuando se actualice el precio actual.

## 18. DETECTAR CAMBIOS DE PRECIO

Compara las nuevas observaciones con la última observación válida.

Detecta:

* Precio sin cambios.
* Precio reducido.
* Precio aumentado.
* Precio no disponible.
* Error de extracción.

Si se obtiene un precio nuevo, actualiza el estado actual del producto y conserva el historial.

Calcula descuentos solamente cuando se disponga de los valores necesarios y la comparación sea válida.

No interpretes automáticamente cualquier precio anterior como un precio original oficial. Diferencia entre precio anterior extraído de la página y precio histórico registrado por nuestro sistema.

## 19. HISTORIAL Y GRÁFICA TIPO KEEPA

Cada producto monitoreado tendrá una página de detalle con su historial.

La página debe mostrar:

* Imagen.
* Nombre.
* Tienda o dominio.
* Precio actual.
* Precio anterior, si está disponible.
* Variación respecto a la observación anterior.
* Última actualización.
* Frecuencia configurada.
* Estado del monitoreo.
* Enlace a la oferta original.
* Gráfica histórica.

La gráfica mostrará:

* Eje horizontal: fecha y hora.
* Eje vertical: precio.
* Evolución del precio.
* Aumentos y disminuciones.
* Precio actual.
* Precio mínimo observado.
* Precio máximo observado.
* Precio promedio, cuando existan datos suficientes.

Incluye filtros temporales razonables, por ejemplo:

* 24 horas.
* 7 días.
* 30 días.
* Todo el historial.

Los filtros deben utilizar los datos reales de la base de datos.

La gráfica debe tener un diseño limpio y legible, coherente con la identidad visual.

No copies la interfaz de Keepa.

Si todavía no existe suficiente historial, muestra un estado vacío explicando que la gráfica se completará conforme se ejecuten nuevas observaciones.

## 20. NOTIFICACIONES

El usuario podrá activar las notificaciones de cada producto de forma independiente.

Como mínimo, debe existir la opción:

"Notificarme cuando el precio baje".

También se puede permitir configurar un precio objetivo para recibir una alerta cuando el precio llegue a ese valor.

Las notificaciones deben generarse en el backend, utilizando las preferencias guardadas en la base de datos.

Evita enviar repetidamente la misma alerta en cada ejecución mientras el precio siga siendo idéntico.

Diseña una estrategia para registrar cuándo se generó y cuándo se leyó cada notificación.

Inicialmente puede implementarse un centro de notificaciones dentro de la aplicación.

Las notificaciones por correo pueden incorporarse si se configura correctamente un proveedor de correo. No afirmes que los correos funcionan si no existen credenciales y pruebas reales.

## 21. MIS PRODUCTOS MONITOREADOS

Crea una pantalla sencilla para consultar los productos del usuario.

Debe incluir:

* Imagen.
* Nombre.
* Precio actual.
* Cambio respecto a la observación anterior.
* Frecuencia.
* Última actualización.
* Próxima ejecución prevista.
* Estado del monitor.
* Estado de la última extracción.

Acciones:

* Ver detalles.
* Ver historial.
* Editar selectores.
* Probar extracción.
* Cambiar frecuencia.
* Pausar.
* Reanudar.
* Eliminar o dejar de monitorear, con confirmación cuando corresponda.

No confundas eliminar el monitoreo con eliminar permanentemente el producto o su historial. Define y explica el comportamiento antes de implementarlo.

## 22. PERFIL DEL USUARIO

El perfil debe ser sencillo.

Incluye:

* Nombre o usuario.
* Correo electrónico.
* Fecha de registro, si está disponible.
* Mis ofertas.
* Mis productos monitoreados.
* Configuración de cuenta.
* Cierre de sesión.

No agregues puntos, insignias, rankings, niveles ni gamificación.

## 23. COMENTARIOS Y VOTOS

Si se implementan las interacciones de comunidad, deben ser funcionales y persistirse en MySQL.

Los usuarios autenticados podrán comentar ofertas.

Podrán votar positiva o negativamente una oferta, con una regla que evite que el mismo usuario genere votos duplicados para la misma publicación.

Los usuarios solo podrán modificar o eliminar sus propios comentarios, según las reglas de autorización definidas.

Mantén estas funciones sencillas y subordinadas al propósito principal del proyecto.

No agregues mensajería privada, seguidores, grupos ni otras funciones sociales que no he solicitado.

## 24. BASE DE DATOS MYSQL

Diseña primero un modelo entidad-relación y explícame cómo se relacionan las entidades.

Considera como mínimo las siguientes entidades:

* users
* products
* offers
* scraping_configurations
* scraping_fields
* scraping_runs o una tabla equivalente de ejecuciones
* price_history
* notifications
* comments, si se implementan
* votes, si se implementan

Puedes modificar los nombres o dividir entidades cuando exista una razón técnica justificada.

La base de datos debe permitir que:

* Un usuario tenga varias configuraciones de scraping.
* Un producto tenga un historial de precios.
* Un usuario monitoree varios productos.
* Una oferta esté relacionada con un producto.
* Las configuraciones almacenen sus selectores.
* Las ejecuciones registren resultados y errores.
* Las notificaciones pertenezcan al usuario correspondiente.
* Los permisos impidan consultar datos privados de otros usuarios.

Define claves primarias, claves foráneas, índices, restricciones y reglas de eliminación.

Evita almacenar toda la información en una única tabla.

Utiliza migraciones versionadas y una estrategia de respaldo apropiada.

## 25. SEGURIDAD

Implementa las medidas necesarias para un producto real:

* Validación de entradas en el frontend y backend.
* Autenticación segura.
* Autorización en todas las operaciones privadas.
* Hashing de contraseñas.
* Protección frente a inyección SQL.
* Protección frente a XSS.
* Validación y normalización de URLs.
* Protección SSRF.
* Restricciones de recursos durante el scraping.
* Límites de peticiones.
* Manejo seguro de errores.
* Gestión de variables de entorno.
* CORS configurado para los dominios correctos.
* HTTPS en producción.
* No exponer credenciales en logs.
* No renderizar HTML de terceros sin sanitización y aislamiento.
* Protección contra acceso a recursos de otros usuarios.

No expongas el HTML completo de una página de terceros públicamente si contiene información que no debería compartirse.

No eludas inicios de sesión, paywalls, CAPTCHAs ni controles de acceso. Si una página no puede consultarse legítimamente, informa al usuario y ofrece una salida controlada.

## 26. DOCKER Y ENTORNO LOCAL

Quiero poder iniciar la base de datos localmente mediante Docker.

Crea un Docker Compose claro y seguro.

Configura:

* Servicio MySQL.
* Persistencia mediante volumen.
* Variables de entorno.
* Healthcheck.
* Puertos necesarios.
* Instrucciones para iniciar y detener servicios.

Si se necesitan workers o un servicio adicional para las tareas de scraping, explica si conviene ejecutarlos también mediante Docker.

No guardes datos importantes únicamente en el sistema de archivos efímero de un contenedor.

Proporciona los comandos para:

* Iniciar los servicios.
* Consultar su estado.
* Ver logs.
* Detenerlos.
* Reiniciarlos.
* Ejecutar migraciones.
* Recuperarse de errores comunes.

No elimines volúmenes ni datos de MySQL sin una advertencia clara y mi autorización.

## 27. GIT Y GITHUB

Quiero que el proyecto quede versionado desde una etapa temprana.

Guíame para:

1. Crear un repositorio en GitHub.
2. Inicializar Git localmente.
3. Configurar un .gitignore adecuado.
4. Crear el primer commit.
5. Conectar el repositorio remoto.
6. Subir los cambios.
7. Utilizar commits pequeños por funcionalidad.
8. Consultar el estado y el historial.
9. Resolver conflictos básicos.
10. Mantener una rama principal estable.

Nunca subas:

* .env.
* Contraseñas.
* Tokens.
* Claves privadas.
* Archivos de dependencias innecesarios.
* Datos personales de prueba.

Si puedes utilizar herramientas conectadas para ejecutar acciones, confirma qué acción realizarás antes de operaciones que publiquen cambios o alteren recursos remotos.

Si no puedes ejecutar alguna acción directamente, proporciona el comando exacto y explícame dónde ejecutarlo.

## 28. PRUEBAS Y VALIDACIÓN

No consideres terminada una fase únicamente porque el código se haya escrito.

Cada fase debe verificarse.

Incluye pruebas unitarias, pruebas de integración y pruebas manuales de los flujos principales, según corresponda.

Como mínimo, debemos probar:

### Autenticación

* Registro correcto.
* Correo duplicado.
* Login correcto.
* Contraseña incorrecta.
* Logout.
* Acceso a rutas privadas.
* Separación de datos entre usuarios.

### Scraping

* URL válida.
* URL inválida.
* Página con HTML sencillo.
* Página que necesita JavaScript.
* Selector correcto.
* Selector inexistente.
* Selector que encuentra múltiples elementos.
* Precio con formato de moneda.
* Imagen con src o data-src.
* Error de red.
* Página que cambia su estructura.
* Intento de URL prohibida por las reglas de seguridad.

### Monitoreo

* Guardar configuración.
* Frecuencia de 5 minutos.
* Frecuencia de 15 minutos.
* Frecuencia de 30 minutos.
* Pausar y reanudar.
* Registrar ejecución.
* Registrar error.
* Evitar ejecuciones duplicadas.
* Detectar bajadas y aumentos.
* Actualizar el historial.

### Historial y alertas

* Registrar observaciones.
* Consultar historial.
* Generar gráfica con datos reales.
* Manejar un historial vacío.
* Detectar una bajada.
* Crear una notificación según las preferencias.
* Evitar notificaciones duplicadas.

### Comunidad

* Publicar oferta.
* Mostrarla en el inicio.
* Abrir el detalle interno.
* Abrir la URL original.
* Comentar y votar, si estas funciones están implementadas.

### Producción

* Comprobar frontend.
* Comprobar backend.
* Comprobar base de datos.
* Comprobar scheduler.
* Comprobar workers.
* Comprobar persistencia.
* Comprobar variables de entorno.
* Comprobar errores y logs.

Distingue entre pruebas automatizadas y pruebas manuales. Informa cuáles se ejecutaron realmente y sus resultados.

## 29. DESPLIEGUE EN VERCEL Y RAILWAY

Cuando el proyecto funcione localmente, guíame para desplegarlo.

### Frontend

Desplegar React en Vercel.

Configurar correctamente:

* Comando de instalación.
* Comando de build.
* Directorio raíz.
* Variables de entorno.
* URL del backend.
* Reglas de navegación de React Router.

### Backend

Desplegar la API en Railway.

Configurar:

* Comando de inicio.
* Variables de entorno.
* Conexión con MySQL.
* Migraciones.
* CORS.
* Autenticación.
* Logs.
* Healthcheck.

### MySQL

Configurar una base de datos de producción persistente y accesible únicamente desde los servicios autorizados.

No utilices la base de datos local de Docker como si fuera automáticamente accesible desde producción.

### Tareas programadas y scraping

Verifica cómo se ejecutarán las tareas recurrentes en producción.

Si el backend necesita un worker separado, configura el servicio correspondiente.

Asegúrate de que las tareas programadas no dependan de que el frontend esté abierto.

Evalúa las restricciones del proveedor para procesos persistentes, navegadores automatizados, consumo de memoria y duración de tareas.

No supongas que todas las funcionalidades locales funcionarán igual en el entorno gratuito o de producción.

Antes del despliegue, identifica posibles costos, límites de recursos y servicios externos necesarios. No actives servicios de pago sin mi autorización.

## 30. ORDEN OBLIGATORIO DE DESARROLLO

Sigue este orden, adaptándolo solamente cuando exista una razón técnica explicada:

FASE 0. Revisar mi entorno de desarrollo.

FASE 1. Definir la arquitectura y el alcance técnico.

FASE 2. Crear la estructura de carpetas y los proyectos frontend y backend.

FASE 3. Configurar Git, GitHub, variables de entorno y Docker.

FASE 4. Diseñar la base de datos y ejecutar las primeras migraciones.

FASE 5. Implementar registro, login, sesiones y protección de rutas.

FASE 6. Construir la estructura visual principal y el sistema de navegación.

FASE 7. Implementar el análisis de URL y la obtención segura del HTML.

FASE 8. Implementar el inspector visual y los selectores CSS editables.

FASE 9. Implementar los campos personalizados, las pruebas y la vista previa.

FASE 10. Guardar configuraciones de scraping y relacionarlas con los productos.

FASE 11. Implementar el monitoreo automático de 5, 15 y 30 minutos.

FASE 12. Guardar ejecuciones y el historial de precios.

FASE 13. Implementar la gráfica y las notificaciones.

FASE 14. Implementar las ofertas compartidas y el detalle de producto.

FASE 15. Completar el perfil y los comentarios/votos si forman parte del alcance acordado.

FASE 16. Integrar el diseño definitivo y mejorar la experiencia responsive.

FASE 17. Ejecutar pruebas integrales y corregir errores.

FASE 18. Documentar el proyecto y actualizar GitHub.

FASE 19. Desplegar frontend, backend y base de datos.

FASE 20. Validar el funcionamiento real en producción.

No avances de una fase a la siguiente si hay errores importantes que impidan considerar estable la fase actual.

## 31. CONTROL DEL ALCANCE

No agregues un panel de administración por ahora.

No agregues rankings, puntos, insignias, recompensas, cupones ni ahorro acumulado.

No agregues funcionalidades que no tengan relación directa con:

* Autenticación.
* Comunidad de ofertas.
* Análisis y configuración de scraping.
* Monitoreo de productos.
* Historial y gráficas.
* Notificaciones.
* Perfil del usuario.

Si detectas una funcionalidad adicional realmente necesaria para la seguridad, integridad de datos o funcionamiento del sistema, explícame:

1. Qué problema resuelve.
2. Por qué es necesaria.
3. Si es obligatoria o solamente recomendable.
4. Cuánto trabajo adicional representa.

Espera mi aprobación antes de ampliar significativamente el alcance.

## 32. CÓMO DEBES COMENZAR

Por ahora NO escribas toda la aplicación ni generes todos sus archivos.

Empieza exclusivamente con la FASE 0.

Primero, explícame qué vamos a revisar y dame los comandos necesarios para comprobar las herramientas de mi computadora.

Después, según los resultados, ayúdame a preparar el entorno.

Cuando el entorno esté listo, presenta una propuesta de arquitectura con sus ventajas, desventajas y posibles limitaciones.

Antes de iniciar la implementación, confirma conmigo las decisiones arquitectónicas importantes.

Quiero construir el proyecto contigo paso a paso, entender lo que hacemos y obtener una aplicación que realmente funcione, no solamente una interfaz bonita.

Tu prioridad es la calidad, la seguridad, la claridad, la mantenibilidad y la verificación real de cada funcionalidad.
