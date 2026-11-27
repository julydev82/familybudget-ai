import React, { useState } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';

const inputClass = "w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 focus:border-indigo-500 outline-none transition-all font-medium";

const authErrorMessage = (code: string | undefined, mode: 'login' | 'signup') => {
    switch (code) {
        case 'auth/email-already-in-use': return 'Ya existe una cuenta con ese correo. Inicia sesión.';
        case 'auth/invalid-email': return 'El correo no es válido.';
        case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.';
        case 'auth/too-many-requests': return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
        case 'auth/network-request-failed': return 'Sin conexión. Verifica tu internet.';
        case 'auth/operation-not-allowed': return 'El registro de cuentas no está habilitado.';
        default: return mode === 'login'
            ? 'Error al iniciar sesión. Verifica tus credenciales.'
            : 'No se pudo crear la cuenta. Inténtalo de nuevo.';
    }
};

const Login: React.FC = () => {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const switchMode = (m: 'login' | 'signup') => {
        setMode(m);
        setError('');
        setPassword('');
        setConfirm('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (mode === 'signup') {
            if (!name.trim()) { setError('Escribe tu nombre.'); return; }
            if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
            if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
        }

        setLoading(true);
        try {
            if (mode === 'login') {
                await signInWithEmailAndPassword(auth, email.trim(), password);
            } else {
                const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
                await updateProfile(cred.user, { displayName: name.trim() });
                try {
                    await sendEmailVerification(cred.user);
                } catch (err) {
                    console.warn('No se pudo enviar el correo de verificación:', err);
                }
                // Refresca el token para que la app reciba el nombre recién asignado.
                await cred.user.getIdToken(true);
            }
        } catch (err: any) {
            console.error(err);
            setError(authErrorMessage(err?.code, mode));
        } finally {
            setLoading(false);
        }
    };

    const isSignup = mode === 'signup';

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 animate-fade-in border border-slate-100">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-indigo-200 mb-4">F</div>
                    <h1 className="text-2xl font-bold text-slate-800">FamilyBudget</h1>
                    <p className="text-slate-400 font-medium">{isSignup ? 'Crea tu cuenta' : 'Inicia sesión para continuar'}</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-6">
                    <button type="button" onClick={() => switchMode('login')}
                        className={`flex-1 py-2 rounded-xl text-xs font-black tracking-widest transition-all ${!isSignup ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        INICIAR SESIÓN
                    </button>
                    <button type="button" onClick={() => switchMode('signup')}
                        className={`flex-1 py-2 rounded-xl text-xs font-black tracking-widest transition-all ${isSignup ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        CREAR CUENTA
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100 flex items-center gap-2">
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isSignup && (
                        <div>
                            <label htmlFor="name" className="block text-sm font-bold text-slate-700 mb-2 ml-1">Nombre</label>
                            <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)}
                                className={inputClass} placeholder="Tu nombre" required />
                        </div>
                    )}
                    <div>
                        <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-2 ml-1">Correo Electrónico</label>
                        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                            className={inputClass} placeholder="nombre@ejemplo.com" required />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-bold text-slate-700 mb-2 ml-1">Contraseña</label>
                        <input id="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} value={password}
                            onChange={(e) => setPassword(e.target.value)} className={inputClass}
                            placeholder={isSignup ? 'Mínimo 6 caracteres' : '••••••••'} required />
                    </div>
                    {isSignup && (
                        <div>
                            <label htmlFor="confirm" className="block text-sm font-bold text-slate-700 mb-2 ml-1">Confirmar contraseña</label>
                            <input id="confirm" type="password" autoComplete="new-password" value={confirm}
                                onChange={(e) => setConfirm(e.target.value)} className={inputClass} placeholder="Repite la contraseña" required />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {loading ? (isSignup ? 'Creando cuenta...' : 'Entrando...') : (isSignup ? 'Crear cuenta' : 'Iniciar Sesión')}
                    </button>
                </form>

                {isSignup && (
                    <p className="mt-6 text-xs text-slate-400 text-center">
                        Te enviaremos un correo para confirmar tu cuenta. Tendrá sus propios gastos, ingresos y categorías; nadie más podrá verlos.
                    </p>
                )}
            </div>
        </div>
    );
};

export default Login;
