# Facturación electrónica con ARCA — flujo y paso a paso

Guía de cómo se armó la facturación electrónica (Factura C de monotributo) en el
sistema de gestión de CHOCOLATUC, escrita para poder repetirla en otro proyecto
(Node + Express en el backend, React en el frontend).

> No hay claves ni certificados en este documento. Nunca se suben a git.

---

## 1. Cómo funciona, en una página

```
Venta en gestión ──► botón "Facturar" ──► backend ──► ARCA
                                             │
            ┌────────────────────────────────┘
            ▼
  1. WSAA (acceso): se firma un pedido con el certificado de la
     contribuyente → ARCA devuelve token + sign (dura 12 horas).
  2. WSFEv1 (factura): FECompUltimoAutorizado → número siguiente
     FECAESolicitar → ARCA devuelve el CAE y su vencimiento.
            │
            ▼
  Se guarda la factura (con el CAE) ──► ticket 80 mm / PDF / WhatsApp,
                                        con el QR obligatorio.
```

- **WSAA** (`LoginCms`): autenticación. Se manda un XML (TRA) firmado en formato
  CMS/PKCS#7 con la clave privada y el certificado. ARCA devuelve `token` y
  `sign`, válidos 12 horas.
- **WSFEv1**: el servicio de factura electrónica. Con `token`, `sign` y CUIT se
  piden los CAE.
- **Dos entornos**: *homologación* (pruebas, sin validez fiscal) y *producción*.
  Cada uno con su certificado.

| Servicio | Homologación (pruebas) | Producción |
|---|---|---|
| WSAA | `https://wsaahomo.afip.gov.ar/ws/services/LoginCms` | `https://wsaa.afip.gov.ar/ws/services/LoginCms` |
| WSFEv1 | `https://wswhomo.afip.gov.ar/wsfev1/service.asmx` | `https://servicios1.afip.gov.ar/wsfev1/service.asmx` |

---

## 2. Datos que hay que pedirle al cliente

1. **CUIT**, nombre o razón social tal como figura en ARCA.
2. **Condición frente al IVA** (Responsable Monotributo, Responsable Inscripto…).
3. **Domicilio comercial** declarado en ARCA para el punto de venta (es el que va
   impreso; si el local no está declarado, conviene declararlo).
4. **Ingresos Brutos**: número de inscripción. En Convenio Multilateral suele
   ser el mismo CUIT (confirmar con el formulario CM01 / el contador).
5. **Fecha de inicio de actividades**.
6. **Punto de venta** de tipo *Web Services* (ver paso 3.2).
7. **Clave Fiscal nivel 3 o superior** de quien factura (para hacer los trámites).
8. Cómo se entrega la factura: tiquetera, PDF, WhatsApp, mail.
9. Qué se factura y cuándo: automático o con botón (en CHOCOLATUC: botón, el
   personal elige).

---

## 3. Trámites en ARCA, paso a paso

### 3.1 Generar la clave privada y el pedido de certificado (CSR)

Se hacen **en la computadora del desarrollador**: la clave privada nunca viaja
por chat ni mail. El CSR es público y se puede compartir.

```bash
mkdir -p backend/arca/homologacion && cd backend/arca/homologacion
openssl genrsa -out empresa.key 2048
# En Git Bash de Windows, MSYS_NO_PATHCONV evita que rompa el "/C=AR/…"
MSYS_NO_PATHCONV=1 openssl req -new -key empresa.key \
  -subj "/C=AR/O=Nombre Apellido/CN=empresa-homo/serialNumber=CUIT 27XXXXXXXXX" \
  -out empresa.csr
```

Agregar al `.gitignore` del backend:

```
arca/
*.key
*.crt
*.csr
*.pem
*.p12
```

La **misma clave** sirve para el certificado de pruebas y el de producción
(en CHOCOLATUC se usó una sola clave para los dos).

### 3.2 Punto de venta para Web Services

ARCA → **"Administración de puntos de venta y domicilios"** → alta de punto de
venta con sistema **"Factura Electrónica – Monotributo – Web Services"** (o
"RECE para aplicativo y web services").

- No sirve el de "Comprobantes en línea" / "Factura en línea": tiene que ser uno
  de Web Services.
- Anotar el número (CHOCOLATUC: **3**).

### 3.3 Certificado de **pruebas** (homologación) — WSASS

