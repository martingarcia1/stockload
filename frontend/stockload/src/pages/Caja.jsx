import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, HandCoins, Loader2, Lock, Scale, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import { fieldClass, labelClass } from '../components/selectStyles';
import { apiFetch, API_URL } from '../utils/api';
import { formatFechaHora, formatMoney, labelMedioPago, leerError } from '../utils/format';

const TIPOS = {
    Ingreso: { label: 'Ingreso', icon: ArrowDownCircle, color: 'text-emerald-400', signo: '+' },
    Gasto: { label: 'Gasto', icon: ArrowUpCircle, color: 'text-red-400', signo: '−' },
    Rendicion: { label: 'Rendición', icon: HandCoins, color: 'text-amber-400', signo: '−' },
};

const Diferencia = ({ valor, moneda }) => {
    const v = Number(valor || 0);
    if (Math.abs(v) < 0.005) return <span className="text-emerald-400">Sin diferencia</span>;
    return <span className={v > 0 ? 'text-sky-400' : 'text-red-400'}>{v > 0 ? 'Sobrante ' : 'Faltante '}{formatMoney(Math.abs(v), moneda)}</span>;
};

const Fila = ({ label, ars, usd, className = '' }) => (
    <tr className={className}>
        <td className="py-1.5 text-jewelry-light/70">{label}</td>
        <td className="py-1.5 text-right">{formatMoney(ars)}</td>
        <td className="py-1.5 text-right">{formatMoney(usd, 'USD')}</td>
    </tr>
);

