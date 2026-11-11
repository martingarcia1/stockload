import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { AlertTriangle, ArrowLeft, Loader2, Save, ShoppingBag } from 'lucide-react';
import Select from 'react-select';
import { apiFetch, API_URL } from '../utils/api';

const EgresoForm = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [itemId, setItemId] = useState('');
    const [cantidad, setCantidad] = useState(1);
    const [motivo, setMotivo] = useState('Devolución');
    const [observaciones, setObservaciones] = useState('');
    const requiereObs = motivo === 'Otro' || motivo === 'Ajuste';

    useEffect(() => {
        const fetchStock = async () => {
            try {
                const response = await apiFetch(`${API_URL}/stock`);
                if (response.ok) {
                    const data = await response.json();
                    // Ordenar alfabéticamente para más fácil selección
                    setItems(data.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')));
                }
            } catch (err) {
                console.error("Error fetching items:", err);
            } finally {
                setLoadingItems(false);
            }
        };
        fetchStock();
    }, []);

    const selectedItem = items.find(i => i.id === Number(itemId));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!itemId) {
            setError('Debe seleccionar un producto.');
            return;
        }

        if (cantidad <= 0) {
            setError('La cantidad debe ser mayor a 0.');
            return;
        }

        if (selectedItem && cantidad > selectedItem.stock) {
            setError(`Stock insuficiente. Stock actual de este producto: ${selectedItem.stock}`);
            return;
        }

        setSaving(true);

        try {
            const payload = {
                itemId: Number(itemId),
                cantidad: Number(cantidad),
                motivo: motivo,
                observaciones: observaciones || null
            };

            const response = await apiFetch(`${API_URL}/Egresos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                navigate('/egresos');
            } else {
                const errData = await response.text();
                setError(errData || 'Error al guardar el egreso.');
            }
        } catch (err) {
            console.error("Error:", err);
            setError("Error de red al conectar con el servidor.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/egresos')}
                    className="p-2 -ml-2 text-jewelry-light/60 hover:text-jewelry-white hover:bg-jewelry-gray rounded-full transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">Registrar Egreso</h2>
                    <p className="text-jewelry-light/60 mt-1">Salida de mercadería sin cobro (devoluciones, garantías, mermas, regalos).</p>
                </div>
            </div>

            <Card>
                <form onSubmit={handleSubmit}>
                    <CardHeader className="border-b border-jewelry-gray pb-4">
                        <CardTitle className="text-lg text-jewelry-light flex items-center gap-2">
                            Detalles del Egreso
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="pt-6 space-y-6">
                        {error && (
                            <div className="p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3">
                                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-jewelry-light/80 mb-2">Producto a Egresar *</label>
                                {loadingItems ? (
                                    <div className="flex items-center text-sm text-jewelry-light/50">
                                        <Loader2 className="animate-spin mr-2" size={16} /> Cargando catálogo...
                                    </div>
                                ) : (
                                    <Select
                                        placeholder="-- Buscar y seleccionar producto --"
                                        value={items.find(i => i.id === Number(itemId)) ? {
                                            value: itemId,
                                            label: `${items.find(i => i.id === Number(itemId)).sku ? `[${items.find(i => i.id === Number(itemId)).sku}] ` : ''}${items.find(i => i.id === Number(itemId)).nombre} (Stock: ${items.find(i => i.id === Number(itemId)).stock})`
                                        } : null}
                                        onChange={(selectedOption) => setItemId(selectedOption ? selectedOption.value : '')}
                                        options={items.map(item => ({
                                            value: item.id,
                                            label: `${item.sku ? `[${item.sku}] ` : ''}${item.nombre} (Stock: ${item.stock})`
                                        }))}
                                        isSearchable
                                        isClearable
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const searchTerm = e.target.value;
                                                if (searchTerm) {
                                                    // Buscamos coincidencia exacta de SKU
                                                    const match = items.find(i => i.sku && i.sku.toLowerCase() === searchTerm.toLowerCase());
                                                    if (match) {
                                                        e.preventDefault();
                                                        setItemId(match.id);
                                                    }
                                                }
                                            }
                                        }}
                                        styles={{
                                            control: (base, state) => ({
                                                ...base,
                                                backgroundColor: '#09090b', // Equivalente a bg-jewelry-dark
                                                borderColor: state.isFocused ? '#cca35e' : '#27272a', // Borde dorado al focus
                                                color: '#fafafa',
                                                padding: '2px',
                                                '&:hover': {
                                                    borderColor: '#cca35e'
                                                },
                                                boxShadow: state.isFocused ? '0 0 0 1px #cca35e' : 'none'
                                            }),
                                            menu: (base) => ({
                                                ...base,
                                                backgroundColor: '#18181b', // jewelry-darker
                                                border: '1px solid #27272a',
                                                zIndex: 50
                                            }),
                                            option: (base, state) => ({
                                                ...base,
                                                backgroundColor: state.isSelected ? '#cca35e' : (state.isFocused ? '#27272a' : '#18181b'),
                                                color: state.isSelected ? '#09090b' : '#fafafa',
                                                '&:active': {
                                                    backgroundColor: '#cca35e',
                                                    color: '#09090b'
                                                }
                                            }),
                                            singleValue: (base) => ({
                                                ...base,
                                                color: '#fafafa'
                                            }),
                                            input: (base) => ({
                                                ...base,
                                                color: '#fafafa'
                                            }),
                                            placeholder: (base) => ({
                                                ...base,
                                                color: '#a1a1aa' // jewelry-light/50
                                            })
                                        }}
                                        noOptionsMessage={() => "No se encontraron productos"}
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-jewelry-light/80 mb-2">Cantidad *</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        required
                                        value={cantidad}
                                        onChange={(e) => setCantidad(e.target.value)}
                                        placeholder="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-jewelry-light/80 mb-2">Motivo *</label>
                                    <select
                                        required
                                        value={motivo}
                                        onChange={(e) => setMotivo(e.target.value)}
                                        className="w-full bg-jewelry-dark border border-jewelry-gray/60 rounded-md text-sm text-jewelry-light px-3 py-2.5 focus:outline-none focus:border-jewelry-gold focus:ring-1 focus:ring-jewelry-gold"
                                    >
                                        <option value="Devolución">Devolución a Proveedor</option>
                                        <option value="Garantía">Garantía / Reparación</option>
                                        <option value="Merma">Merma / Pérdida</option>
                                        <option value="Regalo">Regalo / Muestra</option>
                                        <option value="Ajuste">Ajuste de Inventario</option>
                                        <option value="Otro">Otro Motivo</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-jewelry-light/80 mb-2">
                                    Observaciones {requiereObs ? '*' : '(opcional)'}
                                </label>
                                <Input
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                    required={requiereObs}
                                    placeholder="Ej. Proveedor X, remito 0001-1234 / se rompió el broche"
                                />
                            </div>

                            <div className="p-3 rounded-md bg-jewelry-gold/5 border border-jewelry-gold/20 text-sm text-jewelry-light/70 flex items-start gap-2">
                                <ShoppingBag size={16} className="text-jewelry-gold flex-shrink-0 mt-0.5" />
                                <span>
                                    Los egresos son salidas <strong>sin cobro</strong>. Para vender a un cliente use{' '}
                                    <button type="button" onClick={() => navigate('/ventas/nueva')} className="text-jewelry-gold underline">Nueva Venta</button>,
                                    así el cobro queda registrado en la caja.
                                </span>
                            </div>
                        </div>
                    </CardContent>

                    <div className="p-4 border-t border-jewelry-gray bg-jewelry-gray/10 flex justify-end gap-3 rounded-b-lg">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate('/egresos')}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={saving}
                            className="flex items-center gap-2"
                        >
                            {saving ? (
                                <><Loader2 className="animate-spin" size={18} /> Guardando...</>
                            ) : (
                                <><Save size={18} /> Registrar Egreso</>
                            )}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default EgresoForm;
