import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import StockList from './pages/StockList';
import StockForm from './pages/StockForm';

// Simple placeholder for pages we haven't built yet
const ComingSoon = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-[60vh]">
    <h2 className="text-4xl font-display font-medium text-jewelry-gold mb-2">{title}</h2>
    <p className="text-jewelry-light/60">Sección en desarrollo para la joyería Marcelo Chavan.</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="inventario">
            <Route index element={<StockList />} />
            <Route path="nuevo" element={<StockForm />} />
            <Route path="editar/:id" element={<StockForm />} />
          </Route>
          <Route path="relojes" element={<ComingSoon title="Stock de Relojes" />} />
          <Route path="joyas" element={<ComingSoon title="Stock de Joyas" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
