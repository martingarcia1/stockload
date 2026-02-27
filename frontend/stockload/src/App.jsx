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

// Simple placeholder for pages we haven't built yet
const ComingSoon = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-[60vh]">
    <h2 className="text-4xl font-display font-medium text-jewelry-gold mb-2">{title}</h2>
    <p className="text-jewelry-light/60">Sección en desarrollo para la joyería Marcelo Chavan.</p>
  </div>
);

// Componente para proteger las rutas
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // O un spinner

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
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
            <Route path="inventario">
              <Route index element={<StockList key="todas" />} />
              <Route path="nuevo" element={<StockForm />} />
              <Route path="editar/:id" element={<StockForm />} />
            </Route>
            <Route path="relojes" element={<StockList key="relojes" defaultCategory="Relojes" />} />
            <Route path="joyas" element={<StockList key="joyas" defaultCategory="Joyas" />} />
            <Route path="egresos">
              <Route index element={<EgresosList />} />
              <Route path="nuevo" element={<EgresoForm />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
