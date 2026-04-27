import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ChevronLeft,
  RefreshCw,
  User as UserIcon,
  AlertTriangle,
  FileText,
  Activity,
  Save,
  MessageSquare,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser, OperationType, handleFirestoreError, cn, AppConfig } from '../types';
import { Toaster, toast } from 'sonner';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc,
  updateDoc,
  deleteDoc,
  limit,
  Timestamp,
  setDoc,
  serverTimestamp,
  addDoc,
  where,
  getDocs,
  getDocFromServer
} from '../firebaseMock';

const ADMIN_EMAILS = ["wesley04012011w@gmail.com", "soparonosk37@gmail.com"];

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  
  const [users, setUsers] = useState<AppUser[]>([]);
  const [bannedIps, setBannedIps] = useState<any[]>([]);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [isPublishingAnnouncement, setIsPublishingAnnouncement] = useState(false);

  const [viewingChatId, setViewingChatId] = useState<string | null>(null);
  const [viewingChatMessages, setViewingChatMessages] = useState<any[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  const [expandedUserUid, setExpandedUserUid] = useState<string | null>(null);
  const [userChats, setUserChats] = useState<Record<string, any[]>>({});
  const [loadingUserChats, setLoadingUserChats] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      console.log('🛡️ Admin: Auth State:', u ? { uid: u.uid, email: u.email } : 'Guest');
      if (u && u.email && ADMIN_EMAILS.includes(u.email)) {
        console.log('🛡️ Admin: User recognized as Admin (FE)');
        setIsAdmin(true);
      } else {
        console.log('🛡️ Admin: User NOT recognized as Admin (FE)');
        setIsAdmin(false);
        if (!loading) navigate('/');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate, loading]);

  useEffect(() => {
    if (!isAdmin) return;

    // Fetch Config (Single load to save quota)
    const fetchConfig = async () => {
        try {
            const docSnap = await getDocFromServer(doc(db, 'config', 'main'));
            if (docSnap.exists()) {
                const data = docSnap.data() as AppConfig;
                setAppConfig(data);
                setDeepseekKey(data.deepseekApiKey || '');
                setOpenRouterKey(data.openRouterApiKey || '');
            } else {
                setAppConfig({ maintenanceMode: false } as AppConfig);
            }
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, 'config/main', user);
        }
    };
    fetchConfig();

    // Fetch Users (REMOVED REALTIME LISTENER)
    /*
    const usersUnsubscribe = onSnapshot(
      query(collection(db, 'users'), orderBy('lastActive', 'desc'), limit(50)),
      (snapshot) => {
        setUsers(snapshot.docs.map(d => ({ ...d.data() } as AppUser)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users', user);
      }
    );
    */

    // Fetch Announcements (REMOVED REALTIME LISTENER)
    const fetchAnnouncements = async () => {
        try {
            const snap = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')));
            setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'announcements', user);
        }
    };
    fetchAnnouncements();
  }, [isAdmin]);

  const fetchLogsAndIps = async () => {
    try {
      toast.info('Buscando dados. Isso pode custar cota de leituras...', { duration: 2000, id: 'fetch-logs' });
      const bannedSnap = await getDocs(collection(db, 'banned_ips'));
      setBannedIps(bannedSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const accSnap = await getDocs(query(collection(db, 'access_logs'), orderBy('timestamp', 'desc'), limit(100)));
      setAccessLogs(accSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const usersSnap = await getDocs(query(collection(db, 'users'), where('lastActive', '>=', Timestamp.fromDate(last24h)), orderBy('lastActive', 'desc'), limit(50)));
      setUsers(usersSnap.docs.map(d => ({ ...d.data() } as AppUser)));
      
      toast.success('Logs, IPs e Usuários sincronizados!', { id: 'fetch-logs' });
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'logs/ips/users', user);
      toast.error('Erro ao buscar dados.', { id: 'fetch-logs' });
    }
  };

  const saveAiKeys = async () => {
    setIsSavingConfig(true);
    toast.loading('Salvando chaves na nuvem...', { id: 'save-keys' });
    try {
      await updateDoc(doc(db, 'config', 'main'), {
        deepseekApiKey: deepseekKey,
        openRouterApiKey: openRouterKey
      });
      toast.success('Chaves salvas!', { id: 'save-keys' });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'config/main', user);
      toast.error('Falha ao salvar chaves', { id: 'save-keys' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const [localGeminiKeys, setLocalGeminiKeys] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('local_gemini_keys');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (appConfig?.geminiApiKeys && localGeminiKeys.length === 0) {
      setLocalGeminiKeys(appConfig.geminiApiKeys);
      localStorage.setItem('local_gemini_keys', JSON.stringify(appConfig.geminiApiKeys));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appConfig?.geminiApiKeys]);

  const addLocalKey = (key: string) => {
    const newKeys = [...localGeminiKeys, key];
    setLocalGeminiKeys(newKeys);
    localStorage.setItem('local_gemini_keys', JSON.stringify(newKeys));
    toast.success('Chave salva no Local Storage', { id: 'local-key' });
  };

  const removeLocalKey = (idx: number) => {
    const newKeys = localGeminiKeys.filter((_, i) => i !== idx);
    setLocalGeminiKeys(newKeys);
    localStorage.setItem('local_gemini_keys', JSON.stringify(newKeys));
    toast.success('Chave removida do Local Storage', { id: 'local-key' });
  };

  const uploadKeysToCloud = async () => {
    setIsSavingConfig(true);
    toast.loading('Enviando chaves para a nuvem...', { id: 'upload-keys' });
    try {
      await updateDoc(doc(db, 'config', 'main'), { geminiApiKeys: localGeminiKeys });
      toast.success('Chaves enviadas e ativas para todos!', { id: 'upload-keys' });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'config/main', user);
      toast.error('Grave: Falha no envio para nuvem', { id: 'upload-keys' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
  const [localMaintenancePreview, setLocalMaintenancePreview] = useState(() => {
    return localStorage.getItem('admin_maintenance_preview') === 'true';
  });

  const toggleLocalPreview = () => {
    const newState = !localMaintenancePreview;
    console.log("🛠️ Admin: Toggling local preview to:", newState);
    setLocalMaintenancePreview(newState);
    localStorage.setItem('admin_maintenance_preview', String(newState));
    
    // Dispatch custom event for App.tsx to catch local change
    window.dispatchEvent(new CustomEvent('local-maintenance-preview', { 
      detail: { active: newState } 
    }));

    toast.info(newState ? 'VISUALIZAÇÃO ATIVA' : 'VISUALIZAÇÃO DESATIVADA', {
      id: 'maintenance-local',
      description: newState ? 'Você verá o aviso de manutenção agora.' : 'O aviso foi oculto para você.'
    });
  };

  const syncMaintenanceToCloud = async () => {
    if (!isAdmin) return;
    setIsSavingMaintenance(true);

    console.log("🛠️ Admin: Syncing maintenance to cloud:", localMaintenancePreview);

    try {
      await setDoc(doc(db, 'config', 'main'), {
        maintenanceMode: localMaintenancePreview,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast.success(localMaintenancePreview ? 'CLOUD: BLOQUEADO 🛡️' : 'CLOUD: LIBERADO 🌐', {
        id: 'maintenance-sync',
        description: localMaintenancePreview ? "Ativo para todos os usuários comuns." : "Acesso normal restaurado."
      });
    } catch (error) {
      console.error("🛠️ Admin: Cloud sync failed:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'config/main', user);
    } finally {
      setIsSavingMaintenance(false);
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
      toast.success("Usuário banido permanentemente.");
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${uid}`, user);
      toast.error('Erro crítico ao banir: ' + e.message);
    } finally {
      setProcessingAction(null);
    }
  };

  const banIp = async (ip: string) => {
    try {
      if (!ip) return;
      if (processingAction) return;
      setProcessingAction('banip_' + ip);
      const ipKey = ip.replace(/\./g, '_');
      await setDoc(doc(db, 'banned_ips', ipKey), {
        ip: ip,
        bannedAt: Timestamp.now(),
        bannedBy: user?.uid,
        reason: 'Violação persistente'
      });
      toast.success(`IP ${ip} banido com sucesso!`);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `banned_ips/${ip.replace(/\./g, '_')}`, user);
      toast.error('Erro ao banir IP: ' + e.message);
    } finally {
      setProcessingAction(null);
    }
  };

  const unbanIp = async (ip: string) => {
    try {
      if (processingAction) return;
      setProcessingAction('unbanip_' + ip);
      const ipKey = ip.replace(/\./g, '_');
      await deleteDoc(doc(db, 'banned_ips', ipKey));
      toast.success(`IP ${ip} desbanido.`);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.DELETE, `banned_ips/${ip.replace(/\./g, '_')}`, user);
      toast.error('Erro ao desbanir IP: ' + e.message);
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
      handleFirestoreError(e, OperationType.UPDATE, `users/${uid}`, user);
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
      handleFirestoreError(e, OperationType.UPDATE, `users/${uid}`, user);
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
      handleFirestoreError(e, OperationType.WRITE, 'announcements', user);
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
      handleFirestoreError(e, OperationType.UPDATE, `announcements/${id}`, user);
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
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `chats/${chatId}/messages`, user);
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

  const loadAllUserChats = async (uid: string) => {
    if (expandedUserUid === uid) {
      setExpandedUserUid(null);
      return;
    }

    setExpandedUserUid(uid);
    if (!userChats[uid]) {
      setLoadingUserChats(uid);
      try {
        const q = query(collection(db, 'chats'), where('userId', '==', uid), orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        const chatsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUserChats(prev => ({ ...prev, [uid]: chatsList }));
      } catch (e: any) {
        toast.error("Erro ao carregar chats: " + e.message);
      } finally {
        setLoadingUserChats(null);
      }
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
                 <p className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">Latência Estável</p>
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

          {/* Sidebar Area */}
          <div className="space-y-6">
            
            {/* System Controls */}
            <section className="p-6 ui-card border border-white/5 bg-white/[0.02] rounded-2xl">
              <div className="flex items-center gap-3 mb-6">
                 <div className={cn(
                   "p-2 rounded-lg ui-border border-white/10",
                   appConfig?.maintenanceMode ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                 )}>
                    <AlertTriangle size={18} />
                 </div>
                 <h2 className="text-sm font-black uppercase tracking-tight">Controle de Sistema</h2>
              </div>
              
              {/* Cloud Status Indicator */}
              <div className={cn(
                "p-4 rounded-xl border mb-6",
                appConfig?.maintenanceMode 
                  ? "bg-red-500/5 border-red-500/20 text-red-200" 
                  : "bg-green-500/5 border-green-500/10 text-green-200"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Activity size={12} className={appConfig?.maintenanceMode ? "text-red-500" : "text-green-500"} />
                    Status Cloud (Firebase)
                  </span>
                  <span className={cn(
                    "text-[8px] font-bold px-2 py-0.5 rounded-full uppercase",
                    appConfig?.maintenanceMode ? "bg-red-500 text-white" : "bg-green-500 text-white"
                  )}>
                    {appConfig?.maintenanceMode ? 'BLOQUEADO' : 'ONLINE'}
                  </span>
                </div>
              </div>

              {/* Local Toggle */}
              <div className="space-y-4 mb-6">
                <div className="p-4 rounded-xl bg-white/[0.05] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Visualizar modo manutenção
                    </span>
                    <button 
                      onClick={toggleLocalPreview}
                      className={cn(
                        "w-10 h-5 rounded-full relative transition-all",
                        localMaintenancePreview ? "bg-red-500" : "bg-gray-700"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 bottom-1 w-3 bg-white rounded-full transition-all",
                        localMaintenancePreview ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-500 leading-relaxed font-bold uppercase tracking-tight">
                    {localMaintenancePreview 
                      ? "O aviso de manutenção está visível para você." 
                      : "O aviso está oculto para você."}
                  </p>
                </div>
              </div>

              {/* Sync Button */}
              <button 
                onClick={syncMaintenanceToCloud}
                disabled={isSavingMaintenance}
                className={cn(
                  "w-full font-black text-[10px] py-4 rounded-xl transition-all flex items-center justify-center gap-2 border shadow-lg",
                  localMaintenancePreview
                    ? "bg-red-600 hover:bg-red-500 text-white border-red-400/20"
                    : "bg-green-600 hover:bg-green-500 text-white border-green-400/20"
                )}
              >
                {isSavingMaintenance ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {localMaintenancePreview ? 'SINCRONIZAR: BLOQUEAR TODOS' : 'SINCRONIZAR: LIBERAR TODOS'}
              </button>
              
              <p className="mt-3 text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                Isso altera o status para todos os usuários
              </p>
            </section>

            {/* Banned IPs - MOVED TO TOP OF SIDEBAR */}
            <section className="ui-card border border-white/5 bg-white/[0.02] overflow-hidden rounded-2xl">
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-3">
                   <Shield className="text-red-500" size={18} />
                   <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">IPs Banidos (Lista Negra)</h2>
                </div>
                <button 
                  onClick={fetchLogsAndIps}
                  className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 font-black text-[9px] px-3 py-1.5 rounded-lg transition-all"
                >
                  PUXAR DADOS / IDS
                </button>
              </div>
              <div className="max-h-[200px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                {bannedIps.length === 0 ? (
                  <div className="p-6 text-center text-gray-600 text-[10px] uppercase font-bold tracking-widest">Clique em "PUXAR DADOS" para visualizar IPs</div>
                ) : (
                  bannedIps.map((bip) => (
                    <div key={bip.id} className="p-3 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono text-red-400">{bip.ip}</span>
                        <span className="text-[8px] text-gray-600 uppercase font-bold">{bip.bannedAt?.toDate().toLocaleString()}</span>
                      </div>
                      <button 
                        onClick={() => unbanIp(bip.ip)}
                        disabled={!!processingAction}
                        className="text-[9px] font-black text-green-500 hover:bg-green-500/10 px-2 py-1 rounded border border-green-500/10 uppercase"
                      >
                        {processingAction === 'unbanip_' + bip.ip ? '...' : 'REMOVER'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
            
            {/* Access Logs */}
            <section className="ui-card border border-white/5 bg-white/[0.02] overflow-hidden rounded-2xl">
              <div className="p-4 border-b border-white/5 bg-white/[0.01]">
                <div className="flex items-center gap-3">
                   <Activity className="text-blue-500" size={18} />
                   <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Logs de Acesso Realtime</h2>
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                {accessLogs.length === 0 ? (
                  <div className="p-6 text-center text-gray-600 text-[10px] uppercase font-bold tracking-widest">Clique em "PUXAR DADOS" para ver os logs</div>
                ) : (
                  accessLogs.map((log) => (
                    <div key={log.id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-black text-gray-300 uppercase truncate max-w-[150px]">{log.email}</span>
                        <span className="text-[8px] font-mono text-gray-600">
                          {log.timestamp?.toDate().toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-mono text-blue-400/80">{log.ip}</span>
                         <button 
                           onClick={() => banIp(log.ip)}
                           disabled={bannedIps.some(bi => bi.ip === log.ip)}
                           className="text-[8px] font-bold text-red-500 hover:text-red-400 uppercase tracking-tighter disabled:opacity-20"
                         >
                           {bannedIps.some(bi => bi.ip === log.ip) ? 'Bloqueado' : 'Banir'}
                         </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Gemini API Keys */}
            <section className="p-6 ui-card border border-white/5 bg-white/[0.02] rounded-2xl">
               <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 bg-blue-500/10 rounded-lg ui-border border-blue-500/20 text-blue-400">
                    <Activity size={18} />
                 </div>
                 <h2 className="text-sm font-black uppercase tracking-tight">Gemini AI Engine</h2>
              </div>

               <div className="space-y-4 py-4 border-b border-white/5">
                 <h3 className="text-white text-xs font-black uppercase">Chaves de API Externas</h3>
                 <input 
                     type="password"
                     value={deepseekKey}
                     onChange={(e) => setDeepseekKey(e.target.value)}
                     placeholder="DeepSeek API Key (sk-...)"
                     className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-[10px] text-white focus:outline-none focus:border-blue-500/30 font-mono"
                 />
                 <input 
                     type="password"
                     value={openRouterKey}
                     onChange={(e) => setOpenRouterKey(e.target.value)}
                     placeholder="OpenRouter API Key (sk-or-...)"
                     className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-[10px] text-white focus:outline-none focus:border-blue-500/30 font-mono"
                 />
                 <button 
                     onClick={saveAiKeys}
                     disabled={isSavingConfig}
                     className="text-[9px] font-black uppercase bg-blue-600/20 text-blue-400 px-3 py-2 rounded-lg w-full border border-blue-500/20 hover:bg-blue-600/30 disabled:opacity-50"
                 >
                     {isSavingConfig ? 'SALVANDO...' : 'SALVAR CHAVES EXTERNAS'}
                 </button>
               </div>
               
               <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Estado de Chaves</span>
                     <button 
                       onClick={async () => {
                         const newAuto = appConfig?.autoApiKeySelection === false;
                         try {
                           await updateDoc(doc(db, 'config', 'main'), { autoApiKeySelection: newAuto });
                         } catch (e) {
                           handleFirestoreError(e, OperationType.UPDATE, 'config,main', user);
                         }
                       }}
                       className={cn(
                         "text-[9px] font-black px-3 py-1 rounded-full border transition-all",
                         appConfig?.autoApiKeySelection !== false 
                           ? "bg-green-500/10 text-green-500 border-green-500/20"
                           : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                       )}
                     >
                       {appConfig?.autoApiKeySelection !== false ? 'RODÍZIO AUTO: LIGADO' : 'SELEÇÃO MANUAL: ATIVA'}
                     </button>
                  </div>
                 
                 <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                    {localGeminiKeys.map((key, idx) => (
                      <div key={idx} className="bg-black/30 p-2 rounded-lg border border-white/5 flex items-center justify-between group">
                         <code className="text-[9px] font-mono text-gray-400 truncate max-w-[200px]">
                           {key.slice(0, 10)}...{key.slice(-5)}
                         </code>
                         <div className="flex items-center gap-2">
                            {appConfig?.selectedApiKeyIndex === idx && (
                              <span className="text-[8px] font-black text-green-500 uppercase">ATIVO</span>
                            )}
                            <button 
                              onClick={() => removeLocalKey(idx)}
                              className="p-1 hover:bg-red-500/10 text-red-500 rounded opacity-0 group-hover:opacity-100 transition-all font-bold text-[9px]"
                            >
                              LOCAL DEL
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
                 
                 <div className="pt-2">
                    <input 
                       id="newGeminiKey"
                       type="password"
                       placeholder="Nova chave (Salva apenas local)..."
                       className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-[10px] text-white focus:outline-none focus:border-blue-500/30 font-mono mb-2"
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                           const el = e.currentTarget;
                           const val = el.value.trim();
                           if (!val) return;
                           addLocalKey(val);
                           el.value = '';
                         }
                       }}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[8px] text-gray-600 italic">Enter para salvar no navegador.</p>
                      <button 
                        onClick={uploadKeysToCloud}
                        disabled={isSavingConfig}
                        className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black text-[10px] px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                      >
                        {isSavingConfig ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                        UPLOAD CLOUD
                      </button>
                    </div>
                 </div>
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
                {users.length === 0 && (
                  <div className="p-6 text-center text-gray-600 text-[10px] uppercase font-bold tracking-widest">
                    Clique em "PUXAR DADOS" para ver os usuários das últimas 24h
                  </div>
                )}
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
                        {u.lastIp && (
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded text-gray-400 font-mono">IP: {u.lastIp}</span>
                             {bannedIps.some(bi => bi.ip === u.lastIp) ? (
                               <button 
                                 onClick={() => unbanIp(u.lastIp!)}
                                 disabled={!!processingAction}
                                 className="text-[8px] font-bold text-green-500 hover:text-green-400 uppercase disabled:opacity-30"
                               >
                                 DESBANIR IP
                               </button>
                             ) : (
                               <button 
                                 onClick={() => banIp(u.lastIp!)}
                                 disabled={!!processingAction}
                                 className="text-[8px] font-bold text-red-500/60 hover:text-red-500 uppercase disabled:opacity-30"
                               >
                                 BANIR IP
                               </button>
                             )}
                          </div>
                        )}
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
                          <button 
                            onClick={() => loadAllUserChats(u.uid)}
                            className={cn(
                              "flex-1 text-[9px] font-black py-1.5 rounded-lg border uppercase transition-all",
                              expandedUserUid === u.uid 
                                ? "bg-blue-500 text-white border-blue-400" 
                                : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border-blue-500/20"
                            )}
                          >
                            {loadingUserChats === u.uid ? '...' : (expandedUserUid === u.uid ? 'Fechar' : 'Chats')}
                          </button>
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
                        </>
                      )}
                    </div>

                    {/* Chat Dropdown Panel */}
                    <AnimatePresence>
                      {expandedUserUid === u.uid && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-black/40 rounded-xl border border-white/5 mt-2"
                        >
                          <div className="p-4 space-y-2">
                             <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Investigação de Chats</span>
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => {
                                       navigator.clipboard.writeText(u.uid);
                                       toast.success("UID copiado!");
                                    }}
                                    className="text-[8px] font-bold text-gray-500 hover:text-white transition-colors uppercase"
                                  >
                                    Copiar ID
                                  </button>
                                  <span className="text-[9px] font-bold text-gray-500 px-2 py-0.5 bg-white/5 rounded-full">
                                    {userChats[u.uid]?.length || 0} TOTAL
                                  </span>
                                </div>
                             </div>
                             
                             <div className="flex gap-2 mb-3">
                             <button
                               onClick={() => banUser(u.uid)}
                               disabled={processingAction === 'ban_' + u.uid}
                               className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-500 text-[9px] font-black py-2 rounded-lg border border-red-500/20 uppercase transition-all"
                             >
                               {processingAction === 'ban_' + u.uid ? 'BANINDO...' : '🔨 BANIR CONTA'}
                             </button>
                             <button
                               onClick={async () => {
                                 if (u.lastIp) {
                                   await banIp(u.lastIp);
                                 }
                                 await banUser(u.uid);
                               }}
                               disabled={processingAction?.includes(u.uid)}
                               className="flex-1 bg-red-900/60 hover:bg-red-800 text-white text-[9px] font-black py-2 rounded-lg border border-red-500/50 uppercase transition-all"
                             >
                               💀 BANIR COMBO (ID+IP)
                             </button>
                             </div>
                             
                             {loadingUserChats === u.uid ? (
                               <div className="py-4 text-center text-gray-600 text-[9px] font-bold uppercase animate-pulse">Consultando banco de dados...</div>
                             ) : !userChats[u.uid] || userChats[u.uid].length === 0 ? (
                               <div className="py-4 text-center text-gray-600 text-[9px] font-bold uppercase">Nenhum chat encontrado</div>
                             ) : (
                               <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                                 {userChats[u.uid].map((chat) => (
                                   <button
                                     key={chat.id}
                                     onClick={() => openChatView(chat.id)}
                                     className="w-full text-left p-3 hover:bg-white/5 rounded-lg flex items-center justify-between group/chat"
                                   >
                                      <div>
                                        <p className="text-[11px] font-bold text-gray-200 truncate max-w-[180px]">{chat.title || 'Chat s/ título'}</p>
                                        <p className="text-[9px] text-gray-600 font-mono">{chat.createdAt?.toDate().toLocaleDateString()}</p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-black text-gray-500 bg-white/5 px-2 py-0.5 rounded uppercase">
                                          {chat.mode || 'Normal'}
                                        </span>
                                        <MessageSquare size={12} className="text-gray-600 group-hover/chat:text-blue-400 transition-colors" />
                                      </div>
                                   </button>
                                 ))}
                               </div>
                             )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