1. **Administrador de Relaciones de Clave Fiscal** → *Adherir servicio* →
   ARCA → Servicios interactivos → **"WSASS – Autogestión Certificados
   Homologación"**.
2. Entrar a **WSASS** (aparece en la lista de servicios).
3. **Nuevo Certificado**: nombre simbólico (ej. `empresa-prueba`), CUIT, pegar el
   CSR completo (`-----BEGIN CERTIFICATE REQUEST-----` … `END`) → *Crear DN y
   obtener certificado*.
4. Copiar el certificado que aparece (`-----BEGIN CERTIFICATE-----` … `END`) a un
   archivo `prueba.crt` en `backend/arca/homologacion/`.
5. **Crear autorización a servicio**: el nombre simbólico del paso 3, CUIT
   representada, servicio **wsfe – Facturación Electrónica**.

### 3.4 Certificado de **producción**

1. ARCA → **"Administración de Certificados Digitales"** → agregar alias
   (ej. `empresa`) → subir el CSR → descargar el `.crt`.
2. **Administrador de Relaciones de Clave Fiscal** → *Nueva relación* → ARCA →
   WebServices → **Facturación Electrónica** → representante: el *computador
   fiscal* con el alias del certificado → confirmar.

### 3.5 Cómo saber de qué entorno es un certificado (error que nos pasó)

En CHOCOLATUC se generó dos veces el certificado en *Administración de
Certificados Digitales* creyendo que era de pruebas. ARCA de pruebas respondía
**"Certificado no emitido por AC de confianza"**. Se verifica así:

```bash
openssl x509 -in archivo.crt -noout -subject -issuer -dates
#   issuer=CN=Computadores Test, O=AFIP  → homologación (pruebas)
#   issuer=CN=Computadores, O=AFIP       → producción (real)

# ¿El certificado corresponde a la clave?
[ "$(openssl x509 -in archivo.crt -noout -pubkey | openssl md5)" = \
  "$(openssl pkey -in empresa.key -pubout | openssl md5)" ] && echo SI || echo NO
```

---

## 4. Implementación técnica

### 4.1 Dependencias del backend

```bash
npm i node-forge fast-xml-parser
```

- `node-forge`: firma CMS/PKCS#7 del pedido de acceso, en JavaScript puro (no
  depende de tener `openssl` en el servidor; sirve en Vercel).
- `fast-xml-parser`: leer las respuestas SOAP.

No hace falta una librería SOAP: se arma el XML a mano y se manda con `fetch`.

### 4.2 Variables de entorno

```env
ARCA_ENTORNO=homologacion        # o produccion
ARCA_CUIT=27XXXXXXXXX
ARCA_CERT=-----BEGIN CERTIFICATE-----...   # texto PEM completo
ARCA_KEY=-----BEGIN PRIVATE KEY-----...    # texto PEM completo
```

En desarrollo, si `ARCA_CERT`/`ARCA_KEY` están vacías, el módulo lee los
archivos de `backend/arca/<entorno>/`. En Vercel se pegan los textos completos
(si quedan en una línea con `\n`, el módulo los convierte).

### 4.3 Módulo `arca.js` (el núcleo)

Archivo de referencia: `backend/src/lib/arca.js`.

**a) Pedido de acceso firmado (TRA → CMS):**

```js
import forge from 'node-forge'

function pedidoFirmado({ cert, key }, servicio = 'wsfe') {
  const ahora = Date.now()
  const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const tra = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(ahora / 1000)}</uniqueId>
    <generationTime>${iso(ahora - 10 * 60 * 1000)}</generationTime>
    <expirationTime>${iso(ahora + 10 * 60 * 1000)}</expirationTime>
  </header>
  <service>${servicio}</service>
</loginTicketRequest>`
  const certificado = forge.pki.certificateFromPem(cert)
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(tra, 'utf8')
  p7.addCertificate(certificado)
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(key),
    certificate: certificado,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  })
  p7.sign()
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes())
}
```

Se manda a WSAA dentro de
`<loginCms xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov"><in0>…</in0></loginCms>`
con el encabezado `SOAPAction: ""` (vacío pero presente). La respuesta
`loginCmsReturn` trae otro XML (escapado) con `credentials/token`,
`credentials/sign` y `header/expirationTime`.

