# Manual de Usuario - Sistema de Gestión de Inventario (StockLoad)

## 1. Introducción
Bienvenido al Sistema de Gestión de Inventario. Esta plataforma ha sido diseñada para facilitar el control, seguimiento y administración del stock de su empresa de forma intuitiva, rápida y segura desde cualquier navegador web.

**En este manual aprenderá a:**
- Iniciar sesión en el sistema.
- Navegar por el inventario principal.
- Registrar nuevos productos (Ingresos).
- Registrar salidas de productos (Egresos).
- Administrar parámetros de los productos (Imágenes, Códigos de Barras, Fechas de Vencimiento).

*(Espacio para que agregues una Imagen de Portada / Logo de tu Software)*

---

## 2. Acceso al Sistema (Login)
Para ingresar al sistema, debe acceder a la dirección web proporcionada por el administrador.

1. Abra su navegador web (Google Chrome, Edge, Safari, etc.).
2. Ingrese a la URL del sistema (Ejemplo: `https://stockload.vercel.app`).
3. En la pantalla de **Iniciar Sesión**, introduzca sus credenciales:
   - **Correo electrónico:** (Ej. su_correo@empresa.com)
   - **Contraseña:** (Su contraseña asignada)
4. Haga clic en el botón de ingresar. Si los datos son correctos, accederá al panel principal.

*(Espacio para imagen: Captura de la pantalla de Login)*

---

## 3. Panel Principal (Dashboard)
Una vez iniciada la sesión, visualizará el **Dashboard o Pantalla Principal**, donde se encuentra el listado completo de todos los productos almacenados en su base de datos.

### Funciones de la tabla de inventario:
- **Paginación:** Si tiene muchos productos, el sistema los dividirá en múltiples páginas para asegurar que el sistema cargue de manera instantánea. Utilice los controles numéricos u flechas en la parte inferior para navegar entre las páginas.
- **Visualización Rápida:** Podrá ver de un vistazo el Código, Nombre, Categoría, Stock actual, Estado y Ubicación de cada ítem.
- **Acciones Rápidas:** Al final de la fila de cada producto encontrará opciones específicas para interactuar directamente con el artículo (como Editar o Eliminar el producto entero).

*(Espacio para imagen: Captura de la tabla principal de productos mostrando los registros)*

---

## 4. Gestión de Productos (Agregar Nuevo Artículo)
Para agregar un nuevo artículo al inventario, diríjase al botón de **"Nuevo Producto"** o **"Agregar"** situado en la interfaz principal.

Se abrirá un formulario con los siguientes campos a llenar:
- **Nombre:** Nombre identificatorio del artículo.
- **Descripción / Notas:** Detalles adicionales relevantes o características (Peso, Medidas, etc).
- **Categoría:** Selección de la familia de productos a la que pertenece.
- **Ubicación:** Estante, sector o depósito físico donde se encontrará esta mercancía.
- **Stock (Cantidad Inicial):** Las unidades que ingresan en este momento al inventario físico.
- **Fechas Relevantes:** Fecha de Ingreso y, en el caso de productos perecederos, Fecha de Vencimiento.
- **Precio y Costo:** Valor de adquisición y valor de venta al público.
- **Código de Barras:** Identificador numérico único del producto. **(Puede emplear un escáner/lectora física posicionando el cursor aquí y disparando el láser).**
- **Imagen del Producto:** Subida de imagen directa desde su dispositivo; la plataforma se encarga de resguardarla y optimizarla en la nube automáticamente.

Al finalizar, oprima el botón de **Guardar**. El producto se enlistará de manera inmediata.

*(Espacio para imagen: Captura del formulario de creación de producto rellenado con un ejemplo)*

---

## 5. Gestión de Egresos (Salidas de Stock)
Cuando un producto abandona físicamente el inventario (por una venta, merma, retiro para sucursal o vencimiento), es vital registrar este movimiento bajo la opción de **Egreso**.

1. Diríjase a la sección de **Egresos** de la aplicación.
2. Complete la petición de egreso con los siguientes datos esenciales:
   - **Selección de Producto:** Se le pedirá seleccionar y buscar cuál es el artículo a descargar.
   - **Motivo de Salida:** Razón de la disminución (Ej. "Venta Consumidor Final", "Producto Dañado - Baja").
   - **Cantidad a Retirar:** El volumen de unidades que abandonan el depósito.
   - **Fecha del Suceso:** Cuándo ocurrió este movimiento.
3. Presione el botón de confirmación de "Registrar Egreso".

El sistema, de manera inteligente e instantánea, restará matemáticamente las unidades del total del producto. 
**Nota: El sistema bloqueará la operación si se intenta egresar una cantidad superior al Stock Físico existente.**

*(Espacio para imagen: Captura de la pantalla o ventana modal de Registro de Egresos)*

---

## 6. Códigos de Barras y Agilidad
El sistema StockLoad está preparado para funcionar ágilmente de la mano con hardware de punto de venta como los escáneres láser.

- **Creación / Asignación:** Todo producto permite asimilar o autogenerar su código EAN13 o estándar. 
- **Búsqueda e Ingreso Automáticos:** Siempre que un cursor se encuentre en un campo que acepte búsqueda, podrá conectar su escáner USB, disparar a una etiqueta, y el sistema captará los 13 dígitos y emulará la orden de búsqueda inmediatamente.

*(Espacio para imagen: Captura de un producto que muestre su sección visual de Código de Barras generado)*

---

## 7. Edición y Eliminación de Inventario
- **Editar un Producto:** Si hubo un error en la carga (por ejemplo se anotó mal el precio o llegó un nuevo embarque y quiere actualizar detalles), pulse el ícono de **Editar (Lápiz)** contiguo al producto. Cámbielo en el formulario y oprima Actualizar.
- **Eliminación Definitiva:** Si un producto está discontinuado, presione el ícono de **Eliminar (Basurero)**. El software le pedirá confirmación de 2 pasos para prevenir accidentes graves y la pérdida de métricas.

*(Espacio para imagen: Captura de los botones de Acción de una fila particular)*

---

## 8. Cierre de Sesión Seguro
Para garantizar la confidencialidad de la información y la salud de sus inventarios, le recordamos cerrar su usuario del sistema apenas su turno laboral termine o comparta el equipo físico.
Busque dentro de las opciones principales su perfil o menú superior derecho y pulse en **"Cerrar Sesión"**. Volverá a la pantalla del inicio de credenciales de manera exitosa.

---

*(Fin del Manual).*
