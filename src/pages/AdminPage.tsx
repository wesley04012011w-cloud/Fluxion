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
  ExternalLink,
  MessageSquare,
  X
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
  addDoc,
  where,
  getDocs
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
  
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [isPublishingAnnouncement, setIsPublishingAnnouncement] = useState(false);

  const [viewingChatId, setViewingChatId] = useState<string | null>(null);
  const [viewingChatMessages, setViewingChatMessages] = useState<any[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

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
      query(collection(db, 'security_alerts'), orderBy('createdAt', 'desc'), limit(100)),
      (snapshot) => {
        console.log('🛡️ Admin: Received', snapshot.size, 'security alerts');
        setAlerts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SecurityAlert)));
      },
      (error) => {
        console.error('🛡️ Admin: Alerts snapshot error:', error);
      }
    );

    // Fetch Error Logs
    const errorsUnsubscribe = onSnapshot(
      query(collection(db, 'error_logs'), orderBy('createdAt', 'desc'), limit(50)),
      (snapshot) => {
        setErrorLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    // Fetch Announcements
    const announcementsUnsubscribe = onSnapshot(
      query(collection(db, 'announcements'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => {
      configUnsubscribe();
      usersUnsubscribe();
      alertsUnsubscribe();
      errorsUnsubscribe();
      announcementsUnsubscribe();
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

  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const banUser = async (uid: string) => {
    try {
      if (processingAction) return;
      setProcessingAction('ban_' + uid);
      await setDoc(doc(db, 'users', uid), {
        isBanned: true,
        bannedAt: Timestamp.now()
      }, { merge: true });
    } catch (e: any) {
      alert('❌ Erro crítico ao banir: ' + e.code + ' - ' + e.message);
    } finally {
      setProcessingAction(null);
    }
  };

  const blockUser = async (uid: string, h: number) => {
    try {
      if (processingAction) return;
      setProcessingAction('block_' + uid);
      const until = new Date();
      until.setHours(until.getHours() + h);
      await setDoc(doc(db, 'users', uid), {
        blockedUntil: Timestamp.fromDate(until)
      }, { merge: true });
    } catch (e: any) {
      alert('❌ Erro crítico ao bloquear: ' + e.code + ' - ' + e.message);
    } finally {
      setProcessingAction(null);
    }
  };

  const unblockUser = async (uid: string) => {
    try {
      if (processingAction) return;
      setProcessingAction('unblock_' + uid);
      await setDoc(doc(db, 'users', uid), {
        isBanned: false,
        blockedUntil: null,
        bannedAt: null
      }, { merge: true });
    } catch (e: any) {
      alert('❌ Erro crítico ao liberar: ' + e.code + ' - ' + e.message);
    } finally {
      setProcessingAction(null);
    }
  };

  const publishAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      alert('Preencha título e conteúdo!');
      return;
    }
    setIsPublishingAnnouncement(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        createdAt: Timestamp.now(),
        createdBy: user?.uid,
        isActive: true
      });
      setNewAnnouncement({ title: '', content: '' });
      setShowAnnouncementModal(false);
      alert('✅ Comunicado publicado!');
    } catch (e: any) {
      alert('❌ Erro ao publicar: ' + e.message);
    } finally {
      setIsPublishingAnnouncement(false);
    }
  };

  const toggleAnnouncementStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'announcements', id), {
        isActive: !currentStatus
      });
    } catch (e: any) {
      alert('❌ Erro: ' + e.message);
    }
  };

  const openChatView = async (chatId?: string) => {
    if (!chatId) {
      alert('Id do chat não encontrado para este alerta.');
      return;
    }
    setViewingChatId(chatId);
    setViewingChatMessages([]);
    setIsLoadingChat(true);
    try {
      const q = query(collection(db, `chats/${chatId}/messages`), orderBy('createdAt', 'asc'));
      const unsub = onSnapshot(q, (snapshot) => {
        setViewingChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setIsLoadingChat(false);
      });
      // Not storing unsub for now, simple view
    } catch (e: any) {
      alert('❌ Erro ao abrir chat: ' + e.message);
      setIsLoadingChat(false);
    }
  };

  const openRecentChatView = async (userId: string) => {
    setViewingChatId('Procurando...');
    setViewingChatMessages([]);
    setIsLoadingChat(true);
    try {
      const qChats = query(collection(db, 'chats'), where('userId', '==', userId), orderBy('updatedAt', 'desc'), limit(1));
      const snap = await getDocs(qChats);
      if (snap.empty) {
        alert('Nenhum chat encontrado para este usuário.');
        setViewingChatId(null);
        setIsLoadingChat(false);
        return;
      }
      openChatView(snap.docs[0].id);
    } catch (e: any) {
      alert('❌ Erro ao buscar chat recente: ' + e.message);
      setViewingChatId(null);
      setIsLoadingChat(false);
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
                        {alert.chatId ? (
                          <button 
                            onClick={() => openChatView(alert.chatId)}
                            className="text-[9px] font-bold text-blue-500 hover:bg-blue-500/10 transition-all uppercase tracking-widest border border-blue-500/20 px-3 py-1 rounded-md"
                          >
                            Ver Chat
                          </button>
                        ) : (
                          <button 
                            onClick={() => openRecentChatView(alert.userId)}
                            className="text-[9px] font-bold text-blue-400 hover:bg-blue-400/10 transition-all uppercase tracking-widest border border-blue-400/20 px-3 py-1 rounded-md opacity-80"
                          >
                            Ver Último Chat
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
                {users.map((u) => {
                  const lastActive = u.lastActive?.toDate?.() || new Date(0);
                  const now = new Date();
                  // threshold de 2 minutos para ser considerado online real
                  const isOnline = (now.getTime() - lastActive.getTime()) < 120000;
                  const isSuspended = u.isBanned || (u.blockedUntil && u.blockedUntil.toMillis() > now.getTime());

                  return (
                  <div key={u.uid} className="p-4 flex flex-col gap-3 group border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <img 
                        src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                        className="w-10 h-10 rounded-full border border-white/10"
                        alt=""
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate leading-tight flex items-center gap-2">
                          {u.displayName || u.email?.split('@')[0] || 'Desconhecido'}
                          {u.isBanned && (
                            <span className="bg-red-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">BANIDO</span>
                          )}
                          {!u.isBanned && u.blockedUntil && u.blockedUntil.toMillis() > now.getTime() && (
                            <span className="bg-orange-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">SUSPENSO</span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={cn("w-2 h-2 rounded-full shadow-sm", isOnline ? "bg-green-500 animate-pulse" : "bg-gray-700")} />
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tight">{isOnline ? 'Online AGORA' : 'Offline'}</p>
                          <span className="text-[8px] text-gray-700 font-mono">• {u.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full mt-2 lg:mt-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                      {isSuspended ? (
                        <button 
                          onClick={() => unblockUser(u.uid)}
                          disabled={processingAction === 'unblock_' + u.uid}
                          className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 text-[9px] font-black py-1.5 rounded-lg border border-green-500/20 uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingAction === 'unblock_' + u.uid ? 'PROCESSANDO...' : 'LIBERAR'}
                        </button>
                      ) : (
                        <>
                          <div className="flex-1 relative group/menu">
                            <button disabled={processingAction === 'block_' + u.uid || processingAction === 'ban_' + u.uid} className="w-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 text-[9px] font-black py-1.5 rounded-lg border border-orange-500/20 uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                              BLOQUEAR
                            </button>
                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover/menu:block bg-zinc-900 border border-white/10 p-1 rounded-xl shadow-2xl z-50 min-w-[120px]">
                              {[1, 12, 24, 168].map(h => (
                                <button 
                                  key={h}
                                  onClick={() => blockUser(u.uid, h)}
                                  className="block w-full text-left px-3 py-2 hover:bg-white/5 text-[9px] font-bold cursor-pointer"
                                >
                                  {h < 24 ? `🕒 ${h} HORAS` : `📅 ${h/24} DIAS`}
                                </button>
                              ))}
                            </div>
                          </div>
                          <button 
                            onClick={() => banUser(u.uid)}
                            disabled={processingAction === 'ban_' + u.uid || processingAction === 'block_' + u.uid}
                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[9px] font-black py-1.5 rounded-lg border border-red-500/20 uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingAction === 'ban_' + u.uid ? 'BANINDO...' : 'BANIR'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )})}
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

            {/* Comunicados */}
            <section className="p-6 ui-card border border-white/5 bg-white/[0.02] rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-purple-500/10 rounded-lg ui-border border-purple-500/20 text-purple-400">
                      <FileText size={18} />
                   </div>
                   <h2 className="text-sm font-black uppercase tracking-tight">Comunicados</h2>
                </div>
                <button 
                  onClick={() => setShowAnnouncementModal(true)}
                  className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all border border-purple-500/20"
                >
                  NOVO
                </button>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {announcements.length === 0 ? (
                  <p className="text-[10px] text-gray-500 italic">Nenhum comunicado.</p>
                ) : (
                  announcements.map((ann) => (
                    <div key={ann.id} className="bg-black/40 border border-white/5 p-3 rounded-xl">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-bold text-white truncate pr-2">{ann.title}</h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleAnnouncementStatus(ann.id, ann.isActive)}
                            className={cn(
                              "text-[8px] font-black px-2 py-0.5 rounded uppercase",
                              ann.isActive ? "bg-green-500/20 text-green-500" : "bg-gray-500/20 text-gray-500"
                            )}
                          >
                            {ann.isActive ? 'ATIVO' : 'INATIVO'}
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 line-clamp-2">{ann.content}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* Modal de Comunicado */}
      <AnimatePresence>
        {showAnnouncementModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
            >
              <h2 className="text-lg font-black text-white mb-4">Novo Comunicado</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Título</label>
                  <input
                    type="text"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-purple-500/50 text-white"
                    placeholder="Título chamativo"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Mensagem</label>
                  <textarea
                    value={newAnnouncement.content}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-purple-500/50 text-white min-h-[100px] resize-none"
                    placeholder="Escreva a mensagem..."
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setShowAnnouncementModal(false)}
                    className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
                  >
                    CANCELAR
                  </button>
                  <button
                    onClick={publishAnnouncement}
                    disabled={isPublishingAnnouncement}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-6 py-2 rounded-xl transition-all disabled:opacity-50"
                  >
                    {isPublishingAnnouncement ? 'PUBLICANDO...' : 'PUBLICAR'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Visão de Chat */}
      <AnimatePresence>
        {viewingChatId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex flex-col p-4 md:p-10"
          >
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-4xl mx-auto flex flex-col flex-1 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <MessageSquare size={20} className="text-blue-400" />
                  <h2 className="text-sm font-bold text-white">Visualização de Chat ({viewingChatId})</h2>
                </div>
                <button
                  onClick={() => setViewingChatId(null)}
                  className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-xl transition-all border border-white/5"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                {isLoadingChat ? (
                  <div className="h-full flex items-center justify-center text-gray-500 font-mono text-sm">Carregando mensagens...</div>
                ) : viewingChatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 font-mono text-sm">Nenhuma mensagem neste chat.</div>
                ) : (
                  viewingChatMessages.map((msg, idx) => (
                    <div key={idx} className={cn("max-w-[85%] rounded-2xl p-4", msg.role === 'user' ? "ml-auto bg-blue-500/10 border border-blue-500/20 text-blue-100" : "mr-auto bg-white/5 border border-white/10 text-gray-300")}>
                      <span className="block text-[10px] font-bold mb-1 opacity-50 uppercase">{msg.role === 'user' ? 'Usuário' : 'Fluxion'}</span>
                      <div className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{msg.content}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