**b) Guardar el permiso (token/sign) — MUY IMPORTANTE:**

ARCA **no entrega otro permiso mientras el anterior siga vigente** (12 h):
responde "El CEE ya posee un TA válido". Por eso:

- Se guarda en la **base de datos** (tabla `settings`, clave
  `arca_ta_<entorno>_wsfe`), no en memoria: en Vercel cada función arranca de
  cero.
- Se reutiliza hasta 10 minutos antes de que venza.
- Si se prueba desde la computadora local, usar **la misma base** que la app
  publicada. Si no, la app publicada se queda sin poder pedir permiso hasta
  12 horas.

**c) Llamadas a WSFEv1:** todas llevan
`<Auth><Token/><Sign/><Cuit/></Auth>`, namespace `http://ar.gov.afip.dif.FEV1/`
y `SOAPAction: http://ar.gov.afip.dif.FEV1/<Metodo>`.

| Método | Para qué |
|---|---|
| `FEDummy` | Estado de los servidores (no necesita permiso). Primera prueba. |
| `FECompUltimoAutorizado` | Último número emitido en un punto de venta y tipo. |
| `FECAESolicitar` | Pedir el CAE de un comprobante. |
| `FECompConsultar` | Ver lo que ARCA tiene registrado de un comprobante. |
| `FEParamGetCondicionIvaReceptor` | Condiciones frente al IVA válidas (por clase A/B/C). |
| `FEParamGetPtosVenta` | Puntos de venta habilitados (en pruebas viene vacío). |

**d) Factura C (`FECAESolicitar`):**

```xml
<FeCAEReq>
  <FeCabReq><CantReg>1</CantReg><PtoVta>3</PtoVta><CbteTipo>11</CbteTipo></FeCabReq>
  <FeDetReq><FECAEDetRequest>
    <Concepto>1</Concepto>                    <!-- 1 productos, 2 servicios, 3 ambos -->
    <DocTipo>99</DocTipo><DocNro>0</DocNro>   <!-- consumidor final sin identificar -->
    <CbteDesde>N</CbteDesde><CbteHasta>N</CbteHasta>
    <CbteFch>AAAAMMDD</CbteFch>
    <ImpTotal>1800.00</ImpTotal><ImpTotConc>0</ImpTotConc><ImpNeto>1800.00</ImpNeto>
    <ImpOpEx>0</ImpOpEx><ImpTrib>0</ImpTrib><ImpIVA>0</ImpIVA>
    <MonId>PES</MonId><MonCotiz>1</MonCotiz>
    <CondicionIVAReceptorId>5</CondicionIVAReceptorId>
  </FECAEDetRequest></FeDetReq>
</FeCAEReq>
```

- En la **Factura C** el neto es igual al total y no hay IVA (`ImpIVA` 0, sin
  bloque `<Iva>`).
- **Servicios** (`Concepto` 2 o 3) además piden `FchServDesde`, `FchServHasta` y
  `FchVtoPago`.
- Si el resultado no es `A` o no hay CAE, mostrar los `Errors/Err` y
  `Observaciones/Obs` de la respuesta.
- **Numeración**: `FECompUltimoAutorizado` + 1. Si dos facturas salen a la vez,
  ARCA rechaza una (número no correlativo): reintentar una vez.

**e) Nota de crédito C (tipo 13)** para anular: el mismo pedido, con el
comprobante asociado:

```xml
<CbtesAsoc><CbteAsoc>
  <Tipo>11</Tipo><PtoVta>3</PtoVta><Nro>2</Nro>
  <Cuit>27XXXXXXXXX</Cuit><CbteFch>AAAAMMDD</CbteFch>
</CbteAsoc></CbtesAsoc>
```

### 4.4 Tablas y códigos

| Código | Significado |
|---|---|
| Tipo 11 / 13 | Factura C / Nota de crédito C |
| Tipo 1 / 3 / 6 / 8 | Factura A / NC A / Factura B / NC B (para Responsable Inscripto) |
| DocTipo 80 / 86 / 96 / 99 | CUIT / CUIL / DNI / sin identificar (DocNro 0) |
| Condición IVA 5 | Consumidor Final |
| Condición IVA 6 | Responsable Monotributo |
| Condición IVA 1 | IVA Responsable Inscripto |
| Condición IVA 4 | IVA Sujeto Exento |

