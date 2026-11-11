import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { Search, Plus, FileText, FileSpreadsheet, Loader2, ShoppingCart } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiFetch, API_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const MOTIVOS = {
    Devolución: 'Devolución a proveedor',
    Garantía: 'Garantía / Reparación',
    Merma: 'Merma / Pérdida',
    Regalo: 'Regalo / Muestra',
    Ajuste: 'Ajuste de inventario',
    Otro: 'Otro',
    // Registros cargados antes de que existiera el módulo de Ventas
    Venta: 'Venta (registro anterior)',
};

const labelMotivo = (m) => MOTIVOS[m] || m || 'N/A';

const EgresosList = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const { esGestion } = useAuth();
    const [egresos, setEgresos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEgresos = async () => {
            try {
                const response = await apiFetch(`${API_URL}/Egresos`);
                if (response.ok) {
                    const data = await response.json();
                    setEgresos(data);
                }
            } catch (error) {
                console.error("Error fetching egresos:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEgresos();
    }, []);

    const filteredEgresos = egresos.filter(egreso =>
        egreso.item?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        egreso.item?.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        egreso.motivo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        egreso.observaciones?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleExportExcel = () => {
        const dataToExport = filteredEgresos.map(e => ({
            'ID': e.id,
            'Fecha': new Date(e.fechaEgreso).toLocaleString('es-AR'),
            'Producto': e.item?.nombre || 'Desconocido',
            'SKU': e.item?.sku || 'N/A',
            'Cantidad': e.cantidad,
            'Motivo': labelMotivo(e.motivo),
            'Observaciones': e.observaciones || '',
            'Usuario': e.usuario || ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Egresos");
        XLSX.writeFile(wb, `Egresos_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(`Historial de Egresos de Stock`, 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generado el: ${new Date().toLocaleString('es-AR')}`, 14, 30);

        const tableColumn = ["ID", "Fecha", "Producto", "SKU", "Cantidad", "Motivo", "Usuario"];
        const tableRows = [];

        filteredEgresos.forEach(e => {
            const rowData = [
                e.id,
                new Date(e.fechaEgreso).toLocaleString('es-AR'),
                e.item?.nombre || 'Desconocido',
                e.item?.sku || 'N/A',
                e.cantidad.toString(),
                labelMotivo(e.motivo) + (e.observaciones ? ` (${e.observaciones})` : ''),
                e.usuario || '-'
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'grid',
            headStyles: { fillColor: [24, 24, 27] } // Matches jewelry-darker
        });

        doc.save(`Egresos_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-jewelry-light tracking-tight">Egresos de Stock</h2>
                    <p className="text-jewelry-light/60 mt-1">Mercadería que salió sin cobro: devoluciones, garantías, mermas, regalos y ajustes. Las ventas están en "Ventas".</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <Button variant="outline" className="flex items-center gap-2 hover:border-green-500/50 hover:bg-green-500/10 transition-colors" onClick={handleExportExcel} title="Exportar a Excel">
                        <FileSpreadsheet size={18} className="text-green-500" />
                        <span className="hidden sm:inline">Excel</span>
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2 hover:border-red-500/50 hover:bg-red-500/10 transition-colors" onClick={handleExportPDF} title="Exportar a PDF">
                        <FileText size={18} className="text-red-400" />
                        <span className="hidden sm:inline">PDF</span>
                    </Button>
                    {esGestion && <Button variant="primary" className="flex items-center gap-2" onClick={() => navigate('/egresos/nuevo')}>
                        <Plus size={18} />
                        Registrar Egreso
                    </Button>}
                </div>
            </div>

            <Card>
                <div className="p-4 border-b border-jewelry-gray flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-jewelry-light/50">
                            <Search size={18} />
                        </div>
                        <Input
                            placeholder="Buscar por producto, SKU o motivo..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
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
                                    <th className="px-6 py-4 font-medium">Fecha</th>
                                    <th className="px-6 py-4 font-medium">Producto</th>
                                    <th className="px-6 py-4 font-medium text-center">Cantidad</th>
                                    <th className="px-6 py-4 font-medium">Motivo</th>
                                    <th className="px-6 py-4 font-medium">Usuario</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEgresos.map((e) => (
                                    <tr key={e.id} className="border-b border-jewelry-gray/50 hover:bg-jewelry-gray/20 transition-colors">
                                        <td className="px-6 py-4 text-jewelry-light/80">
                                            {new Date(e.fechaEgreso).toLocaleString('es-AR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-jewelry-light">{e.item?.nombre || 'Desconocido'}</div>
                                            <div className="text-xs text-jewelry-light/50 mt-1">SKU: {e.item?.sku || 'N/A'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-bold text-red-500">-{e.cantidad}</span>
                                        </td>
                                        <td className="px-6 py-4 text-jewelry-light/80">
                                            <span className={e.motivo === 'Venta' ? 'text-jewelry-light/50 italic' : ''}>{labelMotivo(e.motivo)}</span>
                                            {e.observaciones && <div className="text-xs text-jewelry-light/50 mt-1">{e.observaciones}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-jewelry-light/60 text-xs">
                                            {e.usuario || '-'}
                                        </td>
                                    </tr>
                                ))}
                                {filteredEgresos.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-jewelry-light/50">
                                            No se encontraron registros de egresos.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default EgresosList;
