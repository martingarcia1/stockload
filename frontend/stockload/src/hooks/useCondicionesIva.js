import { useEffect, useState } from 'react';
import { apiFetch, API_URL } from '../utils/api';

/** Condiciones frente al IVA válidas para Factura C (lista de ARCA, con respaldo del servidor). */
const useCondicionesIva = () => {
    const [condiciones, setCondiciones] = useState([]);
    useEffect(() => {
        apiFetch(`${API_URL}/facturacion/condiciones-iva`).then(async r => r.ok && setCondiciones(await r.json()));
    }, []);
    return condiciones;
};

export default useCondicionesIva;