const Caja = () => {
    const [estado, setEstado] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState('');

    const [apertura, setApertura] = useState({ ars: '', usd: '' });
    const [mov, setMov] = useState({ tipo: 'Gasto', moneda: 'ARS', monto: '', concepto: '', recibidoPor: '' });
    const [conteo, setConteo] = useState({ ars: '', usd: '', observaciones: '' });
    const [confirmarCierre, setConfirmarCierre] = useState(false);

    const cargar = useCallback(async () => {
        const [r1, r2] = await Promise.all([
            apiFetch(`${API_URL}/caja/actual`),
            apiFetch(`${API_URL}/caja/historial`)
        ]);
        if (r1.ok) setEstado(await r1.json());
        if (r2.ok) setHistorial(await r2.json());
        setLoading(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const enviar = async (clave, url, body, onOk) => {
        setSaving(clave); setError('');
        const res = await apiFetch(`${API_URL}/caja/${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        setSaving('');
        if (res.ok) {
            setEstado(await res.json());
            onOk?.();
            if (url === 'cerrar' || url === 'abrir') cargar();
        } else {
            setError(await leerError(res));
        }
    };

    if (loading) return <div className="flex justify-center py-20 text-jewelry-light/50"><Loader2 className="animate-spin" /></div>;

    const abierta = estado?.abierta;
    const r = estado?.resumen;
    const s = estado?.sesion;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">Caja</h2>
                <p className="text-jewelry-light/60 mt-1">
                    {abierta
                        ? <>Abierta el {formatFechaHora(s.fechaApertura)} por {s.usuarioApertura}</>
                        : 'No hay una caja abierta.'}
                </p>
            </div>

            {error && <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

            {!abierta && (
                <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wallet size={18} /> Abrir caja</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className={labelClass}>Fondo inicial ARS</label>
                            <input type="number" min="0" step="0.01" className={fieldClass} value={apertura.ars} onChange={e => setApertura({ ...apertura, ars: e.target.value })} placeholder="0" />
                        </div>
                        <div>
                            <label className={labelClass}>Fondo inicial USD</label>
                            <input type="number" min="0" step="0.01" className={fieldClass} value={apertura.usd} onChange={e => setApertura({ ...apertura, usd: e.target.value })} placeholder="0" />
                        </div>
                        <Button isLoading={saving === 'abrir'} onClick={() => enviar('abrir', 'abrir',
                            { fondoInicialArs: Number(apertura.ars || 0), fondoInicialUsd: Number(apertura.usd || 0) },
                            () => setApertura({ ars: '', usd: '' }))}>
                            Abrir caja
                        </Button>
                    </CardContent>
                </Card>
            )}

            {abierta && r && (
                <>
                    {/* ---------- Resumen de efectivo ---------- */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2">
                            <CardHeader className="pb-2"><CardTitle className="text-lg">Efectivo en caja</CardTitle></CardHeader>
                            <CardContent>
                                <table className="w-full text-sm">
                                    <thead className="text-xs uppercase text-jewelry-light/50">
                                        <tr><th className="text-left pb-2 font-medium">Concepto</th><th className="text-right pb-2 font-medium">Pesos</th><th className="text-right pb-2 font-medium">Dólares</th></tr>
                                    </thead>
                                    <tbody>
                                        <Fila label="Fondo inicial" ars={r.fondoInicialArs} usd={r.fondoInicialUsd} />
                                        <Fila label="+ Ventas en efectivo" ars={r.ventasEfectivoArs} usd={r.ventasEfectivoUsd} />
                                        <Fila label="+ Ingresos" ars={r.ingresosArs} usd={r.ingresosUsd} />
                                        <Fila label="− Gastos" ars={r.gastosArs} usd={r.gastosUsd} />
                                        <Fila label="− Rendiciones" ars={r.rendicionesArs} usd={r.rendicionesUsd} />
                                        <Fila label="Esperado en caja" ars={r.esperadoArs} usd={r.esperadoUsd} className="border-t border-jewelry-gray font-semibold text-jewelry-gold text-base" />
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-lg">Ventas del turno</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p className="text-jewelry-light/70">{r.cantidadVentas} ventas</p>
                                {[['ARS', r.ventasPorMedioArs], ['USD', r.ventasPorMedioUsd]].map(([mon, porMedio]) =>
                                    Object.entries(porMedio || {}).map(([medio, total]) => (
                                        <div key={mon + medio} className="flex justify-between">
                                            <span className="text-jewelry-light/70">{labelMedioPago(medio)} <span className="text-jewelry-light/40">{mon}</span></span>
                                            <span>{formatMoney(total, mon)}</span>
                                        </div>
                                    ))
                                )}
                                <p className="text-xs text-jewelry-light/40 pt-2">Sólo el efectivo suma a la caja; tarjetas y transferencias se informan aparte.</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* ---------- Movimientos ---------- */}
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-lg">Movimiento / Rendición</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.entries(TIPOS).map(([k, t]) => (
                                        <button key={k} onClick={() => setMov({ ...mov, tipo: k })}
                                            className={`h-10 rounded-md border text-sm flex items-center justify-center gap-1.5 ${mov.tipo === k ? 'border-jewelry-gold text-jewelry-gold bg-jewelry-gold/10' : 'border-jewelry-gray text-jewelry-light/70'}`}>
                                            <t.icon size={15} /> {t.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-[90px_1fr] gap-2">
                                    <select className={fieldClass} value={mov.moneda} onChange={e => setMov({ ...mov, moneda: e.target.value })}>
                                        <option>ARS</option><option>USD</option>
                                    </select>
                                    <input type="number" min="0" step="0.01" className={fieldClass} value={mov.monto} onChange={e => setMov({ ...mov, monto: e.target.value })} placeholder="Monto" />
                                </div>
                                <input className={fieldClass} value={mov.concepto} onChange={e => setMov({ ...mov, concepto: e.target.value })}
                                    placeholder={mov.tipo === 'Rendicion' ? 'Ej. Rendición de mediodía' : mov.tipo === 'Gasto' ? 'Ej. Artículos de limpieza' : 'Ej. Cambio traído por el propietario'} />
                                {mov.tipo === 'Rendicion' && (
                                    <input className={fieldClass} value={mov.recibidoPor} onChange={e => setMov({ ...mov, recibidoPor: e.target.value })} placeholder="¿Quién recibe el dinero?" />
                                )}
                                <Button className="w-full" isLoading={saving === 'mov'} disabled={!mov.monto || !mov.concepto}
                                    onClick={() => enviar('mov', 'movimientos', { ...mov, monto: Number(mov.monto) },
                                        () => setMov({ ...mov, monto: '', concepto: '', recibidoPor: '' }))}>
                                    Registrar {TIPOS[mov.tipo].label.toLowerCase()}
                                </Button>

                                {estado.movimientos.length > 0 && (
                                    <div className="pt-3 border-t border-jewelry-gray divide-y divide-jewelry-gray/50 text-sm max-h-72 overflow-y-auto">
                                        {estado.movimientos.map(m => {
                                            const t = TIPOS[m.tipo];
                                            return (
                                                <div key={m.id} className="py-2 flex justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-jewelry-light truncate"><t.icon size={13} className={`inline mr-1 ${t.color}`} />{m.concepto}</p>
                                                        <p className="text-xs text-jewelry-light/50">
                                                            {formatFechaHora(m.fecha)} · {m.usuario}{m.recibidoPor && <> · recibió {m.recibidoPor}</>}
                                                        </p>
                                                    </div>
                                                    <span className={`${t.color} whitespace-nowrap`}>{t.signo}{formatMoney(m.monto, m.moneda)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* ---------- Arqueo y cierre ---------- */}
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Scale size={18} /> Arqueo y cierre</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-jewelry-light/60">Cuente el efectivo físico y compárelo con lo esperado. Puede hacer arqueos parciales durante el día.</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelClass}>Contado ARS</label>
                                        <input type="number" min="0" step="0.01" className={fieldClass} value={conteo.ars} onChange={e => setConteo({ ...conteo, ars: e.target.value })} placeholder={String(r.esperadoArs)} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Contado USD</label>
                                        <input type="number" min="0" step="0.01" className={fieldClass} value={conteo.usd} onChange={e => setConteo({ ...conteo, usd: e.target.value })} placeholder={String(r.esperadoUsd)} />
                                    </div>
                                </div>
                                {(conteo.ars !== '' || conteo.usd !== '') && (
                                    <div className="text-sm space-y-0.5">
                                        <p>Pesos: <Diferencia valor={Number(conteo.ars || 0) - r.esperadoArs} moneda="ARS" /></p>
                                        <p>Dólares: <Diferencia valor={Number(conteo.usd || 0) - r.esperadoUsd} moneda="USD" /></p>
                                    </div>
                                )}
                                <input className={fieldClass} value={conteo.observaciones} onChange={e => setConteo({ ...conteo, observaciones: e.target.value })} placeholder="Observaciones (ej. explicación de la diferencia)" />

                                {!confirmarCierre ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button variant="outline" isLoading={saving === 'arqueo'} disabled={conteo.ars === '' && conteo.usd === ''}
                                            onClick={() => enviar('arqueo', 'arqueo',
                                                { contadoArs: Number(conteo.ars || 0), contadoUsd: Number(conteo.usd || 0), observaciones: conteo.observaciones },
                                                () => setConteo({ ars: '', usd: '', observaciones: '' }))}>
                                            Arqueo parcial
                                        </Button>
                                        <Button disabled={conteo.ars === '' && conteo.usd === ''} onClick={() => setConfirmarCierre(true)} className="gap-1.5">
                                            <Lock size={15} /> Cerrar caja
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-jewelry-gold/40 p-3 space-y-2">
                                        <p className="text-sm text-jewelry-light">¿Cerrar la caja con {formatMoney(conteo.ars || 0)} y {formatMoney(conteo.usd || 0, 'USD')} contados? No se podrán registrar más ventas hasta abrir una nueva.</p>
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => setConfirmarCierre(false)}>Cancelar</Button>
                                            <Button size="sm" isLoading={saving === 'cerrar'}
                                                onClick={() => enviar('cerrar', 'cerrar',
                                                    { contadoArs: Number(conteo.ars || 0), contadoUsd: Number(conteo.usd || 0), observaciones: conteo.observaciones },
                                                    () => { setConteo({ ars: '', usd: '', observaciones: '' }); setConfirmarCierre(false); })}>
                                                Confirmar cierre
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {estado.arqueos.length > 0 && (
                                    <div className="pt-3 border-t border-jewelry-gray divide-y divide-jewelry-gray/50 text-sm">
                                        {estado.arqueos.map(a => (
                                            <div key={a.id} className="py-2">
                                                <p className="text-xs text-jewelry-light/50">{formatFechaHora(a.fecha)} · {a.usuario} {a.esCierre && '· CIERRE'}</p>
                                                <p>ARS: <Diferencia valor={a.diferenciaArs} moneda="ARS" /> · USD: <Diferencia valor={a.diferenciaUsd} moneda="USD" /></p>
                                                {a.observaciones && <p className="text-xs text-jewelry-light/60">{a.observaciones}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

            {/* ---------- Historial de cierres ---------- */}
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-lg">Historial de cajas</CardTitle></CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs uppercase text-jewelry-light/50 border-b border-jewelry-gray">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium">Apertura</th>
                                <th className="px-6 py-3 text-left font-medium">Cierre</th>
                                <th className="px-6 py-3 text-right font-medium">Esperado</th>
                                <th className="px-6 py-3 text-right font-medium">Contado</th>
                                <th className="px-6 py-3 text-left font-medium">Diferencia</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-jewelry-gray/50">
                            {historial.filter(h => !h.abierta).length === 0 && (
                                <tr><td colSpan={5} className="py-8 text-center text-jewelry-light/40">Todavía no hay cierres registrados.</td></tr>
                            )}
                            {historial.filter(h => !h.abierta).map(h => (
                                <tr key={h.id}>
                                    <td className="px-6 py-3 whitespace-nowrap">{formatFechaHora(h.fechaApertura)}<br /><span className="text-xs text-jewelry-light/50">{h.usuarioApertura}</span></td>
                                    <td className="px-6 py-3 whitespace-nowrap">{formatFechaHora(h.fechaCierre)}<br /><span className="text-xs text-jewelry-light/50">{h.usuarioCierre}</span></td>
                                    <td className="px-6 py-3 text-right whitespace-nowrap">{formatMoney(h.esperadoArs)}<br /><span className="text-jewelry-light/60">{formatMoney(h.esperadoUsd, 'USD')}</span></td>
                                    <td className="px-6 py-3 text-right whitespace-nowrap">{formatMoney(h.contadoArs)}<br /><span className="text-jewelry-light/60">{formatMoney(h.contadoUsd, 'USD')}</span></td>
                                    <td className="px-6 py-3">
                                        <Diferencia valor={(h.contadoArs ?? 0) - (h.esperadoArs ?? 0)} moneda="ARS" /><br />
                                        <Diferencia valor={(h.contadoUsd ?? 0) - (h.esperadoUsd ?? 0)} moneda="USD" />
                                        {h.observacionesCierre && <p className="text-xs text-jewelry-light/50">{h.observacionesCierre}</p>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default Caja;
