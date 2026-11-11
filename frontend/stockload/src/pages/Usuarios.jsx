import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import { fieldClass, labelClass } from '../components/selectStyles';
import { apiFetch, API_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { leerError } from '../utils/format';

const DESCRIPCION_ROL = {
    Propietario: 'Acceso total: caja, arqueo, reportes, usuarios y configuración.',
    Administradora: 'Igual que el propietario, salvo crear o editar propietarios.',
    Vendedor: 'Registra ventas (con descuentos) y consulta el inventario.',
};

const vacio = { id: null, email: '', nombre: '', rol: 'Vendedor', password: '', activo: true };

const Usuarios = () => {
    const { user, rol } = useAuth();
    const esPropietario = rol === 'Propietario' || rol === 'Admin';
    const [usuarios, setUsuarios] = useState([]);
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const [pass, setPass] = useState({ actual: '', nueva: '' });
    const [passMsg, setPassMsg] = useState('');

    const cargar = useCallback(async () => {
        const res = await apiFetch(`${API_URL}/usuarios`);
        if (res.ok) setUsuarios(await res.json());
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const guardar = async () => {
        setSaving(true); setError('');
        const res = await apiFetch(form.id ? `${API_URL}/usuarios/${form.id}` : `${API_URL}/usuarios`, {
            method: form.id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, password: form.password || null })
        });
        setSaving(false);
        if (res.ok) { setForm(null); cargar(); }
        else setError(await leerError(res));
    };

    const cambiarPassword = async () => {
        setPassMsg('');
        const res = await apiFetch(`${API_URL}/usuarios/cambiar-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passwordActual: pass.actual, passwordNueva: pass.nueva })
        });
        if (res.ok) { setPass({ actual: '', nueva: '' }); setPassMsg('Contraseña actualizada.'); }
        else setPassMsg(await leerError(res));
    };

    const roles = esPropietario ? ['Propietario', 'Administradora', 'Vendedor'] : ['Administradora', 'Vendedor'];

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">Usuarios</h2>
                    <p className="text-jewelry-light/60 mt-1">Personas con acceso al sistema y sus permisos.</p>
                </div>
                <Button onClick={() => { setForm(vacio); setError(''); }} className="gap-2"><Plus size={18} /> Nuevo usuario</Button>
            </div>

            {form && (
                <Card className="border-jewelry-gold/40">
                    <CardHeader className="pb-2 flex-row items-center justify-between">
                        <CardTitle className="text-lg">{form.id ? 'Editar usuario' : 'Nuevo usuario'}</CardTitle>
                        <button onClick={() => setForm(null)} className="text-jewelry-light/50"><X size={18} /></button>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Nombre</label><input className={fieldClass} value={form.nombre || ''} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
                        <div><label className={labelClass}>Email</label><input type="email" className={fieldClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                        <div>
                            <label className={labelClass}>Rol</label>
                            <select className={fieldClass} value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                                {roles.map(r => <option key={r}>{r}</option>)}
                            </select>
                            <p className="text-xs text-jewelry-light/50 mt-1">{DESCRIPCION_ROL[form.rol]}</p>
                        </div>
                        <div>
                            <label className={labelClass}>{form.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
                            <input type="password" className={fieldClass} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-jewelry-light">
                            <input type="checkbox" className="accent-jewelry-gold" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} />
                            Usuario activo (puede iniciar sesión)
                        </label>
                        <div className="flex justify-end gap-2 md:col-span-2">
                            {error && <p className="text-sm text-red-400 mr-auto">{error}</p>}
                            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
                            <Button onClick={guardar} isLoading={saving}>Guardar</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-jewelry-light/50 border-b border-jewelry-gray">
                        <tr>
                            <th className="px-6 py-3 text-left font-medium">Nombre</th>
                            <th className="px-6 py-3 text-left font-medium">Email</th>
                            <th className="px-6 py-3 text-left font-medium">Rol</th>
                            <th className="px-6 py-3 text-left font-medium">Estado</th>
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-jewelry-gray/50">
                        {usuarios.map(u => {
                            const editable = esPropietario || (u.rol !== 'Propietario' && u.rol !== 'Admin');
                            return (
                                <tr key={u.id}>
                                    <td className="px-6 py-3">{u.nombre || '-'}</td>
                                    <td className="px-6 py-3">{u.email}{u.email === user?.email && <span className="text-xs text-jewelry-gold ml-2">(usted)</span>}</td>
                                    <td className="px-6 py-3">{u.rol === 'Admin' ? 'Propietario' : u.rol}</td>
                                    <td className="px-6 py-3">{u.activo ? <span className="text-emerald-400">Activo</span> : <span className="text-jewelry-light/40">Inactivo</span>}</td>
                                    <td className="px-6 py-3 text-right">
                                        {editable && (
                                            <Button variant="ghost" size="sm" onClick={() => { setForm({ ...u, password: '' }); setError(''); }}><Pencil size={14} /></Button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Card>

            <Card className="max-w-xl">
                <CardHeader className="pb-2"><CardTitle className="text-lg">Cambiar mi contraseña</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <input type="password" className={fieldClass} value={pass.actual} onChange={e => setPass({ ...pass, actual: e.target.value })} placeholder="Contraseña actual" />
                    <input type="password" className={fieldClass} value={pass.nueva} onChange={e => setPass({ ...pass, nueva: e.target.value })} placeholder="Nueva contraseña (mínimo 6)" />
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-jewelry-light/70">{passMsg}</span>
                        <Button onClick={cambiarPassword} disabled={!pass.actual || pass.nueva.length < 6}>Actualizar</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Usuarios;
