// Comprobantes de ARCA (Factura C / Nota de crédito C): QR, PDF de 80 mm y envío por WhatsApp.
// jspdf y qrcode se cargan a demanda para no agrandar la carga inicial de la app.
import { formatFecha, formatMoney } from './format';

// Códigos de documento de ARCA
export const TIPOS_DOC = [
    { value: 80, label: 'CUIT' },
    { value: 96, label: 'DNI' },
    { value: 86, label: 'CUIL' },
];

// Cliente nuevo: por defecto CUIT y Responsable Monotributo (6)
export const CLIENTE_VACIO = { nombre: '', docTipo: 80, docNro: '', condicionIvaId: 6, telefono: '', domicilio: '' };

export const generarQr = async (texto) => {
    const QRCode = (await import('qrcode')).default;
    return QRCode.toDataURL(texto, { margin: 0, width: 300, errorCorrectionLevel: 'M' });
};

export const nombreArchivo = (c) =>
    `${c.tipo === 13 ? 'NotaCredito' : 'Factura'}C_${c.numeroFormateado}.pdf`;

/** Líneas de texto del ticket, compartidas por la vista previa y el PDF. */
export const datosTicket = (c) => {
    const e = c.emisor || {};
    const r = c.receptor || {};
    return {
        emisor: [
            e.cuit && `CUIT: ${e.cuit}`,
            e.domicilio,
            e.ingresosBrutos && `Ing. Brutos: ${e.ingresosBrutos}`,
            e.inicioActividades && `Inicio de actividades: ${formatFecha(e.inicioActividades)}`,
            e.condicionIva,
        ].filter(Boolean),
        titulo: c.tipo === 13 ? 'NOTA DE CRÉDITO C' : 'FACTURA C',
        cabecera: [
            `Cód. ${c.codigo} · ORIGINAL`,
            `N° ${c.numeroFormateado}`,
            `Fecha: ${formatFecha(c.fecha)}`,
            c.asociada && `Anula: ${c.asociada.tipoNombre} ${c.asociada.numeroFormateado}`,
        ].filter(Boolean),
        receptor: [
            `Cliente: ${r.nombre || 'Consumidor Final'}`,
            r.docNro && `${r.docTipoNombre}: ${r.docNro}`,
            `Cond. IVA: ${r.condicionIva}`,
            r.domicilio && `Domicilio: ${r.domicilio}`,
        ].filter(Boolean),
    };
};

/**
 * Genera el PDF del ticket (80 mm de ancho). Se dibuja dos veces: la primera mide el alto
 * y la segunda dibuja en un papel de ese alto exacto.
 */
