import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import ComprobanteModal from '../components/ComprobanteModal';
import useCondicionesIva from '../hooks/useCondicionesIva';
import { CLIENTE_VACIO, TIPOS_DOC } from '../utils/factura';
import { fieldClass, labelClass } from '../components/selectStyles';
import { apiFetch, API_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatFecha, formatMoney, hoyISO, leerError } from '../utils/format';

const primeroDelMes = () => `${hoyISO().slice(0, 8)}01`;

const Campo = ({ label, ayuda, className = '', children }) => (
    <div className={className}>
        <label className={labelClass}>{label}</label>
        {children}
        {ayuda && <p className="text-xs text-jewelry-light/40 mt-1">{ayuda}</p>}
    </div>
);

const Mensaje = ({ msg }) => msg?.texto ? (
    <div className={`p-3 rounded-md text-sm ${msg.tipo === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{msg.texto}</div>
) : null;

// =====================================================================
// Facturas
// =====================================================================

const TabFacturas = ({ esGestion }) => {
    const [desde, setDesde] = useState(primeroDelMes());
    const [hasta, setHasta] = useState(hoyISO());
    const [datos, setDatos] = useState(null);
    const [recarga, setRecarga] = useState(0);
    const [error, setError] = useState('');
    const [viendo, setViendo] = useState(null);
    const [anulando, setAnulando] = useState(null);
    const [procesando, setProcesando] = useState(false);
    const loading = datos === null;

    useEffect(() => {
        let cancelado = false;
        apiFetch(`${API_URL}/facturacion/facturas?desde=${desde}&hasta=${hasta}`).then(async r => {
            if (cancelado) return;
            if (r.ok) { setDatos(await r.json()); setError(''); }
            else setError(await leerError(r));
        });
        return () => { cancelado = true; };
    }, [desde, hasta, recarga]);

    const anular = async () => {
        setProcesando(true); setError('');
        const r = await apiFetch(`${API_URL}/facturacion/facturas/${anulando.id}/anular`, { method: 'POST' });
        setProcesando(false);
        if (r.ok) {
            const nota = await r.json();
            setAnulando(null);
            setRecarga(n => n + 1);
            setViendo({ comprobante: nota });
        } else {
            setError(await leerError(r, 'No se pudo anular la factura'));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex gap-3">
                    <Campo label="Desde"><input type="date" className={fieldClass} value={desde} onChange={e => setDesde(e.target.value)} /></Campo>
                    <Campo label="Hasta"><input type="date" className={fieldClass} value={hasta} onChange={e => setHasta(e.target.value)} /></Campo>
                </div>
                {datos && (
                    <p className="text-sm text-jewelry-light/70">
                        {datos.cantidad} comprobante{datos.cantidad === 1 ? '' : 's'} · neto facturado{' '}
                        <span className="text-lg font-semibold text-jewelry-gold">{formatMoney(datos.neto)}</span>
                    </p>
                )}
            </div>

            {error && <Mensaje msg={{ tipo: 'error', texto: error }} />}

            {anulando && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                    <p className="text-sm text-jewelry-light">
                        Se va a emitir una <strong>Nota de crédito C</strong> por {formatMoney(anulando.total)} que anula la{' '}
                        {anulando.tipoNombre} {anulando.numeroFormateado}. Esto no se puede deshacer.
                    </p>
                    <p className="text-xs text-jewelry-light/50">La venta queda sin factura: después se puede volver a facturar o anular la venta.</p>
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setAnulando(null)} disabled={procesando}>Cancelar</Button>
                        <Button variant="danger" size="sm" onClick={anular} isLoading={procesando}>Emitir nota de crédito</Button>
                    </div>
                </div>
            )}

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-jewelry-gray/30 text-xs uppercase text-jewelry-light/60">
                            <tr>
                                <th className="px-5 py-3 text-left font-medium">Comprobante</th>
                                <th className="px-5 py-3 text-left font-medium">Fecha</th>
                                <th className="px-5 py-3 text-left font-medium">Cliente</th>
                                <th className="px-5 py-3 text-right font-medium">Total</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-jewelry-gray/50">
                            {loading && (
                                <tr><td colSpan={5} className="py-12 text-center text-jewelry-light/50"><Loader2 className="animate-spin inline" /></td></tr>
                            )}
                            {!loading && datos?.data.length === 0 && (
                                <tr><td colSpan={5} className="py-12 text-center text-jewelry-light/50">No hay comprobantes en estas fechas.</td></tr>
                            )}
                            {!loading && datos?.data.map(f => {
                                const esNota = f.tipo === 13;
                                return (
                                    <tr key={f.id} className="hover:bg-jewelry-gray/10">
                                        <td className="px-5 py-3">
                                            <p className={`font-semibold ${esNota ? 'text-amber-300' : 'text-jewelry-light'}`}>
                                                {f.tipoNombre} {f.numeroFormateado}
                                                {f.estado === 'Anulada' && <span className="ml-2 px-2 py-0.5 rounded text-xs font-normal bg-red-500/10 text-red-400">Anulada</span>}
                                            </p>
                                            <p className="text-xs text-jewelry-light/50">CAE {f.cae}{f.esPrueba && ' · prueba'} · venta #{f.ventaId}</p>
                                        </td>
                                        <td className="px-5 py-3 text-jewelry-light/80">{formatFecha(f.fecha)}</td>
                                        <td className="px-5 py-3">
                                            <p className="text-jewelry-light">{f.receptorNombre || '-'}</p>
                                            {f.receptorDoc && <p className="text-xs text-jewelry-light/50">{f.receptorDoc}</p>}
                                        </td>
                                        <td className={`px-5 py-3 text-right font-semibold ${esNota ? 'text-amber-300' : 'text-jewelry-light'}`}>
                                            {esNota ? '−' : ''}{formatMoney(f.total)}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => setViendo({ facturaId: f.id })}>Ver</Button>
                                                {esGestion && !esNota && f.estado === 'Emitida' && (
                                                    <Button variant="danger" size="sm" onClick={() => setAnulando(f)}>Anular</Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {viendo && <ComprobanteModal {...viendo} onClose={() => setViendo(null)} />}
        </div>
    );
};

// =====================================================================
// Clientes
// =====================================================================

const TabClientes = ({ esGestion }) => {
    const condiciones = useCondicionesIva();
    const [q, setQ] = useState('');
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editando, setEditando] = useState(null); // { id?, ...campos }
    const [guardando, setGuardando] = useState(false);
    const [msg, setMsg] = useState(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        const r = await apiFetch(`${API_URL}/facturacion/clientes?q=${encodeURIComponent(q)}`);
        setLoading(false);
        if (r.ok) setClientes(await r.json());
    }, [q]);

    useEffect(() => {
        const t = setTimeout(cargar, 250);
        return () => clearTimeout(t);
    }, [cargar]);

    const set = (k, v) => setEditando(prev => ({ ...prev, [k]: v }));

    const guardar = async () => {
        setGuardando(true); setMsg(null);
        const { id, ...datos } = editando;
        const r = await apiFetch(`${API_URL}/facturacion/clientes${id ? `/${id}` : ''}`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...datos, docTipo: Number(datos.docTipo), condicionIvaId: Number(datos.condicionIvaId) }),
        });
        setGuardando(false);
        if (r.ok) { setEditando(null); setMsg({ tipo: 'ok', texto: 'Cliente guardado.' }); cargar(); }
        else setMsg({ tipo: 'error', texto: await leerError(r) });
    };

    const borrar = async (c) => {
        if (!window.confirm(`¿Borrar a ${c.nombre}? Las facturas ya emitidas conservan sus datos.`)) return;
        const r = await apiFetch(`${API_URL}/facturacion/clientes/${c.id}`, { method: 'DELETE' });
        if (r.ok) cargar();
        else setMsg({ tipo: 'error', texto: await leerError(r) });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3 justify-between">
                <input className={`${fieldClass} max-w-sm`} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, CUIT o DNI..." />
                <Button onClick={() => { setEditando({ ...CLIENTE_VACIO }); setMsg(null); }} className="gap-2"><Plus size={16} /> Nuevo cliente</Button>
            </div>

            <Mensaje msg={msg} />

            {editando && (
                <Card>
                    <CardHeader className="flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-lg">{editando.id ? 'Editar cliente' : 'Nuevo cliente'}</CardTitle>
                        <button onClick={() => setEditando(null)} className="text-jewelry-light/50 hover:text-jewelry-light"><X size={18} /></button>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Campo label="Documento">
                            <div className="grid grid-cols-[100px_1fr] gap-2">
                                <select className={fieldClass} value={editando.docTipo} onChange={e => set('docTipo', Number(e.target.value))}>
                                    {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <input className={fieldClass} value={editando.docNro} onChange={e => set('docNro', e.target.value)} />
                            </div>
                        </Campo>
                        <Campo label="Nombre o razón social"><input className={fieldClass} value={editando.nombre} onChange={e => set('nombre', e.target.value)} /></Campo>
                        <Campo label="Condición frente al IVA">
                            <select className={fieldClass} value={editando.condicionIvaId} onChange={e => set('condicionIvaId', Number(e.target.value))}>
                                {condiciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </Campo>
                        <Campo label="Teléfono (WhatsApp)"><input className={fieldClass} value={editando.telefono || ''} onChange={e => set('telefono', e.target.value)} /></Campo>
                        <Campo label="Domicilio" className="md:col-span-2"><input className={fieldClass} value={editando.domicilio || ''} onChange={e => set('domicilio', e.target.value)} /></Campo>
                        <div className="md:col-span-2 flex justify-end">
                            <Button onClick={guardar} isLoading={guardando} className="gap-2"><Save size={16} /> Guardar</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-jewelry-gray/30 text-xs uppercase text-jewelry-light/60">
                        <tr>
                            <th className="px-5 py-3 text-left font-medium">Cliente</th>
                            <th className="px-5 py-3 text-left font-medium">Documento</th>
                            <th className="px-5 py-3 text-left font-medium">Condición IVA</th>
                            <th className="px-5 py-3 text-left font-medium">Teléfono</th>
                            <th className="px-5 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-jewelry-gray/50">
                        {loading && clientes.length === 0 && (
                            <tr><td colSpan={5} className="py-10 text-center text-jewelry-light/50"><Loader2 className="animate-spin inline" /></td></tr>
                        )}
                        {!loading && clientes.length === 0 && (
                            <tr><td colSpan={5} className="py-10 text-center text-jewelry-light/50">Todavía no hay clientes guardados.</td></tr>
                        )}
                        {clientes.map(c => (
                            <tr key={c.id} className="hover:bg-jewelry-gray/10">
                                <td className="px-5 py-3 text-jewelry-light font-medium">{c.nombre}</td>
                                <td className="px-5 py-3 text-jewelry-light/80">{c.docTipoNombre} {c.docNro}</td>
                                <td className="px-5 py-3 text-jewelry-light/80">{c.condicionIva}</td>
                                <td className="px-5 py-3 text-jewelry-light/80">{c.telefono || '-'}</td>
                                <td className="px-5 py-3">
                                    {esGestion && (
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" title="Editar" onClick={() => { setEditando({ ...c }); setMsg(null); }}><Pencil size={15} /></Button>
                                            <Button variant="ghost" size="icon" title="Borrar" onClick={() => borrar(c)}><Trash2 size={15} /></Button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
};

// =====================================================================
// Datos fiscales y conexión con ARCA
// =====================================================================

const TabDatosFiscales = () => {
    const [d, setD] = useState(null);
    const [estado, setEstado] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [probando, setProbando] = useState(false);
    const [msg, setMsg] = useState(null);

    const cargarEstado = async (probar = false) => {
        const r = await apiFetch(`${API_URL}/facturacion/estado${probar ? '?probar=true' : ''}`);
        if (r.ok) setEstado(await r.json());
    };

    useEffect(() => {
        apiFetch(`${API_URL}/facturacion/datos`).then(async r => r.ok && setD(await r.json()));
        apiFetch(`${API_URL}/facturacion/estado`).then(async r => r.ok && setEstado(await r.json()));
    }, []);

    const set = (k, v) => setD(prev => ({ ...prev, [k]: v }));

    const guardar = async () => {
        setGuardando(true); setMsg(null);
        const r = await apiFetch(`${API_URL}/facturacion/datos`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...d, puntoVenta: Number(d.puntoVenta), inicioActividades: d.inicioActividades || null }),
        });
        setGuardando(false);
        if (r.ok) { setD(await r.json()); setMsg({ tipo: 'ok', texto: 'Datos guardados.' }); cargarEstado(); }
        else setMsg({ tipo: 'error', texto: await leerError(r) });
    };

    const probar = async () => {
        setProbando(true);
        await cargarEstado(true);
        setProbando(false);
    };

    if (!d) return <div className="flex justify-center py-20 text-jewelry-light/50"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
            <Card>
                <CardHeader><CardTitle className="text-lg">Lo que sale impreso en la factura</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Campo label="Nombre o razón social"><input className={fieldClass} value={d.razonSocial || ''} onChange={e => set('razonSocial', e.target.value)} /></Campo>
                    <Campo label="CUIT" ayuda={d.cuitDelCertificado ? 'Sale del certificado de ARCA' : 'Se tomará del certificado cuando esté cargado'}>
                        <input className={fieldClass} value={d.cuit || ''} onChange={e => set('cuit', e.target.value)} disabled={d.cuitDelCertificado} />
                    </Campo>
                    <Campo label="Domicilio comercial" ayuda="El del punto de venta en ARCA" className="md:col-span-2">
                        <input className={fieldClass} value={d.domicilioComercial || ''} onChange={e => set('domicilioComercial', e.target.value)} />
                    </Campo>
                    <Campo label="Ingresos Brutos" ayuda="Convenio Multilateral: el número de inscripción">
                        <input className={fieldClass} value={d.ingresosBrutos || ''} onChange={e => set('ingresosBrutos', e.target.value)} />
                    </Campo>
                    <Campo label="Inicio de actividades">
                        <input type="date" className={fieldClass} value={d.inicioActividades ? d.inicioActividades.slice(0, 10) : ''} onChange={e => set('inicioActividades', e.target.value)} />
                    </Campo>
                    <Campo label="Condición frente al IVA"><input className={fieldClass} value={d.condicionIva} disabled /></Campo>
                    <Campo label="Punto de venta" ayuda="El de Web Services en ARCA">
                        <input type="number" min="1" className={fieldClass} value={d.puntoVenta} onChange={e => set('puntoVenta', e.target.value)} />
                    </Campo>
                    <Campo label="Mensaje al pie del ticket" className="md:col-span-2">
                        <input className={fieldClass} value={d.mensajePie || ''} onChange={e => set('mensajePie', e.target.value)} placeholder="¡Gracias por su compra!" />
                    </Campo>
                    <div className="md:col-span-2 flex items-center justify-end gap-4">
                        <Mensaje msg={msg} />
                        <Button onClick={guardar} isLoading={guardando} className="gap-2"><Save size={16} /> Guardar datos</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-lg">Conexión con ARCA</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                    {!estado ? <Loader2 className="animate-spin text-jewelry-light/50" /> : (
                        <>
                            <div className="flex items-center gap-2 text-jewelry-light">
                                Entorno:
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${estado.esProduccion
                                    ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                    {estado.esProduccion ? 'Producción' : 'Pruebas (sin validez fiscal)'}
                                </span>
                            </div>
                            {estado.certificado.cargado ? (
                                <p className="text-emerald-400">
                                    Certificado cargado{estado.certificado.cuit && ` (CUIT ${estado.certificado.cuit})`}.
                                    {estado.certificado.vence && <span className="text-jewelry-light/50"> Vence el {formatFecha(estado.certificado.vence)}.</span>}
                                </p>
                            ) : (
                                <p className="text-amber-400">{estado.certificado.error}</p>
                            )}
                            <Button variant="outline" className="w-full" onClick={probar} isLoading={probando}>Probar conexión</Button>
                            {estado.prueba && (
                                <ul className={`space-y-1 rounded-md p-3 ${estado.prueba.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                                    {estado.prueba.pasos.map((p, i) => <li key={i}>{p}</li>)}
                                </ul>
                            )}
                            <p className="text-xs text-jewelry-light/40">
                                El entorno y el certificado se configuran en el servidor (Arca:Entorno y la carpeta arca/&lt;entorno&gt;/ del backend).
                            </p>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

// =====================================================================

const Facturacion = () => {
    const { esGestion } = useAuth();
    const [tab, setTab] = useState('facturas');

    const tabs = [
        { id: 'facturas', label: 'Facturas' },
        { id: 'clientes', label: 'Clientes' },
        ...(esGestion ? [{ id: 'datos', label: 'Datos fiscales' }] : []),
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">Facturación</h2>
                <p className="text-jewelry-light/60 mt-1">Facturas C emitidas en ARCA, clientes guardados y datos fiscales.</p>
            </div>

            <div className="flex gap-2">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id
                            ? 'bg-jewelry-gold text-jewelry-darker'
                            : 'bg-jewelry-gray/40 text-jewelry-light hover:bg-jewelry-gray'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'facturas' && <TabFacturas esGestion={esGestion} />}
            {tab === 'clientes' && <TabClientes esGestion={esGestion} />}
            {tab === 'datos' && esGestion && <TabDatosFiscales />}
        </div>
    );
};

export default Facturacion;
