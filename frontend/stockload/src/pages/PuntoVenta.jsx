import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { AlertTriangle, CheckCircle2, Loader2, Minus, Plus, Printer, ShoppingBag, Trash2, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import { selectStyles, fieldClass, labelClass } from '../components/selectStyles';
import { apiFetch, API_URL } from '../utils/api';
import useCotizacion from '../hooks/useCotizacion';
import { useAuth } from '../context/AuthContext';
import { convertir, formatMoney, leerError, MEDIOS_PAGO, round2, letraComprobante } from '../utils/format';
import { imprimirComprobante } from '../utils/comprobante';

const CONDICIONES_IVA = [
    { value: 'ConsumidorFinal', label: 'Consumidor Final' },
    { value: 'ResponsableInscripto', label: 'Responsable Inscripto' },
    { value: 'Monotributo', label: 'Monotributista' },
    { value: 'Exento', label: 'Exento' },
];

const MOTIVOS_RAPIDOS = ['Pago contado efectivo', 'Cliente frecuente', 'Promoción', 'Producto con detalle'];

/** Input numérico que se edita libremente y confirma el valor al salir del campo o con Enter. */
const MontoInput = ({ value, onCommit, className, ...props }) => {
    const [texto, setTexto] = useState(null);
    const commit = () => {
        if (texto !== null) onCommit(texto);
        setTexto(null);
    };
    return (
        <input type="number" min="0" step="0.01" className={className} {...props}
            value={texto ?? value}
            onChange={e => setTexto(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); }} />
    );
};

