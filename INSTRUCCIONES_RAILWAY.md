# Despliegue en Railway 🚂

El error que te apareció (`Railpack could not determine how to build the app`) ocurre porque tu repositorio es un **"Monorepo"** (tienes frontend, backend y database en la misma carpeta raíz). Railway intenta buscar el código en la raíz del proyecto y no sabe cuál de las carpetas compilar.

Para desplegar exitosamente tu **Backend (.NET)** y tu **Base de Datos (SQL Server)** en Railway, debes configurarlos como dos "Servicios" separados dentro de tu mismo Proyecto de Railway.

Aquí tienes el paso a paso exacto:

## 1. Desplegar la Base de Datos (SQL Server) 🗄️

Railway no tiene SQL Server como un botón predeterminado (tienen Postgres y MySQL), pero podemos montar la misma imagen de Docker que usamos en local:

1. En tu proyecto de Railway, haz clic en **New** -> **Docker Image**.
2. En la barra de búsqueda escribe: `mcr.microsoft.com/mssql/server:2022-latest` y dale Enter.
3. Una vez se agregue el servicio, haz clic en él y ve a la pestaña **Variables**. Agrega estas variables:
   - `ACCEPT_EULA` = `Y`
   - `MSSQL_SA_PASSWORD` = `Sup3rSecr3t!2026` *(o tu contraseña fuerte)*
   - `MSSQL_PID` = `Express`
4. Ve a la pestaña **Settings** (Ajustes) de ese mismo servicio.
5. Haz scroll hacia abajo hasta **Volumes** y haz clic en "Add Volume". Coloca la ruta: `/var/opt/mssql` (Esto evita que se borre tu stock si Railway se reinicia).
6. Haz clic en "Generate Domain" o anota el **Private Domain** que te dé Railway (algo como `marvelous-database.railway.internal`).

---

## 2. Desplegar el Backend (.NET API) ⚙️

Ahora vamos a desplegar tu código de C# para que se conecte a esa base de datos.

1. En tu proyecto de Railway, haz clic en **New** -> **GitHub Repo** y selecciona tu repositorio `stockload`.
2. Apenas se cree (y probablemente empiece a fallar de nuevo), haz clic en el servicio y ve a la pestaña **Settings**.
3. Busca la opción **Root Directory** (Directorio Raíz) y escribe exactamente: `/backend/StockApi`
   *(Esto le dirá a Railway que ignore el resto de carpetas y solo compile tu API C# usando el Dockerfile que creamos ahí dentro).*
4. Ve a la pestaña **Variables** de este servicio de la API y añade todas tus credenciales de producción:
   - `ASPNETCORE_ENVIRONMENT` = `Production`
   - `ConnectionStrings__DefaultConnection` = `Server=ACA_VA_EL_DOMINIO_DE_TU_BD;Database=StockDB;User Id=sa;Password=Sup3rSecr3t!2026;TrustServerCertificate=True;`
     *(Copia el Internal Domain que te dio el servicio de base de datos en el paso anterior y reemplázalo donde dice "ACA_VA_EL_DOMINIO_DE_TU_BD")*.
   - `CloudinarySettings__CloudName` = `dkvoct2ee`
   - `CloudinarySettings__ApiKey` = `382599797473274`
   - `CloudinarySettings__ApiSecret` = `pGZugOioF3TYZFytQqKkbMTa-yA`
   - `JwtSettings__Key` = `MchStockSuperSecretJwtKey123!AndMoreCharactersToMakeItSecure`
   - `JwtSettings__Issuer` = `MchStockAPI`
   - `JwtSettings__Audience` = `MchStockReactApp`
5. Vuelve a **Settings** y dale al botón de "Generate Domain". Esta será la URL de tu API para que el frontend se conecte (Ej: `stock-api-production.up.railway.app`).

Railway automáticamente detectará el `Dockerfile` que está dentro de `/backend/StockApi`, construirá tu API y la pondrá a funcionar. Y tal cual lo programamos, al prenderse se conectará a la BD y creará las tablas sola.
