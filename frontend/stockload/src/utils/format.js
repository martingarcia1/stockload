// Formato de importes y helpers comunes para ventas, caja y reportes.

export const formatMoney = (monto, moneda = 'ARS') => {
    const n = Number(monto || 0);
    const texto = n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return moneda === 'USD' ? `US$ ${texto}` : `$ ${texto}`;
};

export const convertir = (monto, desde, hacia, cotizacion) => {
    if (desde === hacia || !cotizacion) return Number(monto || 0);
    if (desde === 'USD' && hacia === 'ARS') return round2(monto * cotizacion);
    if (desde === 'ARS' && hacia === 'USD') return round2(monto / cotizacion);
    return Number(monto || 0);
};

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const formatFecha = (fecha) =>
    fecha ? new Date(fecha).toLocaleDateString('es-AR') : '-';

export const formatFechaHora = (fecha) =>
    fecha ? new Date(fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-';

export const hoyISO = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
};

export const MEDIOS_PAGO = [
    { value: 'Efectivo', label: 'Efectivo' },
    { value: 'Debito', label: 'Tarjeta de débito' },
    { value: 'Credito', label: 'Tarjeta de crédito' },
    { value: 'Transferencia', label: 'Transferencia' },
    { value: 'MercadoPago', label: 'Mercado Pago / QR' },
];

export const labelMedioPago = (v) => MEDIOS_PAGO.find(m => m.value === v)?.label || v;

export const ESTADOS_FACTURA = {
    NoSolicitada: { label: 'Sin factura', className: 'bg-jewelry-gray/40 text-jewelry-light/60' },
    Pendiente: { label: 'Pendiente ARCA', className: 'bg-amber-500/10 text-amber-400' },
    Emitida: { label: 'Facturada', className: 'bg-emerald-500/10 text-emerald-400' },
    Error: { label: 'Error ARCA', className: 'bg-red-500/10 text-red-400' },
};

export const letraComprobante = (tipo) => ({ 1: 'A', 6: 'B', 11: 'C' }[tipo] || '');

export const ROLES = {
    Propietario: 'Propietario',
    Administradora: 'Administradora',
    Vendedor: 'Vendedor',
};

export const esGestion = (rol) => rol === 'Propietario' || rol === 'Administradora' || rol === 'Admin';

// Mensaje de error de una respuesta de la API (JSON {message} o texto plano)
export const leerError = async (response, fallback = 'Ocurrió un error') => {
    try {
        const text = await response.text();
        try {
            const json = JSON.parse(text);
            if (json.message) return json.message;
            if (json.errors) return Object.values(json.errors).flat().join(' ');
            if (json.title) return json.title;
        } catch { /* texto plano */ }
        return text || fallback;
    } catch {
        return fallback;
    }
};