Tablas de la base (CHOCOLATUC, se crean solas la primera vez):

- `clientes`: nombre, doc_tipo, doc_nro (único con el tipo), condicion_iva_id,
  domicilio, teléfono.
- `facturas`: entorno, tipo, punto_venta, numero (único por entorno+tipo+PV),
  fecha, sale_id, cliente_id, datos del receptor, total, cae, cae_vence,
  asociada_id (para NC), estado (emitida/anulada).

Validar el **CUIT** con el dígito verificador (pesos 5,4,3,2,7,6,5,4,3,2; si da
11 → 0, si da 10 → 9).

### 4.5 Reglas vigentes (verificar con el contador)

- **Condición frente al IVA del receptor** (`CondicionIVAReceptorId`):
  obligatoria; ARCA rechaza comprobantes sin ella desde el **1/12/2026**
  (RG 5616, manual WSFEv1 v4.8).
- **Identificar al consumidor final** desde **$10.000.000** (RG 5700/2025). Por
  debajo, `DocTipo 99` / `DocNro 0`.
- **QR obligatorio** (RG 4892).

### 4.6 Código QR

URL: `https://www.afip.gob.ar/fe/qr/?p=<base64 del JSON>`

```json
{ "ver": 1, "fecha": "2026-11-19", "cuit": 27111111110, "ptoVta": 3,
  "tipoCmp": 11, "nroCmp": 2, "importe": 1800, "moneda": "PES", "ctz": 1,
  "tipoDocRec": 99, "nroDocRec": 0, "tipoCodAut": "E", "codAut": 86471090241225 }
```

### 4.7 Lo que se imprime (Factura C)

Emisor (razón social, CUIT, domicilio comercial, Ingresos Brutos, inicio de
actividades, condición frente al IVA) · "FACTURA C" · código 011 · punto de venta
y número (`00003-00000002`) · fecha · receptor (nombre, documento, condición
frente al IVA) · detalle · total · QR · CAE y vencimiento. En homologación:
leyenda **"COMPROBANTE DE PRUEBA – SIN VALIDEZ FISCAL"**.

### 4.8 Frontend (gestión)

- `FacturarModal`: consumidor final / cliente guardado / cliente nuevo (con
  "guardar para la próxima").
- `ComprobanteModal`: vista del ticket + **Imprimir** + **PDF** + **WhatsApp**.
- **Ticket 80 mm**: el ticket se copia con `createPortal` a `document.body` y la
  hoja de impresión deja solo eso:

  ```css
  .ticket-imprimir { display: none; }
  @media print {
    @page { size: 80mm auto; margin: 3mm; }
    body > *:not(.ticket-imprimir) { display: none !important; }
    .ticket-imprimir { display: block; width: 72mm; }
  }
  ```

- **PDF** con `jspdf` + `qrcode` (cargados a demanda). Se dibuja **dos veces**:
  la primera mide el alto, la segunda dibuja en un papel de ese alto exacto.
  `compress: true` → unos 8 KB por factura.
- **WhatsApp**: `navigator.share({ files: [pdf] })` cuando el dispositivo lo
  permite (celular, Windows con la app). Si no, descarga el PDF y abre
  `wa.me/<teléfono>?text=…` para adjuntarlo a mano.

### 4.9 Endpoints (CHOCOLATUC)

| Método y ruta | Qué hace |
|---|---|
| `GET /api/facturacion/estado?probar=1` | Configuración + prueba real de conexión |
| `GET/PUT /api/facturacion/datos` | Datos fiscales que se imprimen |
| `GET /api/facturacion/condiciones-iva` | Lista de ARCA (guardada un día) |
| `GET/POST/PATCH/DELETE /api/facturacion/clientes` | Clientes guardados |
| `POST /api/facturacion/ventas/:id/facturar` | Emite la Factura C de una venta |
| `GET /api/facturacion/facturas` | Historial (`desde`, `hasta`, `ventas=1,2,3`) |
| `GET /api/facturacion/facturas/:id` | Factura completa + QR para imprimir |
| `POST /api/facturacion/facturas/:id/anular` | Nota de crédito C por el total |

---

## 5. Cómo probar, en orden

1. **`FEDummy`** contra homologación → debe devolver `OK` en app, db y auth.
2. **Firma**: con un certificado autofirmado hecho con `openssl req -x509 …`,
   WSAA tiene que responder *"Certificado no emitido por AC de confianza"*. Eso
   confirma que la firma y el formato están bien.
