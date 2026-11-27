import React, { useEffect, useState } from 'react';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../firebase';

const RESEND_COOLDOWN = 60; // segundos

/** Pantalla para cuentas nuevas que aún no confirman su correo. */
const VerifyEmail: React.FC = () => {
    const user = auth.currentUser;
    const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
    const [checking, setChecking] = useState(false);
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const checkVerified = async () => {
        if (!user) return;
        setChecking(true);
        setMessage(null);
        try {
            await user.reload();
            if (user.emailVerified) {
                // Refresca el token: la app detecta la verificación y prepara la cuenta.
                await user.getIdToken(true);
            } else {
                setMessage({ text: 'Tu correo aún no aparece como verificado. Abre el enlace del correo e inténtalo de nuevo.', error: true });
            }
        } catch {
            setMessage({ text: 'No se pudo comprobar. Verifica tu conexión.', error: true });
        } finally {
            setChecking(false);
        }
    };

    const resend = async () => {
        if (!user || cooldown > 0) return;
        try {
            await sendEmailVerification(user);
            setMessage({ text: 'Te enviamos un nuevo correo de verificación.' });
        } catch (err: any) {
            setMessage({
                text: err?.code === 'auth/too-many-requests'
                    ? 'Has pedido demasiados correos. Espera unos minutos.'
                    : 'No se pudo enviar el correo. Inténtalo más tarde.',
                error: true,
            });
        }
        setCooldown(RESEND_COOLDOWN);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 animate-fade-in border border-slate-100 text-center">
                <div className="text-5xl mb-4">📧</div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Verifica tu correo</h1>
                <p className="text-slate-500 font-medium">
                    Te enviamos un enlace a <strong className="text-slate-700 break-words">{user?.email}</strong>.
                    Ábrelo para activar tu cuenta y luego vuelve aquí.
                </p>
                <p className="text-xs text-slate-400 mt-2">Si no lo ves, revisa la carpeta de spam o correo no deseado.</p>

                {message && (
                    <div className={`mt-6 p-4 rounded-2xl text-sm font-bold border ${message.error ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                        {message.text}
                    </div>
                )}

                <button
                    onClick={checkVerified}
                    disabled={checking}
                    className="w-full mt-6 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                    {checking ? 'Comprobando...' : 'Ya verifiqué mi correo'}
                </button>
                <button
                    onClick={resend}
                    disabled={cooldown > 0}
                    className="w-full mt-3 py-3 font-bold text-indigo-600 rounded-2xl hover:bg-indigo-50 transition-all disabled:text-slate-400 disabled:hover:bg-transparent"
                >
                    {cooldown > 0 ? `Reenviar correo (${cooldown}s)` : 'Reenviar correo'}
                </button>
                <button onClick={() => signOut(auth)} className="w-full mt-1 py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-2xl transition-colors">
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
};

export default VerifyEmail;
