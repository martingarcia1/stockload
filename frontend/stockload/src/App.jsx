import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import StockList from './pages/StockList';
import StockForm from './pages/StockForm';
import EgresosList from './pages/EgresosList';
import EgresoForm from './pages/EgresoForm';
import Login from './pages/Login';
import PuntoVenta from './pages/PuntoVenta';
import VentasList from './pages/VentasList';
import Caja from './pages/Caja';
import ArqueoDiario from './pages/ArqueoDiario';
import Usuarios from './pages/Usuarios';
import Configuracion from './pages/Configuracion';
import Facturacion from './pages/Facturacion';

// Componente para proteger las rutas
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // O un spinner

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Sólo Propietario y Administradora
const GestionRoute = ({ children }) => {
  const { esGestion } = useAuth();
  return esGestion ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="ventas">
              <Route index element={<VentasList />} />
              <Route path="nueva" element={<PuntoVenta />} />
            </Route>
            <Route path="facturacion" element={<Facturacion />} />
            <Route path="inventario">
              <Route index element={<StockList key="todas" />} />
              <Route path="nuevo" element={<GestionRoute><StockForm /></GestionRoute>} />
              <Route path="editar/:id" element={<GestionRoute><StockForm /></GestionRoute>} />
            </Route>
            <Route path="relojes" element={<StockList key="relojes" defaultCategory="Relojes" />} />
            <Route path="joyas" element={<StockList key="joyas" defaultCategory="Joyas" />} />
            <Route path="plateria" element={<StockList key="plateria" defaultCategory="Platería" />} />
            <Route path="acero" element={<StockList key="acero" defaultCategory="Acero" />} />
            <Route path="egresos">
              <Route index element={<EgresosList />} />
              <Route path="nuevo" element={<GestionRoute><EgresoForm /></GestionRoute>} />
            </Route>
            <Route path="caja" element={<GestionRoute><Caja /></GestionRoute>} />
            <Route path="arqueo-diario" element={<GestionRoute><ArqueoDiario /></GestionRoute>} />
            <Route path="usuarios" element={<GestionRoute><Usuarios /></GestionRoute>} />
            <Route path="configuracion" element={<GestionRoute><Configuracion /></GestionRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
