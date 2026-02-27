import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react';
import { API_URL } from '../utils/api';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/Auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (response.ok) {
                const data = await response.json();
                login(data.token, { email: data.email, rol: data.rol });
                navigate('/');
            } else {
                const errData = await response.json();
                setError(errData.message || 'Credenciales incorrectas');
            }
        } catch (err) {
            console.error("Error al iniciar sesión:", err);
            setError('Error de conexión al servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-jewelry-dark flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-display font-bold text-jewelry-light tracking-widest uppercase">
                        M<span className="text-jewelry-gold">ch.</span>
                    </h1>
                    <p className="text-sm text-jewelry-light/60 tracking-widest uppercase mt-2">Marcelo Chavan</p>
                    <p className="text-jewelry-light/40 mt-6 text-sm">Sistema de Gestión de Inventario</p>
                </div>

                <Card className="border border-jewelry-gray/40 shadow-2xl shadow-jewelry-gold/5">
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3">
                                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-jewelry-light/80">
                                    Correo Electrónico
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-jewelry-light/50">
                                        <Mail size={18} />
                                    </div>
                                    <Input
                                        type="email"
                                        placeholder="admin@ejemplo.com"
                                        className="pl-10 h-12"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-jewelry-light/80">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-jewelry-light/50">
                                        <Lock size={18} />
                                    </div>
                                    <Input
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-10 h-12"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                className="w-full h-12 text-base flex justify-center items-center gap-2 mt-4"
                                disabled={loading}
                            >
                                {loading ? (
                                    <><Loader2 className="animate-spin" size={20} /> Autenticando...</>
                                ) : (
                                    'Iniciar Sesión'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Login;
