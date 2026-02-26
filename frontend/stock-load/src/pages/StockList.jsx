import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { Search, Filter, Plus, Edit2, Trash2, Watch, Diamond, PackageOpen, Loader2 } from 'lucide-react';

const CategoryIcon = ({ category }) => {
    switch (category) {
        case 'Relojes': return <Watch size={16} className="text-blue-400" />;
        case 'Joyas': return <Diamond size={16} className="text-purple-400" />;
        default: return <PackageOpen size={16} className="text-jewelry-gold" />;
    }
};

const StockList = ({ defaultCategory = 'Todas' }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [showFilters, setShowFilters] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState(defaultCategory);
    const [stockFilter, setStockFilter] = useState('Todos');

    useEffect(() => {
        const fetchStock = async () => {
            try {
                const response = await fetch('http://localhost:5202/api/stock');
                if (response.ok) {
                    const data = await response.json();
                    setItems(data);
                }
            } catch (error) {
                console.error("Error fetching stock:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStock();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm('¿Está seguro de eliminar este artículo?')) {
            try {
                const response = await fetch(`http://localhost:5202/api/stock/${id}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    setItems(items.filter(item => item.id !== id));
                }
            } catch (error) {
                console.error("Error deleting stock:", error);
            }
        }
    };

    const filteredItems = items.filter(item => {
        const matchesSearch = item.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.marca?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = categoryFilter === 'Todas' || item.categoria === categoryFilter;

        let matchesStock = true;
        if (stockFilter === 'Bajo') {
            matchesStock = item.stock <= item.minStock;
        } else if (stockFilter === 'Óptimo') {
            matchesStock = item.stock > item.minStock;
        }

        return matchesSearch && matchesCategory && matchesStock;
    });

    // Cierra el panel de filtros si se hace click fuera (opcional, pero mejora la UX)
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilters && !event.target.closest('.filters-container')) {
                setShowFilters(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFilters]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">
                        {defaultCategory === 'Todas' ? 'Inventario Global' : `Inventario de ${defaultCategory}`}
                    </h2>
                    <p className="text-jewelry-light/60 mt-1">
                        {defaultCategory === 'Todas'
                            ? 'Gestión de stock de relojes, joyas y platería.'
                            : `Gestión y control de la categoría de ${defaultCategory.toLowerCase()}.`}
                    </p>
                </div>
                <Button variant="primary" className="flex items-center gap-2" onClick={() => navigate('/inventario/nuevo')}>
                    <Plus size={18} />
                    Nuevo Artículo
                </Button>
            </div>

            <Card>
                <div className="p-4 border-b border-jewelry-gray flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-jewelry-light/50">
                            <Search size={18} />
                        </div>
                        <Input
                            placeholder="Buscar por nombre, SKU o marca..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative filters-container">
                        <Button
                            variant={showFilters ? "primary" : "outline"}
                            className="flex items-center gap-2 whitespace-nowrap"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter size={18} />
                            Filtros {(categoryFilter !== 'Todas' || stockFilter !== 'Todos') && <span className="ml-1 w-2 h-2 rounded-full bg-jewelry-gold"></span>}
                        </Button>

                        {showFilters && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-jewelry-darker border border-jewelry-gray/50 rounded-lg shadow-xl p-4 z-10">
                                <h3 className="text-sm font-medium text-jewelry-light mb-3">Filtrar Inventario</h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-jewelry-light/70 mb-1 leading-relaxed">Categoría</label>
                                        <select
                                            value={categoryFilter}
                                            onChange={(e) => setCategoryFilter(e.target.value)}
                                            className="w-full bg-jewelry-gray/20 border border-jewelry-gray/50 rounded-md text-sm text-jewelry-light px-2 py-1.5 focus:outline-none focus:border-jewelry-gold"
                                        >
                                            <option value="Todas">Todas las categorías</option>
                                            <option value="Relojes">Relojes</option>
                                            <option value="Joyas">Joyas</option>
                                            <option value="Platería">Platería</option>
                                            <option value="General">General</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-jewelry-light/70 mb-1 leading-relaxed">Estado de Stock</label>
                                        <select
                                            value={stockFilter}
                                            onChange={(e) => setStockFilter(e.target.value)}
                                            className="w-full bg-jewelry-gray/20 border border-jewelry-gray/50 rounded-md text-sm text-jewelry-light px-2 py-1.5 focus:outline-none focus:border-jewelry-gold"
                                        >
                                            <option value="Todos">Todos</option>
                                            <option value="Óptimo">Stock Óptimo</option>
                                            <option value="Bajo">Stock Bajo</option>
                                        </select>
                                    </div>

                                    <div className="pt-2 flex justify-end">
                                        <button
                                            onClick={() => {
                                                setCategoryFilter('Todas');
                                                setStockFilter('Todos');
                                            }}
                                            className="text-xs text-jewelry-light/50 hover:text-jewelry-gold transition-colors"
                                        >
                                            Limpiar filtros
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-12 flex justify-center items-center">
                            <Loader2 className="animate-spin text-jewelry-gold" size={32} />
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-jewelry-light/70 uppercase bg-jewelry-darker border-b border-jewelry-gray">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Producto</th>
                                    <th className="px-6 py-4 font-medium">Categoría</th>
                                    <th className="px-6 py-4 font-medium text-right">Precio</th>
                                    <th className="px-6 py-4 font-medium text-center">Stock</th>
                                    <th className="px-6 py-4 font-medium text-center">Estado</th>
                                    <th className="px-6 py-4 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item) => (
                                    <tr key={item.id} className="border-b border-jewelry-gray/50 hover:bg-jewelry-gray/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-jewelry-light">{item.nombre || 'Sin nombre'}</div>
                                            <div className="text-xs text-jewelry-light/50 flex items-center gap-2 mt-1">
                                                <span>{item.sku || 'N/A'}</span> • <span>{item.marca || 'S/M'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <CategoryIcon category={item.categoria} />
                                                <span className="text-jewelry-light/80">{item.categoria || 'General'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-jewelry-gold">
                                            ${item.precio?.toLocaleString('es-AR') ?? '0'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-medium text-jewelry-light">{item.stock}</span>
                                            <span className="text-jewelry-light/40 text-xs ml-1">/ {item.minStock} mín.</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {item.stock <= item.minStock ? (
                                                <span className="px-2.5 py-1 text-xs font-medium bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                                                    Bajo
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 text-xs font-medium bg-green-500/10 text-green-500 rounded-full border border-green-500/20">
                                                    Óptimo
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => navigate(`/inventario/editar/${item.id}`)} className="p-2 text-jewelry-light/60 hover:text-jewelry-gold hover:bg-jewelry-gray rounded-md transition-colors" title="Editar">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(item.id)} className="p-2 text-jewelry-light/60 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors" title="Eliminar">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-jewelry-light/50">
                                            No se encontraron artículos en el inventario.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="p-4 border-t border-jewelry-gray flex justify-between items-center text-sm text-jewelry-light/60">
                    <span>Mostrando {filteredItems.length} artículos</span>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" disabled>Anterior</Button>
                        <Button variant="ghost" size="sm" disabled={filteredItems.length === 0}>Siguiente</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default StockList;
