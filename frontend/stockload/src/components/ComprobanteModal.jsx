import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, MessageCircle, Printer, X } from 'lucide-react';
import Button from './Button';
import TicketFactura from './TicketFactura';
import { apiFetch, API_URL } from '../utils/api';
import { leerError } from '../utils/format';
import { compartirWhatsApp, descargarPdf, generarQr } from '../utils/factura';

/**
 * Muestra un comprobante de ARCA listo para imprimir en la tiquetera, bajar en PDF o mandar por WhatsApp.
 * Recibe el comprobante ya cargado, o el id de la factura, o el id de la venta (busca su factura vigente).
 */
const ComprobanteModal = ({ comprobante: inicial, facturaId, ventaId, onClose }) => {
    const [c, setC] = useState(inicial || null);
    const [qr, setQr] = useState('');
    const [error, setError] = useState('');
    const [accion, setAccion] = useState('');
    const [aviso, setAviso] = useState('');

    useEffect(() => {
        if (inicial) return;
        let cancelado = false;
        (async () => {
            let id = facturaId;
            if (!id && ventaId) {
                const r = await apiFetch(`${API_URL}/facturacion/facturas?ventaId=${ventaId}`);
                if (!r.ok) { if (!cancelado) setError(await leerError(r)); return; }
                const lista = (await r.json()).data;
                id = (lista.find(f => f.tipo === 11 && f.estado === 'Emitida') || lista[0])?.id;
                if (!id) { if (!cancelado) setError('La venta no tiene factura emitida en este entorno.'); return; }
            }
            const res = await apiFetch(`${API_URL}/facturacion/facturas/${id}`);
            if (cancelado) return;
            if (res.ok) setC(await res.json());
            else setError(await leerError(res, 'No se pudo cargar el comprobante'));
        })();
        return () => { cancelado = true; };
    }, [inicial, facturaId, ventaId]);

    useEffect(() => {
        if (c?.qrUrl) generarQr(c.qrUrl).then(setQr);
    }, [c]);

    const ejecutar = async (nombre, fn) => {
        setAccion(nombre); setAviso('');
        try { await fn(); }
        catch { setAviso('No se pudo generar el PDF.'); }
        finally { setAccion(''); }
    };

    const whatsapp = () => ejecutar('whatsapp', async () => {
        const r = await compartirWhatsApp(c);
        if (r === 'descargado') setAviso('Se descargó el PDF: adjuntalo en el chat de WhatsApp que se abrió.');
    });

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-md max-h-[92vh] flex flex-col rounded-xl border border-jewelry-gray bg-jewelry-darker" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-jewelry-gray">
                    <h3 className="text-lg font-display font-semibold text-jewelry-light">
                        {c ? `${c.tipoNombre} ${c.numeroFormateado}` : 'Comprobante'}
                    </h3>
                    <button onClick={onClose} className="text-jewelry-light/50 hover:text-jewelry-light"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {!c && !error && <div className="flex justify-center py-16 text-jewelry-light/50"><Loader2 className="animate-spin" /></div>}
                    {c && (
                        <>
                            {c.esPrueba && (
                                <div className="p-3 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-300 text-sm">
                                    Es un comprobante de <strong>prueba</strong> (homologación de ARCA): no tiene validez fiscal.
                                </div>
                            )}
                            {c.estado === 'Anulada' && (
                                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    Factura anulada{c.notaCredito ? ` con la nota de crédito ${c.notaCredito.numeroFormateado}` : ''}.
                                </div>
                            )}
                            <div className="mx-auto w-full max-w-[320px] rounded-lg bg-white p-4 shadow-lg">
                                <TicketFactura comprobante={c} qr={qr} />
                            </div>
                        </>
                    )}
                </div>

                {c && (
                    <div className="p-4 border-t border-jewelry-gray space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                            <Button size="sm" onClick={() => window.print()} disabled={!qr} className="gap-1.5"><Printer size={15} /> Imprimir ticket</Button>
                            <Button size="sm" variant="secondary" onClick={() => ejecutar('pdf', () => descargarPdf(c))} isLoading={accion === 'pdf'} className="gap-1.5">
                                {accion !== 'pdf' && <Download size={15} />} PDF
                            </Button>
                            <Button size="sm" variant="secondary" onClick={whatsapp} isLoading={accion === 'whatsapp'} className="gap-1.5">
                                {accion !== 'whatsapp' && <MessageCircle size={15} />} WhatsApp
                            </Button>
                        </div>
                        {aviso && <p className="text-xs text-amber-400 text-center">{aviso}</p>}
                        <p className="text-[11px] text-jewelry-light/40 text-center">
                            Para la tiquetera: en la ventana de impresión elegí la impresora de tickets y papel de 80 mm.
                        </p>
                    </div>
                )}
            </div>

            {/* Copia del ticket que es lo único que sale en la impresión (ver .ticket-imprimir en index.css) */}
            {c && createPortal(
                <div className="ticket-imprimir"><TicketFactura comprobante={c} qr={qr} /></div>,
                document.body
            )}
        </div>
    );
};

export default ComprobanteModal;
