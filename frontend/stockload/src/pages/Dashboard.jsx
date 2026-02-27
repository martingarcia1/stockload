import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Watch, Diamond, Package, AlertTriangle, Loader2 } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, description, trend, trendColor = 'text-green-500' }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-jewelry-light/70 uppercase tracking-wider">{title}</CardTitle>
            <Icon className="h-5 w-5 text-jewelry-gold" />
        </CardHeader>
        <CardContent>
            <div className="text-3xl font-bold text-jewelry-light font-display">{value}</div>
            <p className="text-xs text-jewelry-light/50 mt-1 flex items-center">
                {trend && <span className={`${trendColor} mr-2`}>{trend}</span>}
                {description}
            </p>
        </CardContent>
    </Card>
);

import { apiFetch, API_URL } from '../utils/api';

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalItems: 0,
        categorias: { Relojes: 0, Joyas: 0 },
        alertasStock: 0,
        ultimosAgregados: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await apiFetch(`${API_URL}/stock/stats`);
                if (response.ok) {
                    const data = await response.json();
                    setStats(data);
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-jewelry-gold" />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex justify-center items-center h-64 text-jewelry-light/50">
                No se pudieron cargar las estadísticas de inventario.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">Panel Principal</h2>
                <p className="text-jewelry-light/60 mt-2">Resumen del inventario actual de la joyería.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Artículos"
                    value={stats.totalItems.toLocaleString('es-AR')}
                    icon={Package}
                    description="Registrados en sistema"
                />
                <StatCard
                    title="Relojes"
                    value={stats.totalWatches.toLocaleString('es-AR')}
                    icon={Watch}
                    description="Cantidad de relojes listados"
                />
                <StatCard
                    title="Joyas"
                    value={stats.totalJewelry.toLocaleString('es-AR')}
                    icon={Diamond}
                    description="Cantidad de joyas listadas"
                />
                <StatCard
                    title="Bajo Stock"
                    value={stats.lowStockCount.toLocaleString('es-AR')}
                    icon={AlertTriangle}
                    description="Artículos por debajo del umbral"
                    trend={stats.lowStockCount > 0 ? "Atención" : "Óptimo"}
                    trendColor={stats.lowStockCount > 0 ? "text-amber-500" : "text-green-500"}
                />
            </div>

            <div className="grid gap-6 md:grid-cols-2 mt-8">
                <Card className="h-96 hover:border-jewelry-gold/30 transition-colors overflow-hidden flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-lg text-jewelry-light">Últimos Ingresos</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-4">
                            {stats.recentItems.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-jewelry-gray/20 hover:bg-jewelry-gray/40 transition-colors border border-transparent hover:border-jewelry-gray/50">
                                    <div className="flex items-center space-x-4 overflow-hidden">
                                        <div className="h-10 w-10 flex-shrink-0 bg-jewelry-darker rounded-md flex items-center justify-center border border-jewelry-gray/30">
                                            {item.categoria === 'Relojes' ? <Watch size={18} className="text-blue-400" /> :
                                                item.categoria === 'Joyas' ? <Diamond size={18} className="text-purple-400" /> :
                                                    <Package size={18} className="text-jewelry-gold" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-jewelry-light truncate" title={item.nombre}>{item.nombre || 'Sin nombre'}</p>
                                            <p className="text-xs text-jewelry-light/50">SKU: {item.sku || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        <p className="text-sm font-medium text-jewelry-light/80">{item.stock || 0} uni.</p>
                                        <p className="text-xs text-jewelry-gold font-medium">${item.precio?.toLocaleString('es-AR')}</p>
                                    </div>
                                </div>
                            ))}
                            {stats.recentItems.length === 0 && (
                                <p className="text-sm text-jewelry-light/50 text-center mt-8">No hay artículos recientes.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="h-96 hover:border-jewelry-gold/30 transition-colors overflow-hidden flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-lg text-jewelry-light flex items-center gap-2">
                            <AlertTriangle size={18} className="text-amber-500" />
                            Alertas de Reposición
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-4">
                            {stats.lowStockItems.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 hover:bg-red-500/10 transition-colors border border-red-500/10 hover:border-red-500/20">
                                    <div className="flex items-center space-x-4 overflow-hidden">
                                        <div className="h-10 w-10 flex-shrink-0 bg-jewelry-darker rounded-md flex items-center justify-center border border-red-500/20">
                                            {item.categoria === 'Relojes' ? <Watch size={18} className="text-blue-400" /> :
                                                item.categoria === 'Joyas' ? <Diamond size={18} className="text-purple-400" /> :
                                                    <Package size={18} className="text-jewelry-gold" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-jewelry-light truncate" title={item.nombre}>{item.nombre || 'Sin nombre'}</p>
                                            <p className="text-xs text-jewelry-light/50">SKU: {item.sku || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        <p className="text-sm font-bold text-red-400">{item.stock || 0} uni.</p>
                                        <p className="text-xs text-jewelry-light/50">Mínimo: {item.minStock || 0}</p>
                                    </div>
                                </div>
                            ))}
                            {stats.lowStockItems.length === 0 && (
                                <div className="text-center py-12">
                                    <p className="text-sm text-green-500 font-medium">¡Todo en orden!</p>
                                    <p className="text-xs text-jewelry-light/50 mt-1">Ningún artículo por debajo del umbral mínimo.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