/** Apertura rápida de caja, visible cuando no hay caja abierta. */
const AbrirCajaPanel = ({ onAbierta }) => {
    const [ars, setArs] = useState('');
    const [usd, setUsd] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const abrir = async () => {
        setSaving(true);
        setError('');
        const res = await apiFetch(`${API_URL}/caja/abrir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fondoInicialArs: Number(ars || 0), fondoInicialUsd: Number(usd || 0) })
        });
        setSaving(false);
        if (res.ok) onAbierta();
        else setError(await leerError(res, 'No se pudo abrir la caja'));
    };

    return (
        <Card className="border-amber-500/30">
            <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                    <Wallet className="text-amber-400 mt-0.5" size={20} />
                    <div>
                        <p className="font-medium text-jewelry-light">La caja está cerrada</p>
                        <p className="text-sm text-jewelry-light/60">Para registrar ventas, abra la caja indicando el efectivo con el que arranca el día.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                        <label className={labelClass}>Fondo inicial ARS</label>
                        <input type="number" min="0" step="0.01" className={fieldClass} value={ars} onChange={e => setArs(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                        <label className={labelClass}>Fondo inicial USD</label>
                        <input type="number" min="0" step="0.01" className={fieldClass} value={usd} onChange={e => setUsd(e.target.value)} placeholder="0" />
                    </div>
                    <Button onClick={abrir} isLoading={saving}>Abrir caja</Button>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
            </CardContent>
        </Card>
    );
};

const PuntoVenta = () => {
    const navigate = useNavigate();
    const { esGestion } = useAuth();
    const { cotizacion, error: errorCotizacion } = useCotizacion();
    const cot = cotizacion?.valor;

    const [productos, setProductos] = useState([]);
    const [loadingProductos, setLoadingProductos] = useState(true);
    const [cajaAbierta, setCajaAbierta] = useState(null);
    const [config, setConfig] = useState(null);

    // Carrito: { item, cantidad, descuento (en moneda de cobro), motivo }
    const [lineas, setLineas] = useState([]);
    const [moneda, setMoneda] = useState('ARS');
    const [medioPago, setMedioPago] = useState('Efectivo');
    const [descuentoGeneral, setDescuentoGeneral] = useState('');
    const [descuentoMotivo, setDescuentoMotivo] = useState('');
    const [facturar, setFacturar] = useState(true);
    const [cliente, setCliente] = useState({ nombre: '', docTipo: 'DNI', docNro: '', condicionIva: 'ConsumidorFinal' });
    const [observaciones, setObservaciones] = useState('');

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [ventaCreada, setVentaCreada] = useState(null);

    const cargarCaja = useCallback(async () => {
        const res = await apiFetch(`${API_URL}/caja/actual`);
        if (res.ok) setCajaAbierta((await res.json()).abierta);
    }, []);

    const cargarProductos = useCallback(async () => {
        setLoadingProductos(true);
        try {
            const res = await apiFetch(`${API_URL}/stock`);
            if (res.ok) {
                const data = await res.json();
                setProductos(data.filter(p => p.esActivo !== false).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')));
            }
        } finally {
            setLoadingProductos(false);
        }
    }, []);

    useEffect(() => {
        cargarCaja();
        cargarProductos();
        apiFetch(`${API_URL}/configuracion/publica`).then(async r => {
            if (r.ok) {
                const c = await r.json();
                setConfig(c);
                setFacturar(c.facturarPorDefecto);
            }
        });
    }, [cargarCaja, cargarProductos]);

    // ---------- Cálculos ----------
    const precioUnitario = useCallback(
        (item) => convertir(item.precio, item.moneda || 'ARS', moneda, cot),
        [moneda, cot]
    );

    const calculadas = useMemo(() => lineas.map(l => {
        const unitario = precioUnitario(l.item);
        const bruto = round2(unitario * l.cantidad);
        const descuento = Math.min(Number(l.descuento || 0), bruto);
        return { ...l, unitario, bruto, descuento, final: round2(bruto - descuento) };
    }), [lineas, precioUnitario]);

    const subtotal = round2(calculadas.reduce((s, l) => s + l.bruto, 0));
    const descLineas = round2(calculadas.reduce((s, l) => s + l.descuento, 0));
    const descGeneral = Number(descuentoGeneral || 0);
    const total = round2(subtotal - descLineas - descGeneral);
    const descuentoTotal = round2(descLineas + descGeneral);
    const porcentajeDesc = subtotal > 0 ? (descuentoTotal / subtotal * 100) : 0;

    // ---------- Acciones del carrito ----------
    const agregar = (item) => {
        if (!item) return;
        setLineas(prev => {
            const existente = prev.find(l => l.item.id === item.id);
            if (existente) {
                if (existente.cantidad >= (item.stock ?? 0)) return prev;
                return prev.map(l => l.item.id === item.id ? { ...l, cantidad: l.cantidad + 1 } : l);
            }
            if ((item.stock ?? 0) <= 0) return prev;
            return [...prev, { item, cantidad: 1, descuento: 0, motivo: '' }];
        });
    };

    const actualizar = (id, cambios) => setLineas(prev => prev.map(l => l.item.id === id ? { ...l, ...cambios } : l));
    const quitar = (id) => setLineas(prev => prev.filter(l => l.item.id !== id));

    const cambiarPrecioFinal = (l, valor) => {
        if (valor === '') return actualizar(l.item.id, { descuento: 0 });
        const final = Number(valor);
        actualizar(l.item.id, { descuento: Math.max(0, round2(l.bruto - final)) });
    };

    const cambiarMoneda = (nueva) => {
        if (nueva === moneda || !cot) return;
        // Se convierten los descuentos ya cargados para que el precio final no cambie de valor real
        setLineas(prev => prev.map(l => ({ ...l, descuento: convertir(l.descuento, moneda, nueva, cot) })));
        if (descuentoGeneral) setDescuentoGeneral(String(convertir(descuentoGeneral, moneda, nueva, cot)));
        setMoneda(nueva);
    };

    const limpiar = () => {
        setLineas([]);
        setDescuentoGeneral('');
        setDescuentoMotivo('');
        setCliente({ nombre: '', docTipo: 'DNI', docNro: '', condicionIva: 'ConsumidorFinal' });
        setObservaciones('');
        setFacturar(config?.facturarPorDefecto ?? true);
        setError('');
    };

    // ---------- Validación y envío ----------
    const necesitaCuit = facturar && config?.condicionFiscal === 'ResponsableInscripto'
        && (cliente.condicionIva === 'ResponsableInscripto' || cliente.condicionIva === 'Monotributo');

    const confirmar = async () => {
        setError('');
        if (lineas.length === 0) return setError('Agregue al menos un producto.');
        if (!cot) return setError('No hay cotización del dólar disponible.');
        if (total < 0) return setError('El descuento supera el total.');
        // Cada descuento necesita un motivo: el de la línea o, en su defecto, el motivo general
        const lineasSinMotivo = calculadas.some(l => l.descuento > 0 && !l.motivo.trim());
        if ((descGeneral > 0 || lineasSinMotivo) && !descuentoMotivo.trim()) {
            return setError('Indique el motivo del descuento (queda registrado quién lo aplicó y por qué).');
        }
        if (necesitaCuit && cliente.docNro.replace(/\D/g, '').length !== 11) {
            return setError('Para Factura A ingrese el CUIT del cliente (11 dígitos).');
        }

        setSaving(true);
        try {
            const payload = {
                items: calculadas.map(l => ({
                    itemId: l.item.id,
                    cantidad: l.cantidad,
                    descuento: l.descuento,
                    descuentoMotivo: l.motivo || null
                })),
                moneda,
                medioPago,
                descuentoGeneral: descGeneral,
                descuentoMotivo: descuentoMotivo || null,
                facturar,
                clienteNombre: cliente.nombre || null,
                clienteDocTipo: necesitaCuit ? 'CUIT' : cliente.docTipo,
                clienteDocNro: cliente.docNro || null,
                clienteCondicionIva: cliente.condicionIva,
                observaciones: observaciones || null
            };
            const res = await apiFetch(`${API_URL}/ventas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setVentaCreada(await res.json());
                limpiar();
                cargarProductos();
            } else {
                setError(await leerError(res, 'No se pudo registrar la venta'));
            }
        } catch {
            setError('Error de red al conectar con el servidor.');
        } finally {
            setSaving(false);
        }
    };

    const opciones = productos.map(p => ({
        value: p.id,
        item: p,
        isDisabled: (p.stock ?? 0) <= 0,
        label: `${p.sku ? `[${p.sku}] ` : ''}${p.nombre} — ${formatMoney(p.precio, p.moneda)} (Stock: ${p.stock ?? 0})`
    }));

    // ---------- Render ----------
    if (ventaCreada) {
        const v = ventaCreada;
        return (
            <div className="max-w-xl mx-auto space-y-6">
                <Card>
                    <CardContent className="pt-8 text-center space-y-4">
                        <CheckCircle2 className="mx-auto text-emerald-400" size={48} />
                        <h2 className="text-2xl font-display font-bold text-jewelry-light">Venta #{v.id} registrada</h2>
                        <p className="text-3xl font-semibold text-jewelry-gold">{formatMoney(v.total, v.moneda)}</p>
                        {v.descuento > 0 && (
                            <p className="text-sm text-jewelry-light/60">Incluye descuento de {formatMoney(v.descuento, v.moneda)}</p>
                        )}
                        {v.facturaEstado === 'Emitida' && (
                            <p className="text-sm text-emerald-400">Factura {letraComprobante(v.tipoComprobante)} emitida — CAE {v.cae}</p>
                        )}
                        {(v.facturaEstado === 'Pendiente' || v.facturaEstado === 'Error') && (
                            <p className="text-sm text-amber-400">
                                Factura {letraComprobante(v.tipoComprobante)} pendiente de emisión en ARCA. {v.facturaError}
                            </p>
                        )}
                        <div className="flex justify-center gap-3 pt-4">
                            <Button variant="outline" onClick={() => imprimirComprobante(v, config || {})} className="gap-2">
                                <Printer size={16} /> Imprimir comprobante
                            </Button>
                            <Button onClick={() => setVentaCreada(null)} className="gap-2">
                                <ShoppingBag size={16} /> Nueva venta
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">Nueva Venta</h2>
                    <p className="text-jewelry-light/60 mt-1">
                        {cot ? <>Cotización del dólar: <span className="text-jewelry-gold">{formatMoney(cot)}</span></> : (errorCotizacion || 'Cargando cotización…')}
                    </p>
                </div>
                <Button variant="ghost" onClick={() => navigate('/ventas')}>Ver ventas</Button>
            </div>

            {cajaAbierta === false && <AbrirCajaPanel onAbierta={cargarCaja} />}

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
                {/* ---------- Carrito ---------- */}
                <Card>
                    <CardHeader className="border-b border-jewelry-gray pb-4">
                        <CardTitle className="text-lg">Productos</CardTitle>
                        <div className="pt-2">
                            {loadingProductos ? (
                                <div className="flex items-center text-sm text-jewelry-light/50">
                                    <Loader2 className="animate-spin mr-2" size={16} /> Cargando catálogo...
                                </div>
                            ) : (
                                <Select
                                    placeholder="Buscar por nombre, SKU o escanear código y Enter…"
                                    value={null}
                                    onChange={(opt) => agregar(opt?.item)}
                                    options={opciones}
                                    isSearchable
                                    styles={selectStyles}
                                    noOptionsMessage={() => 'No se encontraron productos'}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.target.value) {
                                            const match = productos.find(i => i.sku && i.sku.toLowerCase() === e.target.value.toLowerCase());
                                            if (match) { e.preventDefault(); agregar(match); }
                                        }
                                    }}
                                />
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {calculadas.length === 0 ? (
                            <p className="text-center text-jewelry-light/40 py-12">Todavía no hay productos en la venta.</p>
                        ) : (
                            <div className="space-y-3">
                                {calculadas.map(l => (
                                    <div key={l.item.id} className="rounded-lg border border-jewelry-gray p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-medium text-jewelry-light truncate">{l.item.nombre}</p>
                                                <p className="text-xs text-jewelry-light/50">
                                                    {l.item.sku && <>{l.item.sku} · </>}
                                                    Lista: {formatMoney(l.item.precio, l.item.moneda)}
                                                    {(l.item.moneda || 'ARS') !== moneda && <> → {formatMoney(l.unitario, moneda)}</>}
                                                    {' '}· Stock {l.item.stock}
                                                </p>
                                            </div>
                                            <button onClick={() => quitar(l.item.id)} className="text-jewelry-light/40 hover:text-red-400 p-1" aria-label="Quitar">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                                            <div>
                                                <label className={labelClass}>Cantidad</label>
                                                <div className="flex items-center h-10 rounded-md border border-jewelry-gray">
                                                    <button className="px-3 h-full text-jewelry-light/60 hover:text-jewelry-gold" onClick={() => actualizar(l.item.id, { cantidad: Math.max(1, l.cantidad - 1) })}><Minus size={14} /></button>
                                                    <span className="flex-1 text-center text-sm">{l.cantidad}</span>
                                                    <button className="px-3 h-full text-jewelry-light/60 hover:text-jewelry-gold disabled:opacity-30" disabled={l.cantidad >= (l.item.stock ?? 0)} onClick={() => actualizar(l.item.id, { cantidad: l.cantidad + 1 })}><Plus size={14} /></button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelClass}>Precio lista</label>
                                                <p className="h-10 flex items-center text-sm text-jewelry-light/70">{formatMoney(l.bruto, moneda)}</p>
                                            </div>
                                            <div>
                                                <label className={labelClass}>Descuento</label>
                                                <input type="number" min="0" step="0.01" className={fieldClass}
                                                    value={l.descuento || ''}
                                                    onChange={e => actualizar(l.item.id, { descuento: Number(e.target.value || 0) })}
                                                    placeholder="0" />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Precio final</label>
                                                <MontoInput className={`${fieldClass} ${l.descuento > 0 ? 'border-jewelry-gold text-jewelry-gold' : ''}`}
                                                    value={l.final}
                                                    onCommit={v => cambiarPrecioFinal(l, v)} />
                                            </div>
                                        </div>
                                        {l.descuento > 0 && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs text-jewelry-gold">
                                                    −{(l.descuento / l.bruto * 100).toFixed(1)}%
                                                </span>
                                                <input className={`${fieldClass} flex-1 min-w-[200px] h-9`}
                                                    value={l.motivo}
                                                    onChange={e => actualizar(l.item.id, { motivo: e.target.value })}
                                                    placeholder="Motivo del descuento" list="motivos-descuento" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <datalist id="motivos-descuento">
                                    {MOTIVOS_RAPIDOS.map(m => <option key={m} value={m} />)}
                                </datalist>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ---------- Cobro ---------- */}
                <Card className="xl:sticky xl:top-24">
                    <CardContent className="pt-6 space-y-5">
                        <div>
                            <label className={labelClass}>Moneda de cobro</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['ARS', 'USD'].map(m => (
                                    <button key={m} onClick={() => cambiarMoneda(m)}
                                        className={`h-10 rounded-md border text-sm font-medium transition-colors ${moneda === m ? 'border-jewelry-gold bg-jewelry-gold text-jewelry-darker' : 'border-jewelry-gray text-jewelry-light hover:border-jewelry-gold'}`}>
                                        {m === 'ARS' ? 'Pesos (ARS)' : 'Dólares (USD)'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Medio de pago</label>
                            <select className={fieldClass} value={medioPago} onChange={e => setMedioPago(e.target.value)}>
                                {MEDIOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-[120px_1fr] gap-2">
                            <div>
                                <label className={labelClass}>Desc. general</label>
                                <input type="number" min="0" step="0.01" className={fieldClass} value={descuentoGeneral} onChange={e => setDescuentoGeneral(e.target.value)} placeholder="0" />
                            </div>
                            <div>
                                <label className={labelClass}>Motivo</label>
                                <input className={fieldClass} value={descuentoMotivo} onChange={e => setDescuentoMotivo(e.target.value)} placeholder="Ej. Pago contado efectivo" list="motivos-descuento" />
                            </div>
                        </div>

                        <div className="rounded-lg border border-jewelry-gray p-3 space-y-3">
                            <label className="flex items-center gap-2 text-sm text-jewelry-light cursor-pointer">
                                <input type="checkbox" checked={facturar} onChange={e => setFacturar(e.target.checked)} className="accent-jewelry-gold" />
                                Emitir factura electrónica (ARCA)
                            </label>
                            {facturar && (
                                <>
                                    <select className={fieldClass} value={cliente.condicionIva} onChange={e => setCliente({ ...cliente, condicionIva: e.target.value })}>
                                        {CONDICIONES_IVA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                    <div className="grid grid-cols-[90px_1fr] gap-2">
                                        <select className={fieldClass} value={necesitaCuit ? 'CUIT' : cliente.docTipo} disabled={necesitaCuit}
                                            onChange={e => setCliente({ ...cliente, docTipo: e.target.value })}>
                                            <option value="DNI">DNI</option>
                                            <option value="CUIT">CUIT</option>
                                        </select>
                                        <input className={fieldClass} value={cliente.docNro} onChange={e => setCliente({ ...cliente, docNro: e.target.value })}
                                            placeholder={necesitaCuit ? 'CUIT (obligatorio)' : 'Opcional'} />
                                    </div>
                                    <input className={fieldClass} value={cliente.nombre} onChange={e => setCliente({ ...cliente, nombre: e.target.value })} placeholder="Nombre / Razón social (opcional)" />
                                    {config && !config.arcaHabilitado && (
                                        <p className="text-xs text-amber-400/80">ARCA aún no está conectado: la factura quedará pendiente de emisión.</p>
                                    )}
                                </>
                            )}
                        </div>

                        <input className={fieldClass} value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Observaciones (opcional)" />

                        <div className="border-t border-jewelry-gray pt-4 space-y-1.5 text-sm">
                            <div className="flex justify-between text-jewelry-light/70"><span>Subtotal</span><span>{formatMoney(subtotal, moneda)}</span></div>
                            {descuentoTotal > 0 && (
                                <div className="flex justify-between text-jewelry-gold">
                                    <span>Descuentos ({porcentajeDesc.toFixed(1)}%)</span><span>−{formatMoney(descuentoTotal, moneda)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xl font-semibold text-jewelry-light pt-2">
                                <span>Total</span><span>{formatMoney(total, moneda)}</span>
                            </div>
                            {cot && (
                                <div className="flex justify-between text-xs text-jewelry-light/50">
                                    <span>Equivale a</span>
                                    <span>{formatMoney(convertir(total, moneda, moneda === 'ARS' ? 'USD' : 'ARS', cot), moneda === 'ARS' ? 'USD' : 'ARS')}</span>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
                                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
                            </div>
                        )}

                        <Button className="w-full h-12 text-base" onClick={confirmar} isLoading={saving}
                            disabled={saving || lineas.length === 0 || cajaAbierta === false || !cot}>
                            Confirmar venta
                        </Button>
                        {lineas.length > 0 && (
                            <button onClick={limpiar} className="w-full text-xs text-jewelry-light/40 hover:text-red-400">Vaciar venta</button>
                        )}
                        {!esGestion && <p className="text-[11px] text-jewelry-light/40 text-center">Los descuentos quedan registrados con su usuario.</p>}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PuntoVenta;
