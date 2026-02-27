export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5202';
export const API_URL = `${API_BASE_URL}/api`;

export const apiFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');

    const headers = {
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        // Redirigir al inicio o forzar borrado si el token caducó
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }

    return response;
};
