import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, Loader2, Plus, Printer, X, Ban } from 'lucide-react';
import { Card, CardContent } from '../components/Card';
import Button from '../components/Button';
import { fieldClass, labelClass } from '../components/selectStyles';
import { apiFetch, API_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
    ESTADOS_FACTURA, formatFechaHora, formatMoney, hoyISO, labelMedioPago, leerError, letraComprobante
} from '../utils/format';
import { imprimirComprobante } from '../utils/comprobante';
import FacturarModal from '../components/FacturarModal';
import ComprobanteModal from '../components/ComprobanteModal';

const EstadoFactura = ({ venta }) => {
    if (venta.anulada) return <span className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400">Anulada</span>;
    const e = ESTADOS_FACTURA[venta.facturaEstado] || ESTADOS_FACTURA.NoSolicitada;
    const letra = letraComprobante(venta.tipoComprobante);
    return <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${e.className}`}>{e.label}{letra && venta.facturaEstado !== 'NoSolicitada' ? ` ${letra}` : ''}</span>;
};

const DetalleVenta = ({ venta, config, esGestion, onClose, onActualizada }) => {
    const [accion, setAccion] = useState('');
    const [error, setError] = useState('');
    const [motivoAnulacion, setMotivoAnulacion] = useState('');
    const [confirmandoAnular, setConfirmandoAnular] = useState(false);
    const [facturando, setFacturando] = useState(false);
    const [verFactura, setVerFactura] = useState(null); // { comprobante } | { ventaId }
    const m = venta.moneda;

    const recargar = async () => {
        const res = await apiFetch(`${API_URL}/ventas/${venta.id}`);
        if (res.ok) onActualizada(await res.json());
    };

    const anular = async () => {
        if (!motivoAnulacion.trim()) return setError('Indique el motivo de la anulación.');
        setAccion('anular'); setError('');
        const res = await apiFetch(`${API_URL}/ventas/${venta.id}/anular`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motivo: motivoAnulacion })
        });
        setAccion('');
        if (res.ok) { onActualizada(await res.json()); setConfirmandoAnular(false); }
        else setError(await leerError(res));
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-jewelry-gray bg-jewelry-darker" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between p-6 border-b border-jewelry-gray">
                    <div>
                        <h3 className="text-xl font-display font-semibold text-jewelry-light">Venta #{venta.id}</h3>
                        <p className="text-sm text-jewelry-light/60">{formatFechaHora(venta.fecha)} · {venta.usuario}</p>
                    </div>
                    <button onClick={onClose} className="text-jewelry-light/50 hover:text-jewelry-light"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-5 text-sm">
                    <table className="w-full">
                        <thead className="text-xs uppercase text-jewelry-light/50">
                            <tr><th className="text-left pb-2">Producto</th><th className="text-right pb-2">Lista</th><th className="text-right pb-2">Desc.</th><th className="text-right pb-2">Subtotal</th></tr>
                        </thead>
                        <tbody className="divide-y divide-jewelry-gray/50">
                            {venta.items.map(i => (
                                <tr key={i.id}>
                                    <td className="py-2">
                                        <p className="text-jewelry-light">{i.cantidad} × {i.descripcion}</p>
                                        <p className="text-xs text-jewelry-light/50">
                                            {i.sku} {i.monedaLista !== m && <>· lista {formatMoney(i.precioLista, i.monedaLista)}</>}
                                            {i.descuentoMotivo && <> · <span className="text-jewelry-gold">{i.descuentoMotivo}</span></>}
                                        </p>
                                    </td>
                                    <td className="py-2 text-right">{formatMoney(i.precioUnitario * i.cantidad, m)}</td>
                                    <td className="py-2 text-right text-jewelry-gold">{i.descuento > 0 ? `−${formatMoney(i.descuento, m)}` : '-'}</td>
                                    <td className="py-2 text-right">{formatMoney(i.subtotal, m)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1 text-jewelry-light/70">
                            <p>Pago: <span className="text-jewelry-light">{labelMedioPago(venta.medioPago)} ({m})</span></p>
                            <p>Cotización: <span className="text-jewelry-light">{formatMoney(venta.cotizacion)}</span></p>
                            {venta.descuentoGeneral > 0 && <p>Desc. general: <span className="text-jewelry-gold">−{formatMoney(venta.descuentoGeneral, m)}</span></p>}
                            {venta.descuentoMotivo && <p>Motivo desc.: <span className="text-jewelry-light">{venta.descuentoMotivo}</span></p>}
                            {(venta.clienteNombre || venta.clienteDocNro) && (
                                <p>Cliente: <span className="text-jewelry-light">{venta.clienteNombre} {venta.clienteDocNro && `(${venta.clienteDocTipo} ${venta.clienteDocNro})`}</span></p>
                            )}
                            {venta.observaciones && <p>Obs.: <span className="text-jewelry-light">{venta.observaciones}</span></p>}
                        </div>
                        <div className="space-y-1 text-right">
                            <p className="text-jewelry-light/70">Subtotal {formatMoney(venta.subtotal, m)}</p>
                            {venta.descuento > 0 && <p className="text-jewelry-gold">Descuentos −{formatMoney(venta.descuento, m)}</p>}
                            <p className="text-xl font-semibold text-jewelry-light">{formatMoney(venta.total, m)}</p>
                            {m === 'USD' && <p className="text-xs text-jewelry-light/50">≈ {formatMoney(venta.totalArs)}</p>}
                        </div>
                    </div>

                    <div className="rounded-lg border border-jewelry-gray p-3 space-y-1">
                        <div className="flex items-center gap-2"><span className="text-jewelry-light/70">Facturación:</span> <EstadoFactura venta={venta} /></div>
                        {venta.facturaEstado === 'Emitida' && (
                            <p className="text-jewelry-light/70">
                                Factura {letraComprobante(venta.tipoComprobante)} {String(venta.puntoVenta).padStart(5, '0')}-{String(venta.numeroComprobante).padStart(8, '0')} · CAE {venta.cae}
                            </p>
                        )}
                        {venta.netoGravado != null && venta.tipoComprobante !== 11 && (
                            <p className="text-xs text-jewelry-light/50">Neto {formatMoney(venta.netoGravado)} · IVA {formatMoney(venta.importeIva)}</p>
                        )}
                        {venta.facturaError && !venta.anulada && <p className="text-xs text-amber-400">{venta.facturaError}</p>}
                        {venta.anulada && <p className="text-xs text-red-400">Anulada por {venta.usuarioAnulacion} el {formatFechaHora(venta.fechaAnulacion)}: {venta.motivoAnulacion}</p>}
                    </div>

                    {confirmandoAnular && (
                        <div className="rounded-lg border border-red-500/30 p-3 space-y-2">
                            <p className="text-red-400">Se devolverá el stock y la venta dejará de contar en la caja.</p>
                            <input className={fieldClass} value={motivoAnulacion} onChange={e => setMotivoAnulacion(e.target.value)} placeholder="Motivo de la anulación" autoFocus />
                            <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => setConfirmandoAnular(false)}>Cancelar</Button>
                                <Button variant="danger" size="sm" onClick={anular} isLoading={accion === 'anular'}>Confirmar anulación</Button>
                            </div>
                        </div>
                    )}

                    {error && <p className="text-sm text-red-400">{error}</p>}
                </div>

                <div className="flex flex-wrap justify-end gap-2 p-4 border-t border-jewelry-gray">
                    {esGestion && !venta.anulada && venta.facturaEstado !== 'Emitida' && !confirmandoAnular && (
                        <Button variant="danger" size="sm" onClick={() => setConfirmandoAnular(true)} className="gap-1"><Ban size={14} /> Anular</Button>
                    )}
                    {!venta.anulada && venta.facturaEstado !== 'Emitida' && (
                        <Button variant="outline" size="sm" onClick={() => setFacturando(true)} className="gap-1"><FileText size={14} /> Facturar</Button>
                    )}
                    {venta.facturaEstado === 'Emitida' ? (
                        <Button size="sm" onClick={() => setVerFactura({ ventaId: venta.id })} className="gap-1"><FileText size={14} /> Ver factura</Button>
                    ) : (
                        <Button size="sm" onClick={() => imprimirComprobante(venta, config)} className="gap-1"><Printer size={14} /> Ticket sin factura</Button>
                    )}
                </div>
            </div>

            {facturando && (
                <div onClick={e => e.stopPropagation()}>
                    <FacturarModal venta={venta} onClose={() => setFacturando(false)}
                        onFacturada={(c) => { setFacturando(false); setVerFactura({ comprobante: c }); recargar(); }} />
                </div>
            )}
            {verFactura && (
                <div onClick={e => e.stopPropagation()}>
                    <ComprobanteModal {...verFactura} onClose={() => setVerFactura(null)} />
                </div>
            )}
        </div>
    );
};

const VentasList = () => {
    const navigate = useNavigate();
    const { esGestion } = useAuth();
    const [ventas, setVentas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [filtros, setFiltros] = useState({ desde: hoyISO(), hasta: hoyISO(), facturaEstado: '', soloConDescuento: false });
    const [seleccionada, setSeleccionada] = useState(null);
    const [config, setConfig] = useState({});

    const cargar = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page, pageSize: 20 });
        if (filtros.desde) params.set('desde', filtros.desde);
        if (filtros.hasta) params.set('hasta', filtros.hasta);
        if (filtros.facturaEstado) params.set('facturaEstado', filtros.facturaEstado);
        if (filtros.soloConDescuento) params.set('soloConDescuento', 'true');
        try {
            const res = await apiFetch(`${API_URL}/ventas?${params}`);
            if (res.ok) {
                const data = await res.json();
                setVentas(data.data || []);
                setTotalPages(data.totalPages || 1);
                setTotalItems(data.totalItems || 0);
            }
        } finally {
            setLoading(false);
        }
    }, [page, filtros]);

    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => {
        if (esGestion) apiFetch(`${API_URL}/configuracion`).then(async r => r.ok && setConfig(await r.json()));
    }, [esGestion]);

    const setFiltro = (k, v) => { setPage(1); setFiltros(f => ({ ...f, [k]: v })); };

    const actualizarVenta = (v) => {
        setSeleccionada(v);
        setVentas(prev => prev.map(x => x.id === v.id ? v : x));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">Ventas</h2>
                    <p className="text-jewelry-light/60 mt-1">{esGestion ? 'Todas las ventas del local.' : 'Sus ventas registradas.'}</p>
                </div>
                <Button onClick={() => navigate('/ventas/nueva')} className="gap-2"><Plus size={18} /> Nueva venta</Button>
            </div>

            <Card>
                <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className={labelClass}>Desde</label>
                        <input type="date" className={fieldClass} value={filtros.desde} onChange={e => setFiltro('desde', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Hasta</label>
                        <input type="date" className={fieldClass} value={filtros.hasta} onChange={e => setFiltro('hasta', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Facturación</label>
                        <select className={fieldClass} value={filtros.facturaEstado} onChange={e => setFiltro('facturaEstado', e.target.value)}>
                            <option value="">Todas</option>
                            {Object.entries(ESTADOS_FACTURA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>
                    <label className="flex items-center gap-2 h-10 text-sm text-jewelry-light cursor-pointer">
                        <input type="checkbox" className="accent-jewelry-gold" checked={filtros.soloConDescuento} onChange={e => setFiltro('soloConDescuento', e.target.checked)} />
                        Sólo con descuento
                    </label>
                </CardContent>
            </Card>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs uppercase text-jewelry-light/50 border-b border-jewelry-gray">
                            <tr>
                                <th className="px-6 py-4 text-left font-medium">#</th>
                                <th className="px-6 py-4 text-left font-medium">Fecha</th>
                                <th className="px-6 py-4 text-left font-medium">Productos</th>
                                {esGestion && <th className="px-6 py-4 text-left font-medium">Vendedor</th>}
                                <th className="px-6 py-4 text-left font-medium">Pago</th>
                                <th className="px-6 py-4 text-right font-medium">Descuento</th>
                                <th className="px-6 py-4 text-right font-medium">Total</th>
                                <th className="px-6 py-4 text-left font-medium">Factura</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-jewelry-gray/50">
                            {loading ? (
                                <tr><td colSpan={8} className="py-12 text-center text-jewelry-light/50"><Loader2 className="animate-spin inline mr-2" size={16} />Cargando…</td></tr>
                            ) : ventas.length === 0 ? (
                                <tr><td colSpan={8} className="py-12 text-center text-jewelry-light/40">No hay ventas en el período.</td></tr>
                            ) : ventas.map(v => (
                                <tr key={v.id} onClick={() => setSeleccionada(v)} className={`cursor-pointer hover:bg-jewelry-gray/20 ${v.anulada ? 'opacity-50 line-through' : ''}`}>
                                    <td className="px-6 py-3 text-jewelry-light/60">{v.id}</td>
                                    <td className="px-6 py-3 whitespace-nowrap">{formatFechaHora(v.fecha)}</td>
                                    <td className="px-6 py-3 max-w-xs truncate">{v.items.map(i => `${i.cantidad}× ${i.descripcion}`).join(', ')}</td>
                                    {esGestion && <td className="px-6 py-3 text-jewelry-light/70">{v.usuario}</td>}
                                    <td className="px-6 py-3 whitespace-nowrap">{labelMedioPago(v.medioPago)} <span className="text-jewelry-light/40">{v.moneda}</span></td>
                                    <td className="px-6 py-3 text-right text-jewelry-gold whitespace-nowrap">{v.descuento > 0 ? `−${formatMoney(v.descuento, v.moneda)}` : '-'}</td>
                                    <td className="px-6 py-3 text-right font-medium whitespace-nowrap">{formatMoney(v.total, v.moneda)}</td>
                                    <td className="px-6 py-3"><EstadoFactura venta={v} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between px-6 py-4 border-t border-jewelry-gray text-sm text-jewelry-light/60">
                    <span>{totalItems} ventas</span>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={18} /></Button>
                        <span>{page} / {totalPages || 1}</span>
                        <Button variant="ghost" size="icon" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={18} /></Button>
                    </div>
                </div>
            </Card>

            {seleccionada && (
                <DetalleVenta venta={seleccionada} config={config} esGestion={esGestion}
                    onClose={() => setSeleccionada(null)} onActualizada={actualizarVenta} />
            )}
        </div>
    );
};

export default VentasList;
