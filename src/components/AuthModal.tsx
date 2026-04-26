import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, User, Key, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { signUpWithEmail, logInWithEmail, resetPassword, signInWithGoogle } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, username);
        setMessage({ type: 'success', text: 'Conta criada! Verifique seu e-mail para ativar.' });
      } else if (mode === 'login') {
        await logInWithEmail(email, password);
        onClose();
      } else {
        await resetPassword(email);
        setMessage({ type: 'success', text: 'E-mail de recuperação enviado!' });
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let errorText = 'Ocorreu um erro ao processar sua solicitação.';
      
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found') {
        errorText = 'Credenciais inválidas. Verifique seu e-mail e senha, ou clique em "Crie sua conta" se for novo.';
      } else if (err?.code === 'auth/email-already-in-use') {
        errorText = 'Este e-mail já está em uso.';
      } else if (err?.code === 'auth/weak-password') {
        errorText = 'A senha deve ter pelo menos 6 caracteres.';
      } else if (err?.message) {
        errorText = err.message;
      }
      
      setMessage({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setMessage(null);
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error("Google auth error:", err);
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return; // ignore cancellation
      }
      setMessage({ type: 'error', text: err.message || 'Erro ao fazer login com o Google.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#0A0B10] border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)]"
      >
        <div className="p-8 relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
          >
            <X size={20} />
          </button>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
              {mode === 'login' ? 'Acesso ao Studio' : mode === 'signup' ? 'Nova Conta' : 'Recuperação'}
            </h2>
            <p className="text-gray-400 text-sm font-medium">
              {mode === 'login' ? 'Digite seu e-mail e senha para continuar.' : mode === 'signup' ? 'Preencha os dados para se registrar.' : 'Informe seu e-mail para receber o link.'}
            </p>
          </div>

          {message && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className={`mb-6 p-4 rounded-xl text-sm font-semibold flex flex-col gap-1 ${
                message.type === 'success' 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {message.text}
              </div>
              {message.type === 'error' && (
                <p className="text-[10px] opacity-70 mt-1">
                  Dica: Se estiver no celular, tente abrir em uma nova aba para evitar bloqueios do navegador.
                </p>
              )}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Username</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    placeholder="Como quer ser chamado?"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">E-mail</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  placeholder="Seu melhor e-mail"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Senha</label>
                  {mode === 'login' && (
                    <button 
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-12 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group relative overflow-hidden shadow-lg shadow-blue-900/20 mt-4"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  <span className="relative z-10">
                    {mode === 'login' ? 'Entrar no Studio' : mode === 'signup' ? 'Criar Conta Agora' : 'Enviar Link de Resgate'}
                  </span>
                  <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-black">
              <span className="bg-[#0A0B10] px-3 text-gray-600">Conexão Segura</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="w-full mt-8 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3.5 rounded-2xl transition-all flex items-center justify-center gap-3 font-bold group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Entrar com Google
          </button>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 font-medium">
              {mode === 'login' ? 'Novo por aqui?' : 'Já possui cadastro?'}
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="ml-2 text-blue-400 font-bold hover:text-blue-300 transition-colors"
              >
                {mode === 'login' ? 'Crie sua conta' : 'Fazer login'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