export const generarPdf = async (c) => {
    const { jsPDF } = await import('jspdf');
    const qr = await generarQr(c.qrUrl);
    const t = datosTicket(c);

    const ANCHO = 80, M = 5, UTIL = ANCHO - 2 * M, CENTRO = ANCHO / 2;

    const dibujar = (doc) => {
        let y = M + 2;
        const fuente = (tam, negrita = false) => { doc.setFont('courier', negrita ? 'bold' : 'normal'); doc.setFontSize(tam); };
        const alto = (tam) => tam * 0.42;
        const centrado = (texto, tam = 8, negrita = false) => {
            fuente(tam, negrita);
            for (const l of doc.splitTextToSize(String(texto), UTIL)) { doc.text(l, CENTRO, y, { align: 'center' }); y += alto(tam); }
        };
        const izquierda = (texto, tam = 8, negrita = false) => {
            fuente(tam, negrita);
            for (const l of doc.splitTextToSize(String(texto), UTIL)) { doc.text(l, M, y); y += alto(tam); }
        };
        const fila = (izq, der, tam = 8, negrita = false) => {
            fuente(tam, negrita);
            doc.text(String(izq), M, y);
            doc.text(String(der), ANCHO - M, y, { align: 'right' });
            y += alto(tam);
        };
        const linea = () => {
            y += 0.5;
            doc.setLineDashPattern([0.8, 0.8], 0); doc.setLineWidth(0.2);
            doc.line(M, y, ANCHO - M, y);
            doc.setLineDashPattern([], 0);
            y += 3.5;
        };

        if (c.esPrueba) {
            doc.setLineWidth(0.4);
            doc.rect(M, y - 3, UTIL, 9);
            centrado('COMPROBANTE DE PRUEBA', 8, true);
            centrado('SIN VALIDEZ FISCAL', 8, true);
            y += 3;
        }

        centrado(c.emisor?.razonSocial || '', 10, true);
        t.emisor.forEach(l => centrado(l, 7.5));
        linea();
        centrado(t.titulo, 11, true);
        t.cabecera.forEach((l, i) => centrado(l, i === 1 ? 8.5 : 7.5, i === 1));
        linea();
        t.receptor.forEach(l => izquierda(l, 8));
        linea();

        for (const it of c.items) {
            izquierda(it.descripcion || '', 8);
            fila(`${it.cantidad} x ${formatMoney(it.precioUnitario)}`, formatMoney(it.precioUnitario * it.cantidad), 8);
            if (it.descuento > 0) fila('  Descuento', `-${formatMoney(it.descuento)}`, 7.5);
        }
        if (c.descuentoGeneral > 0) fila('Descuento', `-${formatMoney(c.descuentoGeneral)}`, 8);
        linea();
        fila('TOTAL', formatMoney(c.total), 11, true);
        linea();

        const lado = 32;
        doc.addImage(qr, 'PNG', CENTRO - lado / 2, y, lado, lado);
        y += lado + 4;
        centrado(`CAE N° ${c.cae}`, 8.5, true);
        centrado(`Vto. CAE: ${formatFecha(c.caeVencimiento)}`, 8);
        centrado('Comprobante autorizado por ARCA', 7);
        if (c.emisor?.mensajePie) { y += 1.5; centrado(c.emisor.mensajePie, 8); }
        return y + M;
    };

    const alto = dibujar(new jsPDF({ unit: 'mm', format: [ANCHO, 2000] }));
    const doc = new jsPDF({ unit: 'mm', format: [ANCHO, Math.max(alto, 100)], compress: true });
    dibujar(doc);
    doc.setProperties({ title: `${t.titulo} ${c.numeroFormateado}` });
    return doc;
};

export const descargarPdf = async (c) => {
    const doc = await generarPdf(c);
    doc.save(nombreArchivo(c));
};

/** Teléfono argentino para wa.me (código país 54 + 9 para celulares). */
const telefonoWhatsApp = (tel) => {
    let d = String(tel || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('0')) d = d.slice(1);
    if (d.startsWith('54')) return d;
    return `549${d}`;
};

/**
 * Comparte el PDF por WhatsApp. Si el dispositivo lo permite (celular, Windows con la app)
 * se adjunta directamente; si no, se descarga el PDF y se abre WhatsApp para adjuntarlo a mano.
 * Devuelve 'compartido' | 'descargado' | 'cancelado'.
 */
export const compartirWhatsApp = async (c) => {
    const doc = await generarPdf(c);
    const nombre = nombreArchivo(c);
    const archivo = new File([doc.output('blob')], nombre, { type: 'application/pdf' });
    const texto = `${c.emisor?.razonSocial || ''} — ${c.tipo === 13 ? 'Nota de crédito' : 'Factura'} C ${c.numeroFormateado} por ${formatMoney(c.total)}`;

    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try {
            await navigator.share({ files: [archivo], title: nombre, text: texto });
            return 'compartido';
        } catch (err) {
            if (err?.name === 'AbortError') return 'cancelado';
        }
    }

    doc.save(nombre);
    const tel = telefonoWhatsApp(c.receptor?.telefono);
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    return 'descargado';
};
