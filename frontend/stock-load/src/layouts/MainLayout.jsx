import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Tag, Watch, UserCircle, LogOut } from 'lucide-react';

const Sidebar = () => {
    const navItems = [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
        { name: 'Inventario', icon: Package, path: '/inventario' },
        { name: 'Relojes', icon: Watch, path: '/relojes' },
        { name: 'Joyas', icon: Tag, path: '/joyas' },
    ];

    return (
        <aside className="w-64 bg-jewelry-darker border-r border-jewelry-gray h-screen flex flex-col fixed left-0 top-0">
            <div className="p-6 flex items-center justify-center border-b border-jewelry-gray">
                <div className="flex flex-col items-center">
                    <h1 className="text-2xl font-display font-bold text-jewelry-light tracking-widest uppercase">
                        M<span className="text-jewelry-gold">ch.</span>
                    </h1>
                    <p className="text-xs text-jewelry-light/60 tracking-widest uppercase mt-1">Marcelo Chavan</p>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                ? 'bg-jewelry-gray text-jewelry-gold'
                                : 'text-jewelry-light hover:bg-jewelry-gray/50 hover:text-jewelry-white'
                            }`
                        }
                    >
                        <item.icon size={20} />
                        <span className="font-medium">{item.name}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-jewelry-gray">
                <button className="flex w-full items-center space-x-3 px-4 py-3 text-jewelry-light hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors">
                    <LogOut size={20} />
                    <span className="font-medium">Salir</span>
                </button>
            </div>
        </aside>
    );
};

const Header = () => {
    return (
        <header className="h-20 bg-jewelry-darker border-b border-jewelry-gray flex items-center justify-end px-8 sticky top-0 z-10">
            <div className="flex items-center space-x-4">
                <div className="text-right hidden md:block">
                    <p className="text-sm font-medium text-jewelry-light">Admin</p>
                    <p className="text-xs text-jewelry-light/60">gerencia@marcelochavan.com</p>
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
