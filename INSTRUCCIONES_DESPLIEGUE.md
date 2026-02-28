# Guía de Despliegue en Producción (Docker) 🚀

Esta guía contiene los pasos exactos para tomar tu código fuente y encenderlo en tu **Máquina Virtual de Linux Ubuntu** de manera permanente, junto a su propia base de datos SQL Server.

## 1. Requisitos Previos en Ubuntu
Asegúrate de tener instalado Git y Docker en tu servidor Ubuntu.
Si no los tienes, ejecuta estos comandos en la terminal de tu Ubuntu:
```bash
sudo apt update
sudo apt install -y git
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker userId
```

## 2. Descargar el código en el Servidor
Entra por SSH a tu máquina virtual y clona este mismo repositorio (o cópialo vía SFTP).

## 3. Configurar Variables Sensibles (Opcional)
Por defecto, el archivo `docker-compose.yml` viene con contraseñas seguras sugeridas.
Si quieres cambiarlas, puedes crear un archivo `.env` en la raíz del proyecto (junto a `docker-compose.yml`) con esto:
```env
DB_PASSWORD=MiContrasenaUltrasS3gura!
JWT_SECRET=MiSuperClaveLargaYSeguraParaTokensJWT123!
```

## 4. ¡Encender Todo!
Ubícate en la raíz del proyecto (donde está el archivo `docker-compose.yml`) y ejecuta la magia prestando especial atención en colocar la palabra \`sudo\` adelante:

```bash
sudo docker compose up -d
```

### ¿Qué sucederá tras ejecutar ese comando?
1. Docker bajará la imagen oficial de **Microsoft SQL Server 2022**.
2. **Descargará SDK de .NET 10** y compilará todo tu backend, creando un mini-servidor en el puerto interno 8080. Al levantarse interactuará con tu SQL Server recién creado, **construirá todas sus tablas** (Productos, Egresos, Usuarios) sin que toques una sola línea de código.
3. **Descargará Node.js**, instalará los paquetes de React, compilará la versión hiper optimizada del Frontend. Luego meterá todo dentro de un servidor web veloz (NGINX) escuchando el **Puerto 80** público.

## 5. Acceder a tu Web
Simplemente entra desde el navegador a la **Dirección IP** de tu máquina Ubuntu (ejemplo `http://192.168.1.15`). Verás tu panel de inventario y ¡los datos nunca se borrarán incluso si reinicias Ubuntu!.
