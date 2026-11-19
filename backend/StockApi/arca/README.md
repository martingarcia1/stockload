# Certificados de ARCA (facturación electrónica)

Acá van el certificado y la clave privada de ARCA. **Nunca se suben a git**
(solo este README está versionado).

```
arca/
  homologacion/   ← pruebas (certificado de WSASS)
    empresa.key
    prueba.crt
  produccion/     ← facturas reales (Administración de Certificados Digitales)
    empresa.key
    empresa.crt
```

- El backend usa la carpeta del entorno configurado en `Arca:Entorno`
  (`appsettings.Local.json`) o `ARCA_ENTORNO` (`.env` en Docker). Por defecto: `homologacion`.
- Toma el primer `.crt` y el primer `.key` que encuentre en esa carpeta.
- La misma clave (`.key`) sirve para pruebas y producción.
- Para saber de qué entorno es un certificado:
  `openssl x509 -in archivo.crt -noout -issuer`
  (`Computadores Test` = pruebas, `Computadores` = producción).

Después de copiar los archivos, reiniciar el backend y en Facturación > Datos fiscales
tocar **Probar conexión**.

Guía completa: `backend/docs/facturacion-arca.md`.
