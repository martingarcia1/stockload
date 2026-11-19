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
                    <p className="text-jewelry-light/60 mt-1">Cotización del dólar. Los datos fiscales están en Facturación › Datos fiscales.</p>
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
        </div>
    );
};

export default Configuracion;
