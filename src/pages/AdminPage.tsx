import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ChevronLeft,
  Search,
  RefreshCw,
  User as UserIcon,
  AlertTriangle,
  FileText,
  Activity,
  Key as KeyIcon,
  Save,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser, OperationType, handleFirestoreError, cn, SecurityAlert, AppConfig } from '../types';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc,
  updateDoc,
  limit,
  Timestamp,
  setDoc,
  addDoc
} from 'firebase/firestore';

const ADMIN_EMAILS = ["wesley04012011w@gmail.com", "soparonosk37@gmail.com"];

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [groqKey, setGroqKey] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  
  const [users, setUsers] = useState<AppUser[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && u.email && ADMIN_EMAILS.includes(u.email)) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        if (!loading) navigate('/');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate, loading]);

  useEffect(() => {
    if (!isAdmin) return;

    // Fetch Config
    const configUnsubscribe = onSnapshot(doc(db, 'config', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppConfig;
        setAppConfig(data);
        setGroqKey(data.groqApiKey || '');
      }
    });

    // Fetch Users
    const usersUnsubscribe = onSnapshot(
      query(collection(db, 'users'), orderBy('lastActive', 'desc'), limit(50)),
      (snapshot) => {
        setUsers(snapshot.docs.map(d => ({ ...d.data() } as AppUser)));
      }
    );

    // Fetch Security Alerts
    const alertsUnsubscribe = onSnapshot(
      query(collection(db, 'security_alerts'), orderBy('createdAt', 'desc'), limit(50)),
      (snapshot) => {
        setAlerts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SecurityAlert)));
      }
    );

    // Fetch Error Logs
    const errorsUnsubscribe = onSnapshot(
      query(collection(db, 'error_logs'), orderBy('createdAt', 'desc'), limit(50)),
      (snapshot) => {
        setErrorLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => {
      configUnsubscribe();
      usersUnsubscribe();
      alertsUnsubscribe();
      errorsUnsubscribe();
    };
  }, [isAdmin]);

  const [isTestingGroq, setIsTestingGroq] = useState(false);

  const testGroq = async () => {
    if (!groqKey) return;
    setIsTestingGroq(true);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'Connection test' }],
          max_tokens: 5
        })
      });
      if (response.ok) alert('✅ Conexão com Groq OK!');
      else {
        const errData = await response.json();
        alert(`❌ Erro na Groq: ${errData.error?.message || response.statusText}`);
      }
    } catch (e: any) {
      alert(`❌ Falha na conexão: ${e.message}`);
    } finally {
      setIsTestingGroq(false);
    }
  };

  const sendManualAudit = async () => {
    console.log('Sending manual audit...');
    try {
      const alertRef = await addDoc(collection(db, 'security_alerts'), {
        userId: auth.currentUser?.uid || 'system_fallback',
        userEmail: auth.currentUser?.email || 'system_fallback',
        type: 'test',
        content: 'Teste manual de alerta de segurança (Botão pressionado no Painel)',
        analysis: 'O administrador executou um teste de trigger de log manual.',
        severity: 'low',
        createdAt: Timestamp.now(),
        status: 'pending'
      });
      console.log('Document written with ID: ', alertRef.id);
      alert('✅ Alerta de teste enviado com sucesso! Verifique a lista de alertas.');
    } catch (e: any) {
      console.error('Error adding document: ', e);
      alert(`❌ Erro ao enviar log: ${e.message}`);
    }
  };

  const handleSaveGroqKey = async () => {
    if (!isAdmin) return;
    setIsSavingConfig(true);
    try {
      await setDoc(doc(db, 'config', 'main'), {
        groqApiKey: groqKey,
        updatedAt: Timestamp.now()
      }, { merge: true });
      alert('✅ Chave Groq salva com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/main', user);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await updateDoc(doc(db, 'security_alerts', alertId), {
        status: 'reviewed'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `security_alerts/${alertId}`, user);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <RefreshCw className="text-white animate-spin" size={32} />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="h-screen bg-[#050505] text-white overflow-y-auto custom-scrollbar font-sans relative">
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-10 fixed"
        style={{
          background: `radial-gradient(circle at 50% 120%, #ef4444 0%, transparent 60%)`
        }}
      />

      <div className="max-w-6xl mx-auto p-4 md:p-12 relative z-10">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white border border-white/10"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase flex items-center gap-3">
                <Shield className="text-red-500" size={24} />
                Painel Administrativo
              </h1>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Controle de Segurança e Staff</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Status do Sistema</p>
              <div className="flex items-center gap-2 justify-end">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold">OPERACIONAL</span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Security Alerts */}
            <section className="ui-card border border-white/5 bg-white/[0.02] overflow-hidden rounded-2xl">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-3">
                   <AlertTriangle className="text-yellow-500" size={20} />
                   <h2 className="text-sm font-black uppercase tracking-tight">Alertas de Segurança</h2>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded-md border border-yellow-500/20">
                  {alerts.filter(a => a.status === 'pending').length} PENDENTES
                </span>
              </div>
              <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
                {alerts.length === 0 ? (
                  <div className="p-12 text-center text-gray-600">
                    <CheckCircle size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">Nenhum alerta detectado</p>
                  </div>
                ) : (
                  alerts.map((alert: any) => (
                    <div key={alert.id} className="p-4 hover:bg-white/[0.02] transition-all group">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase",
                            alert.severity === 'high' ? "bg-red-500 text-white" : 
                            alert.severity === 'medium' ? "bg-orange-500 text-white" : "bg-blue-500 text-white"
                          )}>
                             {alert.type || 'ALERTA'}
                          </span>
                          <span className="text-xs font-bold text-gray-300">{alert.userEmail}</span>
                        </div>
                        <span className="text-[9px] text-gray-600 flex items-center gap-1 font-mono uppercase">
                          {alert.severity} • {alert.createdAt?.toDate().toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[11px] text-red-400 font-black uppercase tracking-tight">
                           IA: {alert.analysis || 'Detectada atividade suspeita'}
                        </p>
                        
                        {/* Flow Status Dashboard */}
                        {alert.flow && (
                          <div className="flex flex-wrap gap-2 py-2">
                            <div className={cn(
                              "text-[8px] font-bold px-2 py-0.5 rounded-full border",
                              alert.flow.readMessage ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                            )}>
                              MENSAGEM LIDA: {alert.flow.readMessage ? 'SIM' : 'NÃO'}
                            </div>
                            <div className={cn(
                              "text-[8px] font-bold px-2 py-0.5 rounded-full border",
                              alert.flow.responseSent ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                            )}>
                              ENVIADO: {alert.flow.responseSent ? 'SIM' : 'FALHOU'}
                            </div>
                            <div className={cn(
                              "text-[8px] font-bold px-2 py-0.5 rounded-full border",
                              alert.flow.blocked ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"
                            )}>
                              BLOQUEADO: {alert.flow.blocked ? `SIM (${alert.flow.blockedBy})` : 'NÃO'}
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-gray-500 font-mono leading-relaxed bg-black/40 p-2 rounded-lg border border-white/5 line-clamp-3">
                          {alert.content}
                        </p>

                        {alert.flow?.error && (
                          <p className="text-[9px] text-red-500/70 font-mono bg-red-500/5 p-2 rounded border border-red-500/10 italic">
                            ERRO TÉCNICO: {alert.flow.error}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {alert.status === 'pending' && (
                          <button 
                            onClick={() => resolveAlert(alert.id)}
                            className="text-[9px] font-bold text-green-500 hover:bg-green-500/10 transition-all uppercase tracking-widest border border-green-500/20 px-3 py-1 rounded-md"
                          >
                            Resolver
                          </button>
                        )}
                        <span className="text-[8px] text-gray-600 font-mono italic">ID: {alert.userId.slice(0, 8)}...</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Error Logs */}
            <section className="ui-card border border-white/5 bg-white/[0.02] overflow-hidden rounded-2xl">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-3">
                   <Activity className="text-red-400" size={20} />
                   <h2 className="text-sm font-black uppercase tracking-tight">Logs de Erros de API</h2>
                </div>
              </div>
              <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto custom-scrollbar">
                {errorLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-white/[0.02] transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-red-400/80 uppercase">{log.userEmail || 'Anônimo'}</span>
                      <span className="text-[9px] text-gray-600">
                        {log.createdAt?.toDate().toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate font-mono">{log.error}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">
            
            {/* Groq Integration */}
            <section className="p-6 ui-card border border-white/5 bg-white/[0.02] rounded-2xl">
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 bg-orange-500/10 rounded-lg ui-border border-orange-500/20 text-orange-400">
                    <KeyIcon size={18} />
                 </div>
                 <h2 className="text-sm font-black uppercase tracking-tight">Groq API Security</h2>
              </div>
              <p className="text-[10px] text-gray-500 mb-4 leading-relaxed font-medium capitalize">
                Configure a chave da Groq para ativar a análise de segurança AI em tempo real.
                {!groqKey && (
                  <span className="block text-red-500 font-bold mt-1">⚠️ CHAVE NÃO DETECTADA</span>
                )}
              </p>
              <div className="space-y-4">
                <input
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-[11px] focus:outline-none focus:border-orange-500/50 transition-all font-mono"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={testGroq}
                    disabled={isTestingGroq || !groqKey}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-20 text-white font-bold text-[10px] py-3 rounded-xl transition-all border border-white/10"
                  >
                    {isTestingGroq ? 'TESTANDO...' : 'TESTAR API'}
                  </button>
                  <button 
                    onClick={sendManualAudit}
                    className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold text-[10px] py-3 rounded-xl transition-all border border-blue-500/20"
                  >
                    TESTAR LOGS
                  </button>
                </div>
                <button 
                  onClick={handleSaveGroqKey}
                  disabled={isSavingConfig}
                  className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black text-[10px] py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {isSavingConfig ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  SALVAR CHAVE
                </button>
              </div>
            </section>

            {/* User List */}
            <section className="ui-card border border-white/5 bg-white/[0.02] overflow-hidden rounded-2xl">
              <div className="p-4 border-b border-white/5 bg-white/[0.01]">
                <div className="flex items-center gap-3">
                   <UserIcon className="text-blue-400" size={18} />
                   <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Usuários Recentes</h2>
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                {users.map((u) => (
                  <div key={u.uid} className="p-3 flex items-center gap-3">
                    <img 
                      src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                      className="w-8 h-8 rounded-full border border-white/10"
                      alt=""
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold truncate leading-tight">{u.displayName || u.email?.split('@')[0] || 'Desconhecido'}</p>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", u.isOnline ? "bg-green-500" : "bg-gray-700")} />
                        <p className="text-[8px] text-gray-500 font-bold uppercase">{u.isOnline ? 'Online' : 'Offline'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Quick Stats */}
            <section className="grid grid-cols-2 gap-4">
              <div className="p-4 ui-card border border-white/5 bg-white/[0.02] rounded-xl">
                 <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Métricas</p>
                 <h3 className="text-xl font-black">{users.length}</h3>
                 <p className="text-[8px] text-gray-600 font-bold uppercase">Sessões Ativas</p>
              </div>
              <div className="p-4 ui-card border border-white/5 bg-white/[0.02] rounded-xl">
                 <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Status</p>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <h3 className="text-xs font-black">FIREBASE</h3>
                 </div>
                 <p className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">Latência 42ms</p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
