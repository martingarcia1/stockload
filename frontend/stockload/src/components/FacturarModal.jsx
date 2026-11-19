import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import Button from './Button';
import { fieldClass, labelClass } from './selectStyles';
import { apiFetch, API_URL } from '../utils/api';
import { formatMoney, leerError } from '../utils/format';
import { CLIENTE_VACIO, TIPOS_DOC } from '../utils/factura';
import useCondicionesIva from '../hooks/useCondicionesIva';

const Opcion = ({ activa, titulo, detalle, onClick }) => (
    <button type="button" onClick={onClick}
        className={`text-left rounded-lg border p-3 transition-colors ${activa
            ? 'border-jewelry-gold bg-jewelry-gold/10'
            : 'border-jewelry-gray hover:border-jewelry-gold/50'}`}>
        <p className="font-semibold text-jewelry-light text-sm">{titulo}</p>
        <p className="text-xs text-jewelry-light/50">{detalle}</p>
    </button>
);

/**
 * Emite la Factura C de una venta: a consumidor final, a un cliente guardado o a un cliente nuevo.
 * venta: { id, totalArs }. onFacturada recibe el comprobante emitido.
 */
const FacturarModal = ({ venta, onClose, onFacturada }) => {
    const [modo, setModo] = useState('consumidor');
    const condiciones = useCondicionesIva();

    const [busqueda, setBusqueda] = useState('');
    const [clientes, setClientes] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [clienteId, setClienteId] = useState(null);

    const [nuevo, setNuevo] = useState(CLIENTE_VACIO);
    const [guardar, setGuardar] = useState(true);

    const [emitiendo, setEmitiendo] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (modo !== 'guardado') return;
        const t = setTimeout(async () => {
            setBuscando(true);
            const r = await apiFetch(`${API_URL}/facturacion/clientes?q=${encodeURIComponent(busqueda)}`);
            setBuscando(false);
            if (r.ok) setClientes(await r.json());
        }, 250);
        return () => clearTimeout(t);
    }, [modo, busqueda]);

    const setN = (k, v) => setNuevo(prev => ({ ...prev, [k]: v }));

    const cambiarTipoDoc = (docTipo) => setNuevo(prev => ({
        ...prev,
        docTipo,
        // Con DNI lo habitual es consumidor final; con CUIT, monotributista
        condicionIvaId: docTipo === 96 ? 5 : (prev.condicionIvaId === 5 ? 6 : prev.condicionIvaId),
    }));

    const emitir = async () => {
        setError('');
        let body = {};
        if (modo === 'guardado') {
            if (!clienteId) return setError('Elegí un cliente de la lista.');
            body = { clienteId };
        } else if (modo === 'nuevo') {
            if (!nuevo.docNro.trim()) return setError('Ingresá el número de documento.');
            if (!nuevo.nombre.trim()) return setError('Ingresá el nombre o razón social.');
            body = { cliente: { ...nuevo, docTipo: Number(nuevo.docTipo), condicionIvaId: Number(nuevo.condicionIvaId) }, guardar };
        }

        setEmitiendo(true);
        try {
            const res = await apiFetch(`${API_URL}/facturacion/ventas/${venta.id}/facturar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) onFacturada(await res.json());
            else setError(await leerError(res, 'No se pudo emitir la factura'));
        } catch {
            setError('Error de red al conectar con el servidor.');
        } finally {
            setEmitiendo(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={emitiendo ? undefined : onClose}>
            <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl border border-jewelry-gray bg-jewelry-darker" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-jewelry-gray">
                    <h3 className="text-xl font-display font-semibold text-jewelry-light">Facturar venta #{String(venta.id).padStart(5, '0')}</h3>
                    <button onClick={onClose} disabled={emitiendo} className="text-jewelry-light/50 hover:text-jewelry-light"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="rounded-lg bg-jewelry-gold/10 px-4 py-3 text-jewelry-light">
                        Factura C por <span className="text-xl font-semibold text-jewelry-gold">{formatMoney(venta.totalArs)}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Opcion activa={modo === 'consumidor'} onClick={() => setModo('consumidor')} titulo="Consumidor final" detalle="Sin datos del cliente" />
                        <Opcion activa={modo === 'guardado'} onClick={() => setModo('guardado')} titulo="Cliente guardado" detalle="Negocios, clientes frecuentes" />
                        <Opcion activa={modo === 'nuevo'} onClick={() => setModo('nuevo')} titulo="Cliente nuevo" detalle="Con CUIT o DNI" />
                    </div>

                    {modo === 'guardado' && (
                        <div className="space-y-2">
                            <input className={fieldClass} value={busqueda} onChange={e => setBusqueda(e.target.value)}
                                placeholder="Buscar por nombre, CUIT o DNI..." autoFocus />
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {buscando && clientes.length === 0 && <div className="flex justify-center py-4 text-jewelry-light/50"><Loader2 className="animate-spin" size={18} /></div>}
                                {!buscando && clientes.length === 0 && (
                                    <p className="text-sm text-jewelry-light/50 py-2">No hay clientes guardados{busqueda ? ' con esa búsqueda' : ''}. Usá "Cliente nuevo".</p>
                                )}
                                {clientes.map(c => (
                                    <button key={c.id} type="button" onClick={() => setClienteId(c.id)}
                                        className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${clienteId === c.id
                                            ? 'border-jewelry-gold bg-jewelry-gold/10' : 'border-jewelry-gray hover:border-jewelry-gold/50'}`}>
                                        <p className="font-semibold text-jewelry-light">{c.nombre}</p>
                                        <p className="text-xs text-jewelry-light/50">{c.docTipoNombre} {c.docNro} · {c.condicionIva}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {modo === 'nuevo' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Documento</label>
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <select className={fieldClass} value={nuevo.docTipo} onChange={e => cambiarTipoDoc(Number(e.target.value))}>
                                        {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                    <input className={fieldClass} value={nuevo.docNro} onChange={e => setN('docNro', e.target.value)}
                                        placeholder={nuevo.docTipo === 96 ? '30123456' : '30-71234567-8'} autoFocus />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Nombre o razón social</label>
                                <input className={fieldClass} value={nuevo.nombre} onChange={e => setN('nombre', e.target.value)} placeholder="Ej.: Joyería del Centro" />
                            </div>
                            <div>
                                <label className={labelClass}>Condición frente al IVA</label>
                                <select className={fieldClass} value={nuevo.condicionIvaId} onChange={e => setN('condicionIvaId', Number(e.target.value))}>
                                    {condiciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Teléfono (WhatsApp)</label>
                                <input className={fieldClass} value={nuevo.telefono} onChange={e => setN('telefono', e.target.value)} placeholder="381 555-1234" />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Domicilio (opcional)</label>
                                <input className={fieldClass} value={nuevo.domicilio} onChange={e => setN('domicilio', e.target.value)} />
                            </div>
                            <label className="md:col-span-2 flex items-center gap-2 text-sm text-jewelry-light cursor-pointer">
                                <input type="checkbox" className="accent-jewelry-gold" checked={guardar} onChange={e => setGuardar(e.target.checked)} />
                                Guardar el cliente para la próxima
                            </label>
                        </div>
                    )}

                    {error && <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-jewelry-gray">
                    <Button variant="ghost" onClick={onClose} disabled={emitiendo}>Cancelar</Button>
                    <Button onClick={emitir} isLoading={emitiendo}>Emitir Factura C</Button>
                </div>
            </div>
        </div>
    );
};

export default FacturarModal;
