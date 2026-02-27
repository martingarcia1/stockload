# Etapa 1: Instalación de dependencias y Build con Node
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# En producción inyectamos la variable hacia el compilado
RUN npm run build

# Etapa 2: Servidor Web Nginx ultra-ligero
FROM nginx:alpine
# Copiamos la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copiamos los archivos compilados de React a la carpeta pública de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