3. **Con el certificado de WSASS**: `FECompUltimoAutorizado` (pruebas, el punto
   de venta puede ser cualquiera), `FEParamGetCondicionIvaReceptor`.
4. **Emitir** una Factura C de prueba por $100 y anularla con una NC C.
5. **`FECompConsultar`** para ver que quedó registrada.
6. Revisar el **PDF y el ticket** impreso.

**Ojo:** la *Constatación de comprobantes* y el QR de ARCA buscan **solo en
producción**: una factura de homologación siempre da "el CAE no existe". Es
normal.

---

## 6. Pasar a producción

1. Que la contribuyente y el contador revisen el ticket de prueba (domicilio,
   Ingresos Brutos, leyendas).
2. Cambiar en el hosting: `ARCA_ENTORNO=produccion`, `ARCA_CERT` = certificado
   de producción, `ARCA_KEY` = la clave.
3. Volver a desplegar el backend.
4. Emitir la primera factura real con una venta chica y verificarla en la
   **Constatación de comprobantes** de ARCA.

Las facturas de prueba y las reales no se mezclan: cada una guarda su `entorno`
y el historial muestra solo las del entorno activo.

---

## 7. Problemas que aparecieron (y cómo se resolvieron)

| Problema | Causa | Solución |
|---|---|---|
| "Certificado no emitido por AC de confianza" | Certificado de producción usado en homologación | Ver el `issuer` con openssl (sección 3.5) |
| "El CEE ya posee un TA válido" (posible) | Pedir permiso desde dos lugares con bases distintas | Guardar el permiso en la base compartida |
| `\d` convertido en `d` en regex | Editar código con `node -e` / heredoc desde la terminal | Editar archivos con el editor, no con la terminal |
| El push no se desplegó en Vercel ("Account is blocked") | Cuenta Hobby bloqueada por límites / uso comercial | Pasar a Pro y desplegar el commit |
| Constatación dice que el CAE no existe | Era una factura de homologación | Normal; en producción sí aparece |

---

## 8. Para un Responsable Inscripto (Factura A / B)

Lo que cambia respecto de la Factura C:

- **Tipo de comprobante** según el receptor: **A** (tipo 1) a Responsable
  Inscripto / Monotributo; **B** (tipo 6) a Consumidor Final / Exento. Notas de
  crédito: 3 (A) y 8 (B).
- **IVA discriminado**: `ImpNeto` = neto gravado, `ImpIVA` = total de IVA, y el
  bloque `<Iva><AlicIva><Id>5</Id><BaseImp>…</BaseImp><Importe>…</Importe></AlicIva></Iva>`
  (Id 5 = 21 %, 4 = 10,5 %, 6 = 27 %, 3 = 0 %). `ImpTotal = ImpNeto + ImpIVA + ImpTrib + ImpOpEx + ImpTotConc`.
- **Condición frente al IVA del receptor**: lista de la clase A o B
  (`FEParamGetCondicionIvaReceptor` con `ClaseCmp` A o B).
- **Productos con su alícuota**: cada producto necesita su IVA (21 %, 10,5 %…).
- **Ley 27.743 (transparencia fiscal al consumidor)**: en las facturas B a
  consumidor final hay que informar el IVA contenido. Confirmar con el contador
  los requisitos vigentes.
- Si cambia la condición, **dar de alta un punto de venta** acorde o confirmar
  que el actual sirve.

---

## 9. Checklist para el próximo proyecto (StockLoad)

- [ ] Datos de la sección 2 pedidos al cliente.
- [ ] Clave + CSR generados localmente; `arca/` en `.gitignore`.
- [ ] Punto de venta de **Web Services** creado.
- [ ] WSASS adherido → certificado de pruebas → autorización **wsfe**.
- [ ] Certificado de producción + relación **Facturación Electrónica**.
- [ ] `issuer` de cada certificado verificado con openssl.
- [ ] `node-forge` + `fast-xml-parser`; módulo `arca.js` con permiso guardado en la base.
- [ ] `CondicionIVAReceptorId` en cada comprobante.
- [ ] QR, ticket, PDF, nota de crédito.
- [ ] Pruebas de la sección 5 en homologación.
- [ ] Revisión del contador → producción.
