import { useCallback, useEffect, useState } from 'react';
import { apiFetch, API_URL } from '../utils/api';

/**
 * Cotización del dólar que usa el sistema (automática de dolarapi.com o manual, según Configuración).
 * Devuelve { cotizacion: { valor, compra, tipo, fuente, actualizada } | null, error, recargar }.
 */
const useCotizacion = () => {
    const [cotizacion, setCotizacion] = useState(null);
    const [error, setError] = useState('');

    const recargar = useCallback(async () => {
        try {
            const res = await apiFetch(`${API_URL}/configuracion/cotizacion`);
            if (res.ok) {
                setCotizacion(await res.json());
                setError('');
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.message || 'No se pudo obtener la cotización del dólar');
            }
        } catch {
            setError('No se pudo obtener la cotización del dólar');
        }
    }, []);

    useEffect(() => {
        recargar();
        const id = setInterval(recargar, 10 * 60 * 1000);
        return () => clearInterval(id);
    }, [recargar]);

    return { cotizacion, error, recargar };
};

export default useCotizacion;
