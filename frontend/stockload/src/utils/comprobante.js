import { formatMoney, formatFechaHora, labelMedioPago, letraComprobante } from './format';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Abre una ventana con el comprobante de la venta listo para imprimir (formato ticket 80mm).
 * Si la factura fue emitida en ARCA muestra tipo, número y CAE; si no, se imprime como
 * "Comprobante no válido como factura".
 */
export const imprimirComprobante = (venta, config = {}) => {
    const m = venta.moneda;
    const facturada = venta.facturaEstado === 'Emitida';
    const letra = letraComprobante(venta.tipoComprobante);
    const numero = facturada
        ? `${String(venta.puntoVenta).padStart(5, '0')}-${String(venta.numeroComprobante).padStart(8, '0')}`
        : `Venta #${venta.id}`;

    const filas = venta.items.map(i => `
        <tr>
            <td>${i.cantidad} x ${esc(i.descripcion)}${i.sku ? `<br><small>${esc(i.sku)}</small>` : ''}
                ${i.descuento > 0 ? `<br><small>Desc. ${formatMoney(i.descuento, m)}${i.descuentoMotivo ? ` (${esc(i.descuentoMotivo)})` : ''}</small>` : ''}
            </td>
            <td class="r">${formatMoney(i.subtotal, m)}</td>
        </tr>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(numero)}</title>
    <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 76mm; margin: 0 auto; padding: 8px; color: #000; }
        h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
        .c { text-align: center; } .r { text-align: right; white-space: nowrap; }
        table { width: 100%; border-collapse: collapse; } td { vertical-align: top; padding: 2px 0; }
        hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
        .tot td { font-weight: bold; font-size: 14px; }
        .letra { font-size: 22px; font-weight: bold; border: 2px solid #000; display: inline-block; padding: 0 8px; }
        small { font-size: 10px; }
    </style></head><body>
        <h1>${esc(config.razonSocial || 'MarcelÖ Chavan')}</h1>
        ${config.cuit ? `<div class="c">CUIT ${esc(config.cuit)}</div>` : ''}
        ${config.domicilioComercial ? `<div class="c">${esc(config.domicilioComercial)}</div>` : ''}
        <hr>
        <div class="c">${facturada ? `<span class="letra">${letra}</span><br>FACTURA ${letra}` : 'COMPROBANTE NO VÁLIDO COMO FACTURA'}</div>
        <div class="c">${esc(numero)}</div>
        <div class="c">${formatFechaHora(venta.fecha)}</div>
        <hr>
        ${venta.clienteNombre || venta.clienteDocNro ? `<div>Cliente: ${esc(venta.clienteNombre || '')} ${venta.clienteDocNro ? `(${esc(venta.clienteDocTipo || 'Doc')} ${esc(venta.clienteDocNro)})` : ''}</div><hr>` : ''}
        <table>${filas}</table>
        <hr>
        <table>
            <tr><td>Subtotal</td><td class="r">${formatMoney(venta.subtotal, m)}</td></tr>
            ${venta.descuento > 0 ? `<tr><td>Descuentos</td><td class="r">-${formatMoney(venta.descuento, m)}</td></tr>` : ''}
            ${facturada && letra === 'A' ? `
                <tr><td>Neto gravado</td><td class="r">${formatMoney(venta.netoGravado)}</td></tr>
                <tr><td>IVA</td><td class="r">${formatMoney(venta.importeIva)}</td></tr>` : ''}
            <tr class="tot"><td>TOTAL</td><td class="r">${formatMoney(venta.total, m)}</td></tr>
            ${m === 'USD' ? `<tr><td><small>Equivalente ARS (cotiz. ${formatMoney(venta.cotizacion)})</small></td><td class="r"><small>${formatMoney(venta.totalArs)}</small></td></tr>` : ''}
        </table>
        <div>Pago: ${esc(labelMedioPago(venta.medioPago))} (${m})</div>
        ${facturada ? `<hr><div>CAE: ${esc(venta.cae)}</div><div>Vto. CAE: ${new Date(venta.caeVencimiento).toLocaleDateString('es-AR')}</div>` : ''}
        <hr><div class="c">¡Gracias por su compra!</div>
        <script>window.onload = () => { window.print(); }</script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) {
        alert('El navegador bloqueó la ventana de impresión. Habilite las ventanas emergentes.');
        return;
    }
    w.document.write(html);
    w.document.close();
};
