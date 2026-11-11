import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileDown, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import { fieldClass } from '../components/selectStyles';
import { apiFetch, API_URL } from '../utils/api';
import { ESTADOS_FACTURA, formatFechaHora, formatMoney, hoyISO, labelMedioPago, leerError } from '../utils/format';

const Stat = ({ label, value, sub }) => (
    <Card>
        <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase tracking-wide text-jewelry-light/50">{label}</p>
            <p className="text-2xl font-semibold text-jewelry-light mt-1">{value}</p>
            {sub && <p className="text-xs text-jewelry-light/50 mt-1">{sub}</p>}
        </CardContent>
    </Card>
);

const dif = (contado, esperado) => Number(contado ?? 0) - Number(esperado ?? 0);
const textoDif = (v, m) => Math.abs(v) < 0.005 ? 'OK' : `${v > 0 ? 'Sobrante' : 'Faltante'} ${formatMoney(Math.abs(v), m)}`;
const claseDif = (v) => Math.abs(v) < 0.005 ? 'text-emerald-400' : v > 0 ? 'text-sky-400' : 'text-red-400';

const moverFecha = (iso, dias) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
};

const ArqueoDiario = () => {
    const [fecha, setFecha] = useState(hoyISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const cargar = useCallback(async () => {
        setLoading(true); setError('');
        const res = await apiFetch(`${API_URL}/reportes/diario?fecha=${fecha}`);
        if (res.ok) setData(await res.json());
        else setError(await leerError(res, 'No se pudo cargar el reporte'));
        setLoading(false);
    }, [fecha]);

    useEffect(() => { cargar(); }, [cargar]);

    const exportarPdf = () => {
        if (!data) return;
        const doc = new jsPDF();
        const fechaTxt = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR');
        const head = { fillColor: [24, 24, 27] };
        doc.setFontSize(16);
        doc.text(`Arqueo diario - ${fechaTxt}`, 14, 18);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, 14, 24);

        const t = data.totales;
        autoTable(doc, {
            startY: 30, theme: 'grid', headStyles: head,
            head: [['Ventas', 'Anuladas', 'Unidades', 'Total ARS', 'Total USD', 'Equivalente ARS']],
            body: [[t.cantidadVentas, t.ventasAnuladas, t.unidadesVendidas, formatMoney(t.totalArs), formatMoney(t.totalUsd, 'USD'), formatMoney(t.totalEquivalenteArs)]]
        });
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 6, theme: 'grid', headStyles: head,
            head: [['Medio de pago', 'Moneda', 'Cant.', 'Total']],
            body: data.porMedio.map(p => [labelMedioPago(p.medioPago), p.moneda, p.cantidad, formatMoney(p.total, p.moneda)])
        });
        if (data.descuentos.length) {
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 6, theme: 'grid', headStyles: head,
                head: [['Venta', 'Hora', 'Usuario', 'Lista', 'Descuento', '%', 'Motivo']],
                body: data.descuentos.map(d => [`#${d.ventaId}`, new Date(d.fecha).toLocaleTimeString('es-AR', { timeStyle: 'short' }), d.usuario,
                    formatMoney(d.subtotal, d.moneda), formatMoney(d.descuento, d.moneda), `${d.porcentaje}%`, d.motivos.join('; ')])
            });
        }
        if (data.egresos.length) {
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 6, theme: 'grid', headStyles: head,
                head: [['Hora', 'Producto', 'Cant.', 'Valor lista', 'Motivo', 'Usuario']],
                body: data.egresos.map(e => [new Date(e.fecha).toLocaleTimeString('es-AR', { timeStyle: 'short' }), e.producto || '-',
                    e.cantidad, formatMoney(e.precio * e.cantidad, e.moneda), e.motivo + (e.observaciones ? ` (${e.observaciones})` : ''), e.usuario || '-'])
            });
        }
        data.cajas.forEach(c => {
            const s = c.sesion, r = c.resumen;
            const contArs = s.abierta ? '-' : formatMoney(s.contadoArs);
            const contUsd = s.abierta ? '-' : formatMoney(s.contadoUsd, 'USD');
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 6, theme: 'grid', headStyles: head,
                head: [[`Caja #${s.id} (${s.abierta ? 'abierta' : 'cerrada'})`, 'ARS', 'USD']],
                body: [
                    ['Fondo inicial', formatMoney(r.fondoInicialArs), formatMoney(r.fondoInicialUsd, 'USD')],
                    ['Ventas en efectivo', formatMoney(r.ventasEfectivoArs), formatMoney(r.ventasEfectivoUsd, 'USD')],
                    ['Ingresos', formatMoney(r.ingresosArs), formatMoney(r.ingresosUsd, 'USD')],
                    ['Gastos', formatMoney(r.gastosArs), formatMoney(r.gastosUsd, 'USD')],
                    ['Rendiciones', formatMoney(r.rendicionesArs), formatMoney(r.rendicionesUsd, 'USD')],
                    ['Esperado', formatMoney(s.abierta ? r.esperadoArs : s.esperadoArs), formatMoney(s.abierta ? r.esperadoUsd : s.esperadoUsd, 'USD')],
                    ['Contado', contArs, contUsd],
                    ...(s.abierta ? [] : [['Diferencia', textoDif(dif(s.contadoArs, s.esperadoArs), 'ARS'), textoDif(dif(s.contadoUsd, s.esperadoUsd), 'USD')]])
                ]
            });
            if (c.movimientos.length) {
                autoTable(doc, {
                    startY: doc.lastAutoTable.finalY + 2, theme: 'grid', headStyles: head,
                    head: [['Hora', 'Tipo', 'Concepto', 'Usuario', 'Monto']],
                    body: c.movimientos.map(m => [new Date(m.fecha).toLocaleTimeString('es-AR', { timeStyle: 'short' }), m.tipo,
                        m.concepto + (m.recibidoPor ? ` (recibió ${m.recibidoPor})` : ''), m.usuario, formatMoney(m.monto, m.moneda)])
                });
            }
        });
        doc.save(`Arqueo_${fecha}.pdf`);
    };

    const t = data?.totales;

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">Arqueo Diario</h2>
                    <p className="text-jewelry-light/60 mt-1">Resumen de ventas, descuentos y caja del día.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setFecha(f => moverFecha(f, -1))} aria-label="Día anterior"><ChevronLeft size={18} /></Button>
                    <input type="date" className={`${fieldClass} w-40`} value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} />
                    <Button variant="ghost" size="icon" onClick={() => setFecha(f => moverFecha(f, 1))} aria-label="Día siguiente"><ChevronRight size={18} /></Button>
                    <Button variant="outline" onClick={exportarPdf} disabled={!data} className="gap-2 ml-2"><FileDown size={16} /> PDF</Button>
                </div>
            </div>

            {error && <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

            {loading || !data ? (
                <div className="flex justify-center py-20 text-jewelry-light/50"><Loader2 className="animate-spin" /></div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Stat label="Ventas" value={t.cantidadVentas} sub={`${t.unidadesVendidas} unidades${t.ventasAnuladas ? ` · ${t.ventasAnuladas} anuladas` : ''}`} />
                        <Stat label="Cobrado en pesos" value={formatMoney(t.totalArs)} />
                        <Stat label="Cobrado en dólares" value={formatMoney(t.totalUsd, 'USD')} />
                        <Stat label="Descuentos otorgados" value={formatMoney(t.descuentosArs)}
                            sub={t.descuentosUsd > 0 ? `+ ${formatMoney(t.descuentosUsd, 'USD')}` : `${data.descuentos.length} ventas con descuento`} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-lg">Por medio de pago</CardTitle></CardHeader>
                            <CardContent>
                                {data.porMedio.length === 0 ? <p className="text-sm text-jewelry-light/40">Sin ventas.</p> : (
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-jewelry-gray/50">
                                            {data.porMedio.map(p => (
                                                <tr key={p.medioPago + p.moneda}>
                                                    <td className="py-2">{labelMedioPago(p.medioPago)} <span className="text-jewelry-light/40">{p.moneda}</span></td>
                                                    <td className="py-2 text-jewelry-light/50 text-right">{p.cantidad}</td>
                                                    <td className="py-2 text-right font-medium">{formatMoney(p.total, p.moneda)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-lg">Por vendedor</CardTitle></CardHeader>
                            <CardContent>
                                {data.porVendedor.length === 0 ? <p className="text-sm text-jewelry-light/40">Sin ventas.</p> : (
                                    <table className="w-full text-sm">
                                        <thead className="text-xs uppercase text-jewelry-light/50"><tr><th className="text-left pb-2 font-medium">Usuario</th><th className="text-right pb-2 font-medium">Ventas</th><th className="text-right pb-2 font-medium">Total (ARS)</th><th className="text-right pb-2 font-medium">Descuentos (ARS)</th></tr></thead>
                                        <tbody className="divide-y divide-jewelry-gray/50">
                                            {data.porVendedor.map(v => (
                                                <tr key={v.usuario}>
                                                    <td className="py-2 truncate">{v.usuario}</td>
                                                    <td className="py-2 text-right text-jewelry-light/60">{v.cantidad}</td>
                                                    <td className="py-2 text-right">{formatMoney(v.totalArs)}</td>
                                                    <td className="py-2 text-right text-jewelry-gold">{formatMoney(v.descuentoArs)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                                {Object.keys(data.facturacion).length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-4">
                                        {Object.entries(data.facturacion).map(([k, n]) => (
                                            <span key={k} className={`px-2 py-0.5 rounded text-xs ${ESTADOS_FACTURA[k]?.className}`}>{ESTADOS_FACTURA[k]?.label || k}: {n}</span>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-lg">Descuentos aplicados</CardTitle></CardHeader>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-jewelry-light/50 border-b border-jewelry-gray">
                                    <tr>
                                        <th className="px-6 py-3 text-left font-medium">Venta</th>
                                        <th className="px-6 py-3 text-left font-medium">Usuario</th>
                                        <th className="px-6 py-3 text-right font-medium">Precio lista</th>
                                        <th className="px-6 py-3 text-right font-medium">Descuento</th>
                                        <th className="px-6 py-3 text-right font-medium">Cobrado</th>
                                        <th className="px-6 py-3 text-left font-medium">Motivo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-jewelry-gray/50">
                                    {data.descuentos.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-jewelry-light/40">No hubo descuentos.</td></tr>}
                                    {data.descuentos.map(d => (
                                        <tr key={d.ventaId}>
                                            <td className="px-6 py-3 whitespace-nowrap">#{d.ventaId} <span className="text-jewelry-light/50">{formatFechaHora(d.fecha)}</span></td>
                                            <td className="px-6 py-3">{d.usuario}</td>
                                            <td className="px-6 py-3 text-right whitespace-nowrap">{formatMoney(d.subtotal, d.moneda)}</td>
                                            <td className="px-6 py-3 text-right text-jewelry-gold whitespace-nowrap">−{formatMoney(d.descuento, d.moneda)} <span className="text-xs">({d.porcentaje}%)</span></td>
                                            <td className="px-6 py-3 text-right whitespace-nowrap">{formatMoney(d.total, d.moneda)} <span className="text-xs text-jewelry-light/50">{labelMedioPago(d.medioPago)}</span></td>
                                            <td className="px-6 py-3 text-jewelry-light/70">{d.motivos.join(' · ') || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {data.cajas.length === 0 ? (
                        <Card><CardContent className="pt-6 text-sm text-jewelry-light/40">No se abrió caja este día.</CardContent></Card>
                    ) : data.cajas.map(c => {
                        const s = c.sesion, r = c.resumen;
                        const esperadoArs = s.abierta ? r.esperadoArs : s.esperadoArs;
                        const esperadoUsd = s.abierta ? r.esperadoUsd : s.esperadoUsd;
                        return (
                            <Card key={s.id}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">Caja #{s.id} {s.abierta ? <span className="text-sm text-emerald-400 font-normal">(abierta)</span> : <span className="text-sm text-jewelry-light/50 font-normal">(cerrada {formatFechaHora(s.fechaCierre)} por {s.usuarioCierre})</span>}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
                                    <table className="w-full">
                                        <thead className="text-xs uppercase text-jewelry-light/50"><tr><th className="text-left pb-2 font-medium"></th><th className="text-right pb-2 font-medium">ARS</th><th className="text-right pb-2 font-medium">USD</th></tr></thead>
                                        <tbody>
                                            {[
                                                ['Fondo inicial', r.fondoInicialArs, r.fondoInicialUsd],
                                                ['+ Ventas efectivo', r.ventasEfectivoArs, r.ventasEfectivoUsd],
                                                ['+ Ingresos', r.ingresosArs, r.ingresosUsd],
                                                ['− Gastos', r.gastosArs, r.gastosUsd],
                                                ['− Rendiciones', r.rendicionesArs, r.rendicionesUsd],
                                            ].map(([l, a, u]) => (
                                                <tr key={l}><td className="py-1 text-jewelry-light/70">{l}</td><td className="py-1 text-right">{formatMoney(a)}</td><td className="py-1 text-right">{formatMoney(u, 'USD')}</td></tr>
                                            ))}
                                            <tr className="border-t border-jewelry-gray font-semibold text-jewelry-gold">
                                                <td className="py-1.5">Esperado</td><td className="py-1.5 text-right">{formatMoney(esperadoArs)}</td><td className="py-1.5 text-right">{formatMoney(esperadoUsd, 'USD')}</td>
                                            </tr>
                                            {!s.abierta && (
                                                <>
                                                    <tr><td className="py-1 text-jewelry-light/70">Contado</td><td className="py-1 text-right">{formatMoney(s.contadoArs)}</td><td className="py-1 text-right">{formatMoney(s.contadoUsd, 'USD')}</td></tr>
                                                    <tr>
                                                        <td className="py-1 text-jewelry-light/70">Diferencia</td>
                                                        <td className={`py-1 text-right ${claseDif(dif(s.contadoArs, s.esperadoArs))}`}>{textoDif(dif(s.contadoArs, s.esperadoArs), 'ARS')}</td>
                                                        <td className={`py-1 text-right ${claseDif(dif(s.contadoUsd, s.esperadoUsd))}`}>{textoDif(dif(s.contadoUsd, s.esperadoUsd), 'USD')}</td>
                                                    </tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs uppercase text-jewelry-light/50 mb-1">Movimientos y rendiciones</p>
                                            {c.movimientos.length === 0 ? <p className="text-jewelry-light/40">Sin movimientos.</p> : c.movimientos.map(m => (
                                                <div key={m.id} className="flex justify-between gap-2 py-1">
                                                    <span className="text-jewelry-light/80 truncate">{m.tipo === 'Rendicion' ? 'Rendición' : m.tipo}: {m.concepto}{m.recibidoPor && ` → ${m.recibidoPor}`}</span>
                                                    <span className="whitespace-nowrap">{formatMoney(m.monto, m.moneda)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-jewelry-light/50 mb-1">Arqueos</p>
                                            {c.arqueos.length === 0 ? <p className="text-jewelry-light/40">Sin arqueos.</p> : c.arqueos.map(a => (
                                                <div key={a.id} className="py-1">
                                                    <span className="text-jewelry-light/50">{formatFechaHora(a.fecha)} {a.esCierre ? '(cierre)' : '(parcial)'} · {a.usuario}: </span>
                                                    <span className={claseDif(a.diferenciaArs)}>{textoDif(a.diferenciaArs, 'ARS')}</span> / <span className={claseDif(a.diferenciaUsd)}>{textoDif(a.diferenciaUsd, 'USD')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">Egresos de stock (sin cobro)</CardTitle>
                        </CardHeader>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-jewelry-light/50 border-b border-jewelry-gray">
                                    <tr>
                                        <th className="px-6 py-3 text-left font-medium">Hora</th>
                                        <th className="px-6 py-3 text-left font-medium">Producto</th>
                                        <th className="px-6 py-3 text-center font-medium">Cant.</th>
                                        <th className="px-6 py-3 text-right font-medium">Valor de lista</th>
                                        <th className="px-6 py-3 text-left font-medium">Motivo</th>
                                        <th className="px-6 py-3 text-left font-medium">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-jewelry-gray/50">
                                    {data.egresos.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-jewelry-light/40">No salió mercadería sin cobro.</td></tr>}
                                    {data.egresos.map(e => (
                                        <tr key={e.id}>
                                            <td className="px-6 py-3 whitespace-nowrap">{new Date(e.fecha).toLocaleTimeString('es-AR', { timeStyle: 'short' })}</td>
                                            <td className="px-6 py-3">{e.producto || '-'} {e.sku && <span className="text-xs text-jewelry-light/50">{e.sku}</span>}</td>
                                            <td className="px-6 py-3 text-center text-red-400">−{e.cantidad}</td>
                                            <td className="px-6 py-3 text-right whitespace-nowrap">{formatMoney(e.precio * e.cantidad, e.moneda)}</td>
                                            <td className="px-6 py-3">{e.motivo}{e.observaciones && <span className="text-xs text-jewelry-light/50"> · {e.observaciones}</span>}</td>
                                            <td className="px-6 py-3 text-jewelry-light/60">{e.usuario || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {data.anuladas.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-lg">Ventas anuladas</CardTitle></CardHeader>
                            <CardContent className="text-sm space-y-1">
                                {data.anuladas.map(a => (
                                    <p key={a.id}>#{a.id} · {formatMoney(a.total, a.moneda)} · vendió {a.usuario} · anuló {a.usuarioAnulacion}: <span className="text-jewelry-light/60">{a.motivoAnulacion}</span></p>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
};

export default ArqueoDiario;
