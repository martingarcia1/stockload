import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const StockForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);

    const [formData, setFormData] = useState({
        nombre: '',
        sku: '',
        categoria: 'Relojes',
        marca: '',
        precio: '',
        stock: '',
        minStock: ''
    });

    const [loading, setLoading] = useState(isEditMode);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isEditMode) {
            const fetchItem = async () => {
                try {
                    const response = await fetch(`http://localhost:5202/api/stock/${id}`);
                    if (response.ok) {
                        const data = await response.json();
                        setFormData({
                            nombre: data.nombre || '',
                            sku: data.sku || '',
                            categoria: data.categoria || 'Relojes',
                            marca: data.marca || '',
                            precio: data.precio || '',
                            stock: data.stock || '',
                            minStock: data.minStock || ''
                        });
                    } else {
                        navigate('/inventario');
                    }
                } catch (error) {
                    console.error("Error fetching item:", error);
                    navigate('/inventario');
                } finally {
                    setLoading(false);
                }
            };
            fetchItem();
        }
    }, [id, navigate, isEditMode]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const payload = {
                ...formData,
                precio: Number(formData.precio),
                stock: Number(formData.stock),
                minStock: Number(formData.minStock)
            };

            if (isEditMode) {
                payload.id = Number(id);
            }

            const url = isEditMode
                ? `http://localhost:5202/api/stock/${id}`
                : 'http://localhost:5202/api/stock';

            const method = isEditMode ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                navigate('/inventario');
            } else {
                console.error("Error saving data");
                setSaving(false);
            }
        } catch (error) {
            console.error("Error:", error);
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-jewelry-gold" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/inventario')}
                    className="p-2 text-jewelry-light/60 hover:text-jewelry-gold hover:bg-jewelry-gray rounded-md transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">
                        {isEditMode ? 'Editar Artículo' : 'Nuevo Artículo'}
                    </h2>
                    <p className="text-jewelry-light/60 mt-1">Completa los datos para ingresar un producto al stock.</p>
                </div>
            </div>

            <Card>
                <form onSubmit={handleSubmit}>
                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">

                        <div className="col-span-1 md:col-span-2">
                            <Input
                                label="Nombre del Producto"
                                name="nombre"
                                value={formData.nombre}
                                onChange={handleChange}
                                placeholder="Ej. Tissot PRX 40mm Automático"
                                required
                            />
                        </div>

                        <Input
                            label="SKU (Código único)"
                            name="sku"
                            value={formData.sku}
                            onChange={handleChange}
                            placeholder="Ej. TS-0092"
                            required
                        />

                        <Input
                            label="Marca"
                            name="marca"
                            value={formData.marca}
                            onChange={handleChange}
                            placeholder="Ej. Tissot, Casio, Genérico"
                            required
                        />

                        <div>
                            <label className="block text-sm font-medium leading-6 text-jewelry-light mb-1">
                                Categoría
                            </label>
                            <select
                                name="categoria"
                                value={formData.categoria}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-jewelry-gray bg-jewelry-darker px-3 py-2 text-sm text-jewelry-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jewelry-gold"
                            >
                                <option value="Relojes">Relojes</option>
                                <option value="Joyas">Joyas</option>
                                <option value="Platería">Platería</option>
                                <option value="General">General</option>
                            </select>
                        </div>

                        <Input
                            label="Precio de Venta ($ ARS)"
                            type="number"
                            name="precio"
                            value={formData.precio}
                            onChange={handleChange}
                            placeholder="Ej. 850000"
                            required
                        />

                        <Input
                            label="Stock Actual (Unidades)"
                            type="number"
                            name="stock"
                            value={formData.stock}
                            onChange={handleChange}
                            placeholder="Ej. 5"
                            required
                        />

                        <Input
                            label="Stock Mínimo Alerta (Unidades)"
                            type="number"
                            name="minStock"
                            value={formData.minStock}
                            onChange={handleChange}
                            placeholder="Ej. 2"
                            required
                        />

                    </CardContent>
                    <div className="p-6 border-t border-jewelry-gray flex justify-end gap-3 bg-jewelry-darker/50 rounded-b-xl">
                        <Button variant="ghost" type="button" onClick={() => navigate('/inventario')} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button variant="primary" type="submit" className="flex items-center gap-2" disabled={saving}>
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {isEditMode ? 'Actualizar Artículo' : 'Guardar Artículo'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default StockForm;
