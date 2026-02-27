# Etapa 1: Compilación
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["StockApi.csproj", "./"]
RUN dotnet restore "StockApi.csproj"
COPY . .
RUN dotnet build "StockApi.csproj" -c Release -o /app/build
RUN dotnet publish "StockApi.csproj" -c Release -o /app/publish

# Etapa 2: Entorno de Producción
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "StockApi.dll"]
