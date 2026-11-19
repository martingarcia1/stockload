import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Package, Tag, Watch, UserCircle, LogOut, ShoppingCart,
    ShoppingBag, Receipt, Wallet, ClipboardList, Users, Settings, DollarSign, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useCotizacion from '../hooks/useCotizacion';
import { formatMoney } from '../utils/format';

const Sidebar = () => {
    const { logout, esGestion } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const secciones = [
        {
            titulo: null,
            items: [
                { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
                { name: 'Nueva Venta', icon: ShoppingBag, path: '/ventas/nueva' },
                { name: 'Ventas', icon: Receipt, path: '/ventas', end: true },
                { name: 'Facturación', icon: FileText, path: '/facturacion' },
            ]
        },
        {
            titulo: 'Inventario',
            items: [
                { name: 'Inventario', icon: Package, path: '/inventario' },
                { name: 'Relojes', icon: Watch, path: '/relojes' },
                { name: 'Joyas', icon: Tag, path: '/joyas' },
                { name: 'Platería', icon: Tag, path: '/plateria' },
                { name: 'Acero', icon: Tag, path: '/acero' },
                { name: 'Egresos de Stock', icon: ShoppingCart, path: '/egresos' },
            ]
        },
        {
            titulo: 'Administración',
            soloGestion: true,
            items: [
                { name: 'Caja', icon: Wallet, path: '/caja' },
                { name: 'Arqueo Diario', icon: ClipboardList, path: '/arqueo-diario' },
                { name: 'Usuarios', icon: Users, path: '/usuarios' },
                { name: 'Configuración', icon: Settings, path: '/configuracion' },
            ]
        },
    ];

    return (
        <aside className="w-64 bg-jewelry-darker border-r border-jewelry-gray h-screen flex flex-col fixed left-0 top-0">
            <div className="p-6 flex items-center justify-center border-b border-jewelry-gray">
                <div className="flex flex-col items-center">
                    <h1 className="text-2xl font-display font-bold text-jewelry-light tracking-widest uppercase">
                        M<span className="text-jewelry-gold">ch.</span>
                    </h1>
                    <p className="text-xs text-jewelry-light/60 tracking-widest uppercase mt-1">MarcelÖ Chavan</p>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
                {secciones.filter(s => !s.soloGestion || esGestion).map((seccion, idx) => (
                    <div key={idx} className="space-y-1">
                        {seccion.titulo && (
                            <p className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-widest text-jewelry-light/40">{seccion.titulo}</p>
                        )}
                        {seccion.items.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.end || item.path === '/'}
                                className={({ isActive }) =>
                                    `flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${isActive
                                        ? 'bg-jewelry-gray text-jewelry-gold'
                                        : 'text-jewelry-light hover:bg-jewelry-gray/50 hover:text-jewelry-white'
                                    }`
                                }
                            >
                                <item.icon size={18} />
                                <span className="font-medium text-sm">{item.name}</span>
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="p-4 border-t border-jewelry-gray">
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center space-x-3 px-4 py-3 text-jewelry-light hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Salir</span>
                </button>
            </div>
        </aside>
    );
};

const NOMBRES_DOLAR = {
    oficial: 'Oficial', blue: 'Blue', bolsa: 'MEP', contadoconliqui: 'CCL', tarjeta: 'Tarjeta', mayorista: 'Mayorista'
};

const Header = () => {
    const { user } = useAuth();
    const { cotizacion, error } = useCotizacion();

    return (
        <header className="h-20 bg-jewelry-darker border-b border-jewelry-gray flex items-center justify-between px-8 sticky top-0 z-10">
            <div className="flex items-center gap-2 text-sm">
                <DollarSign size={16} className="text-jewelry-gold" />
                {cotizacion ? (
                    <span className="text-jewelry-light/80">
                        Dólar {NOMBRES_DOLAR[cotizacion.tipo] || cotizacion.tipo}:{' '}
                        <span className="text-jewelry-gold font-semibold">{formatMoney(cotizacion.valor)}</span>
                        {cotizacion.fuente !== 'automatica' && (
                            <span className="ml-2 text-xs text-amber-400">
                                ({cotizacion.fuente === 'manual' ? 'manual' : 'último valor guardado'})
                            </span>
                        )}
                    </span>
                ) : (
                    <span className="text-red-400 text-xs">{error || 'Cargando cotización…'}</span>
                )}
            </div>
            <div className="flex items-center space-x-4">
                <div className="text-right hidden md:block">
                    <p className="text-sm font-medium text-jewelry-light">{user?.nombre || user?.email}</p>
                    <p className="text-xs text-jewelry-light/60">{user?.rol === 'Admin' ? 'Propietario' : user?.rol}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-jewelry-gray flex items-center justify-center text-jewelry-gold">
                    <UserCircle size={24} />
                </div>
            </div>
        </header>
    );
};

const MainLayout = () => {
    return (
        <div className="min-h-screen bg-jewelry-dark text-jewelry-text flex">
            <Sidebar />
            <div className="flex-1 ml-64 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-8">
                    {/* Outlet is where React Router will inject child routes */}
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
