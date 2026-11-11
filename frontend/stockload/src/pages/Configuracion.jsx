import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/Card';
import Button from '../components/Button';
import { fieldClass, labelClass } from '../components/selectStyles';
import { apiFetch, API_URL } from '../utils/api';
import { formatFechaHora, formatMoney, leerError } from '../utils/format';

const TIPOS_DOLAR = [
    { value: 'blue', label: 'Blue' },
    { value: 'oficial', label: 'Oficial' },
    { value: 'bolsa', label: 'MEP (bolsa)' },
    { value: 'contadoconliqui', label: 'Contado con liquidación' },
    { value: 'tarjeta', label: 'Tarjeta' },
    { value: 'mayorista', label: 'Mayorista' },
];

const Campo = ({ label, children, ayuda }) => (
    <div>
        <label className={labelClass}>{label}</label>
        {children}
        {ayuda && <p className="text-xs text-jewelry-light/40 mt-1">{ayuda}</p>}
    </div>
);

const Configuracion = () => {
    const [c, setC] = useState(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ tipo: '', texto: '' });
    const [cotizacion, setCotizacion] = useState(null);

    const cargarCotizacion = async () => {
        const r = await apiFetch(`${API_URL}/configuracion/cotizacion`);
        setCotizacion(r.ok ? await r.json() : null);
    };

    useEffect(() => {
        apiFetch(`${API_URL}/configuracion`).then(async r => r.ok && setC(await r.json()));
        cargarCotizacion();
    }, []);

    const set = (k, v) => setC(prev => ({ ...prev, [k]: v }));

    const guardar = async () => {
        setSaving(true); setMsg({ tipo: '', texto: '' });
        const res = await apiFetch(`${API_URL}/configuracion`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...c,
                puntoVenta: Number(c.puntoVenta),
                alicuotaIva: Number(c.alicuotaIva),
                cotizacionManual: c.cotizacionManual === '' || c.cotizacionManual == null ? null : Number(c.cotizacionManual),
                inicioActividades: c.inicioActividades || null
            })
        });
        setSaving(false);
        if (res.ok) {
            setC(await res.json());
            setMsg({ tipo: 'ok', texto: 'Configuración guardada.' });
            cargarCotizacion();
        } else {
            setMsg({ tipo: 'error', texto: await leerError(res) });
        }
    };

    if (!c) return <div className="flex justify-center py-20 text-jewelry-light/50"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">Configuración</h2>
                    <p className="text-jewelry-light/60 mt-1">Datos fiscales para ARCA y cotización del dólar.</p>
                </div>
                <Button onClick={guardar} isLoading={saving} className="gap-2"><Save size={16} /> Guardar</Button>
            </div>

            {msg.texto && (
                <div className={`p-3 rounded-md text-sm ${msg.tipo === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{msg.texto}</div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Cotización del dólar</CardTitle>
                    <CardDescription>
                        Se usa para convertir los precios cargados en USD a pesos (y viceversa) al vender.
                        La cotización automática se obtiene de dolarapi.com y se actualiza cada 10 minutos.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Campo label="Tipo de dólar">
                        <select className={fieldClass} value={c.tipoDolar} onChange={e => set('tipoDolar', e.target.value)}>
                            {TIPOS_DOLAR.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </Campo>
                    <Campo label="Cotización manual" ayuda="Se usa si activa la opción, o como respaldo si la API no responde.">
                        <input type="number" min="0" step="0.01" className={fieldClass} value={c.cotizacionManual ?? ''} onChange={e => set('cotizacionManual', e.target.value)} placeholder="Ej. 1450" />
                    </Campo>
                    <label className="flex items-center gap-2 text-sm text-jewelry-light pt-6">
                        <input type="checkbox" className="accent-jewelry-gold" checked={c.usarCotizacionManual} onChange={e => set('usarCotizacionManual', e.target.checked)} />
                        Usar cotización manual
                    </label>
                    <div className="md:col-span-3 text-sm text-jewelry-light/70">
                        Cotización vigente:{' '}
                        {cotizacion
                            ? <><span className="text-jewelry-gold font-semibold">{formatMoney(cotizacion.valor)}</span> ({cotizacion.fuente}{cotizacion.actualizada && `, ${formatFechaHora(cotizacion.actualizada)}`})</>
                            : <span className="text-red-400">no disponible</span>}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Datos fiscales</CardTitle>
                    <CardDescription>Aparecen en los comprobantes y determinan el tipo de factura (A/B si es Responsable Inscripto, C si es Monotributo).</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Campo label="Razón social"><input className={fieldClass} value={c.razonSocial || ''} onChange={e => set('razonSocial', e.target.value)} /></Campo>
                    <Campo label="CUIT"><input className={fieldClass} value={c.cuit || ''} onChange={e => set('cuit', e.target.value)} placeholder="20123456789" /></Campo>
                    <Campo label="Condición frente al IVA">
                        <select className={fieldClass} value={c.condicionFiscal} onChange={e => set('condicionFiscal', e.target.value)}>
                            <option value="ResponsableInscripto">Responsable Inscripto</option>
                            <option value="Monotributo">Monotributo</option>
                            <option value="Exento">Exento</option>
                        </select>
                    </Campo>
                    <Campo label="Alícuota de IVA (%)" ayuda="Sólo aplica a Responsable Inscripto.">
                        <input type="number" step="0.5" className={fieldClass} value={c.alicuotaIva} onChange={e => set('alicuotaIva', e.target.value)} disabled={c.condicionFiscal !== 'ResponsableInscripto'} />
                    </Campo>
                    <Campo label="Domicilio comercial"><input className={fieldClass} value={c.domicilioComercial || ''} onChange={e => set('domicilioComercial', e.target.value)} /></Campo>
                    <Campo label="Ingresos Brutos"><input className={fieldClass} value={c.ingresosBrutos || ''} onChange={e => set('ingresosBrutos', e.target.value)} /></Campo>
                    <Campo label="Inicio de actividades">
                        <input type="date" className={fieldClass} value={c.inicioActividades ? c.inicioActividades.slice(0, 10) : ''} onChange={e => set('inicioActividades', e.target.value)} />
                    </Campo>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Factura electrónica ARCA</CardTitle>
                    <CardDescription>
                        Para emitir comprobantes hace falta: (1) dar de alta un punto de venta tipo "Web Service" en ARCA,
                        (2) generar el certificado digital con la clave fiscal del titular y asociarlo al servicio "wsfe".
                        Mientras no esté conectado, las ventas a facturar quedan como "Pendiente ARCA" y se pueden emitir después.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Campo label="Punto de venta"><input type="number" min="1" className={fieldClass} value={c.puntoVenta} onChange={e => set('puntoVenta', e.target.value)} /></Campo>
                    <Campo label="Ambiente">
                        <select className={fieldClass} value={c.arcaAmbiente} onChange={e => set('arcaAmbiente', e.target.value)}>
                            <option value="Homologacion">Homologación (pruebas)</option>
                            <option value="Produccion">Producción</option>
                        </select>
                    </Campo>
                    <div className="space-y-2 pt-6">
                        <label className="flex items-center gap-2 text-sm text-jewelry-light">
                            <input type="checkbox" className="accent-jewelry-gold" checked={c.arcaHabilitado} onChange={e => set('arcaHabilitado', e.target.checked)} />
                            Enviar facturas a ARCA
                        </label>
                        <label className="flex items-center gap-2 text-sm text-jewelry-light">
                            <input type="checkbox" className="accent-jewelry-gold" checked={c.facturarPorDefecto} onChange={e => set('facturarPorDefecto', e.target.checked)} />
                            Facturar todas las ventas por defecto
                        </label>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Configuracion;
