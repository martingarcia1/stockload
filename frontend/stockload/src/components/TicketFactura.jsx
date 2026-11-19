import React from 'react';
import { formatFecha, formatMoney } from '../utils/format';
import { datosTicket } from '../utils/factura';

const Linea = () => <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />;

const Fila = ({ izq, der, fuerte }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: fuerte ? 700 : 400, fontSize: fuerte ? 15 : undefined }}>
        <span>{izq}</span><span style={{ whiteSpace: 'nowrap' }}>{der}</span>
    </div>
);

/**
 * Ticket de la factura (80 mm). Se usa en la vista previa y, copiado a document.body,
 * para imprimir en la tiquetera. Siempre en blanco y negro.
 */
const TicketFactura = ({ comprobante: c, qr }) => {
    const t = datosTicket(c);

    return (
        <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 12, lineHeight: 1.35, color: '#000', background: '#fff' }}>
            {c.esPrueba && (
                <div style={{ border: '2px solid #000', textAlign: 'center', fontWeight: 700, padding: '4px 2px', marginBottom: 8 }}>
                    COMPROBANTE DE PRUEBA<br />SIN VALIDEZ FISCAL
                </div>
            )}
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.emisor?.razonSocial}</div>
                {t.emisor.map((l, i) => <div key={i} style={{ fontSize: 11 }}>{l}</div>)}
            </div>
            <Linea />
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t.titulo}</div>
                {t.cabecera.map((l, i) => <div key={i} style={{ fontSize: i === 1 ? 12 : 11, fontWeight: i === 1 ? 700 : 400 }}>{l}</div>)}
            </div>
            <Linea />
            {t.receptor.map((l, i) => <div key={i}>{l}</div>)}
            <Linea />
            {c.items.map((it, i) => (
                <div key={i} style={{ marginBottom: 3 }}>
                    <div>{it.descripcion}</div>
                    <Fila izq={`${it.cantidad} x ${formatMoney(it.precioUnitario)}`} der={formatMoney(it.precioUnitario * it.cantidad)} />
                    {it.descuento > 0 && <Fila izq="  Descuento" der={`-${formatMoney(it.descuento)}`} />}
                </div>
            ))}
            {c.descuentoGeneral > 0 && <Fila izq="Descuento" der={`-${formatMoney(c.descuentoGeneral)}`} />}
            <Linea />
            <Fila izq="TOTAL" der={formatMoney(c.total)} fuerte />
            <Linea />
            <div style={{ textAlign: 'center' }}>
                {qr && <img src={qr} alt="Código QR de ARCA" style={{ width: '34mm', height: '34mm', margin: '4px auto', display: 'block' }} />}
                <div style={{ fontWeight: 700 }}>CAE N° {c.cae}</div>
                <div>Vto. CAE: {formatFecha(c.caeVencimiento)}</div>
                <div style={{ fontSize: 10 }}>Comprobante autorizado por ARCA</div>
                {c.emisor?.mensajePie && <div style={{ marginTop: 6 }}>{c.emisor.mensajePie}</div>}
            </div>
        </div>
    );
};

export default TicketFactura;
