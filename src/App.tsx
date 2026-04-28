import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, 
  LogOut, 
  User as UserIcon,
  Bell,
  Activity,
  RefreshCw
} from 'lucide-react';
import { auth, db, signOut } from './firebase';
import { onAuthStateChanged, User, getRedirectResult } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc,
  setDoc,
  Timestamp,
  limit,
  getDoc,
  getDocFromServer,
  getDocs
} from 'firebase/firestore';
import { getGeminiResponse, geminiModel } from './gemini';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import Sidebar from './components/Sidebar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import ConfirmationModal from './components/ConfirmationModal';
import SaveScriptModal from './components/SaveScriptModal';
import { Chat, Message, OperationType, handleFirestoreError, ChatMode, UserStats, AppUser } from './types';
import { localChatService } from './services/localChatService';
import AuthModal from './components/AuthModal';
import { Toaster, toast } from 'sonner';
import { supabase } from './lib/supabase';
import { supabaseService } from './services/supabaseService';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ConfigPage from './pages/ConfigPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [userStatusLoaded, setUserStatusLoaded] = useState(false);
  const [userIp, setUserIp] = useState<string | null>(null);
  const [isIpBanned, setIsIpBanned] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [localChats, setLocalChats] = useState<Chat[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);
  const [savedScripts, setSavedScripts] = useState<{id: string, name: string, content: string}[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => localStorage.getItem('last_current_chat_id'));

  const isAdmin = user && (
    user.email === 'wesley04012011w@gmail.com' || 
    user.email === 'soparonosk37@gmail.com' ||
    user.uid === 'lNvYzIXKQWQ85n51WgFfM1Axw733'
  );

  useEffect(() => {
    const loadLocal = async () => {
      const local = await localChatService.getChats();
      setLocalChats(local);
      setIsLoadingLocal(false);
    };
    loadLocal();
    
    const handleStorage = async () => {
      const local = await localChatService.getChats();
      setLocalChats(local);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const syncCurrent = async () => {
      if (currentChatId) {
        localStorage.setItem('last_current_chat_id', currentChatId);
        const localMsgs = await localChatService.getMessages(currentChatId);
        setMessages(localMsgs);
      } else {
        localStorage.removeItem('last_current_chat_id');
        setMessages([]);
      }
    };
    syncCurrent();
  }, [currentChatId]);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [suggestion, setSuggestion] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimized, setIsOptimized] = useState(() => localStorage.getItem('app_optimized') === 'true');
  const [isGlowEnabled, setIsGlowEnabled] = useState(() => localStorage.getItem('app_glow') !== 'false');
  const [isBlockMode, setIsBlockMode] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('gemini_model_preference') || 'auto');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const lastMessageTimeRef = useRef<number>(0);

  const requestCountRef = useRef<number>(0);
  const windowStartTimeRef = useRef<number>(0);
  const rateLimitedUntilRef = useRef<number>(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Conexão restabelecida!");
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error("Você está offline. Algumas funções podem não funcionar.", { duration: 5000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Global error caught:", event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    // Carrega chaves globais do banco apenas uma vez para economizar cota
    const fetchGlobalKeys = async () => {
      try {
        const lastFetch = localStorage.getItem('last_config_fetch');
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (lastFetch && (now - parseInt(lastFetch)) < oneDay) return;

        const snap = await getDocFromServer(doc(db, 'config', 'main'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.geminiApiKeys && Array.isArray(data.geminiApiKeys)) {
            localStorage.setItem('local_gemini_keys', JSON.stringify(data.geminiApiKeys));
          }
          localStorage.setItem('last_config_fetch', now.toString());
        }
      } catch (error) {
        console.warn("Erro ao buscar chaves globais:", error);
      }
    };
    if (user) fetchGlobalKeys();
  }, [user]);

  const [saveModal, setSaveModal] = useState<{
    isOpen: boolean;
    content: string;
    defaultName: string;
  }>({
    isOpen: false,
    content: '',
    defaultName: ''
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchIpAndCheckBan = async () => {
      // 1. Check if we already checked this IP recently (last 12 hours)
      const lastCheck = localStorage.getItem('last_ip_ban_check');
      const nowTime = Date.now();
      const TWELVE_HOURS = 12 * 60 * 60 * 1000;
      
      if (lastCheck && (nowTime - parseInt(lastCheck)) < TWELVE_HOURS) {
        const cachedBan = localStorage.getItem('is_ip_banned');
        const cachedIp = localStorage.getItem('last_user_ip');
        if (cachedIp) setUserIp(cachedIp);
        if (cachedBan === 'true') {
          setIsIpBanned(true);
          return;
        }
        console.log("🕒 Status: IP verificado recentemente (Cache 12h)");
        return;
      }

      let ip: string | null = null;
      const services = [
        'https://api.ipify.org?format=json',
        'https://ipapi.co/json/',
        'https://api64.ipify.org?format=json',
        'https://jsonip.com'
      ];

      for (const service of services) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const response = await fetch(service, { signal: controller.signal });
          const data = await response.json();
          clearTimeout(timeoutId);
          if (data.ip) {
            ip = data.ip;
            break;
          }
        } catch (e) {
          console.warn(`Serviço de IP ${service} falhou.`);
        }
      }

      if (!ip) {
        ip = localStorage.getItem('last_user_ip');
        if (!ip) {
          console.warn("Não foi possível obter IP. Retentando em 15s...");
          setTimeout(fetchIpAndCheckBan, 15000);
          return;
        }
      }

      setUserIp(ip);
      localStorage.setItem('last_user_ip', ip);

      try {
        const isBannedSupabase = await supabaseService.isIpBanned(ip);
        let isBanned = isBannedSupabase;

        if (!isBannedSupabase) {
          const ipKey = ip.replace(/\./g, '_');
          const snapshot = await getDoc(doc(db, 'banned_ips', ipKey));
          if (snapshot.exists()) isBanned = true;
        }

        setIsIpBanned(isBanned);
        localStorage.setItem('is_ip_banned', String(isBanned));
        localStorage.setItem('last_ip_ban_check', Date.now().toString());

        if (isBanned) {
          console.log("🚫 Status: IP Banido", ip);
          toast.error("ACESSO NEGADO: Seu endereço IP está na lista negra.", { duration: Infinity });
        } else {
          console.log("✅ Status: IP Limpo", ip);
        }
      } catch (error) {
        console.error("Erro ao verificar IP:", error);
      }
    };
    fetchIpAndCheckBan();
  }, []);

  useEffect(() => {
    localStorage.setItem('app_optimized', String(isOptimized));
  }, [isOptimized]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('gemini_model_preference', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Sync state from localStorage on storage event (for multi-page/tab sync)
    const handleStorageChange = () => {
      setApiKey(localStorage.getItem('gemini_api_key') || '');
      setSelectedModel(localStorage.getItem('gemini_model_preference') || 'auto');
      setIsOptimized(localStorage.getItem('app_optimized') === 'true');
      setIsGlowEnabled(localStorage.getItem('app_glow') !== 'false');
      
      // Update scripts
      if (!user) {
        setSavedScripts(JSON.parse(localStorage.getItem('saved_scripts_offline') || '[]'));
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]);

  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("Redirect login success:", result.user.email);
          setUser(result.user);
        }
      } catch (error) {
        console.error("Redirect check error:", error);
      }
    };
    checkRedirect();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.log("Auth state changed:", u ? u.email : "deslogado");
      setUser(u);
      setAuthLoaded(true);
      
      if (!u) {
        setUserStatusLoaded(true);
      }
      
      if (u) {
        // Sync offline scripts to Firestore on login
        const offlineScripts = localStorage.getItem('saved_scripts_offline');
        if (offlineScripts) {
          try {
            const scripts = JSON.parse(offlineScripts);
            if (Array.isArray(scripts) && scripts.length > 0) {
              // Sincronizar sequencialmente para garantir que o cache local só seja limpo após sucesso
              for (const script of scripts) {
                try {
                  await addDoc(collection(db, 'scripts'), {
                    userId: u.uid,
                    name: script.name,
                    content: script.content,
                    createdAt: serverTimestamp()
                  });
                } catch (e) {
                  console.warn("Falha ao migrar script individual:", script.name);
                }
              }
              localStorage.removeItem('saved_scripts_offline');
              console.log("✅ Migração de scripts offline concluída.");
            }
          } catch (e) {
            console.error("Migration failed:", e);
          }
        }
      }
    });

    const timeout = setTimeout(() => {
      setAuthLoaded(true);
      setUserStatusLoaded(true);
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Presença e Monitoramento
  const [userStatus, setUserStatus] = useState<{ banned: boolean; blockedUntil?: Timestamp } | null>(null);

  const syncChatsRan = useRef<string | null>(null);
  const fetchScriptsRan = useRef<string | null>(null);
  const fetchAppUserRan = useRef<string | null>(null);
  const checkIpRan = useRef(false);
  const fetchAnnouncementsRan = useRef(false);

  useEffect(() => {
    if (!user || fetchAppUserRan.current === user.uid) return;
    const fetchAppUser = async () => {
       try {
         const rehydrateAppUser = (data: any): AppUser => {
            if (data.lastUsageTimestamp && data.lastUsageTimestamp.seconds) {
                data.lastUsageTimestamp = new Timestamp(data.lastUsageTimestamp.seconds, data.lastUsageTimestamp.nanoseconds);
            }
            return data as AppUser;
         };

         // Cache por 1 hora para o perfil do usuário
         const lastFetch = sessionStorage.getItem(`last_fetch_appuser_${user.uid}`);
         const cached = sessionStorage.getItem(`appUser_${user.uid}`);
         
         if (cached && lastFetch && (Date.now() - parseInt(lastFetch)) < 3600000) {
            setAppUser(rehydrateAppUser(JSON.parse(cached)));
            fetchAppUserRan.current = user.uid;
            return;
         }
         
         console.log("🚀 [SUPABASE READ] Buscando perfil do usuário...");
         const data = await supabaseService.getUserProfile(user.uid);
         
         if (data) {
           const rehydrated = rehydrateAppUser(data);
           setAppUser(rehydrated);
           sessionStorage.setItem(`appUser_${user.uid}`, JSON.stringify(rehydrated));
           sessionStorage.setItem(`last_fetch_appuser_${user.uid}`, Date.now().toString());
           fetchAppUserRan.current = user.uid;
         } else {
           // Fallback to Firestore
           console.log("🔥 [FIREBASE READ] Fallback perfil usuário...");
           const userDoc = await getDoc(doc(db, 'users', user.uid));
           if (userDoc.exists()) {
             const fData = userDoc.data() as AppUser;
             setAppUser(fData);
             sessionStorage.setItem(`appUser_${user.uid}`, JSON.stringify(fData));
             sessionStorage.setItem(`last_fetch_appuser_${user.uid}`, Date.now().toString());
             fetchAppUserRan.current = user.uid;
             
             // Auto-migrate to Supabase
             supabaseService.updateUserProfile(user.uid, fData).catch(console.error);
           }
         }
       } catch (e: any) {
          console.error("Error fetching app user", e);
          if (String(e).toLowerCase().includes('quota')) {
            const fallbackUser: AppUser = {
              uid: user.uid, 
              role: 'user', 
              displayName: user.displayName || 'Unknown', 
              email: user.email || '', 
              photoURL: user.photoURL,
              lastActive: Timestamp.now(),
              isOnline: true,
              creditos: 100
            };
            setAppUser(fallbackUser);
            sessionStorage.setItem('appUser_' + user.uid, JSON.stringify(fallbackUser));
          }
        }
    };
    
    fetchAppUser();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) {
      setUserStatus(null);
      setUserStatusLoaded(true);
      return;
    }

    setUserStatusLoaded(true);
    // Batimento cardíaco de presença e registro de IP agressivo
    const updatePresence = async () => {
      // Evitar logs se já estivermos detectados como bloqueados
      if (isIpBanned) return; 

      // Evitar atualizar se já atualizamos recentemente (e.g., nos últimos 12 horas)
      const lastUpdate = localStorage.getItem('last_presence_update');
      const twelveHours = 12 * 60 * 60 * 1000;
      if (lastUpdate && Date.now() - parseInt(lastUpdate) < twelveHours) return;

      try {
        let currentIp = userIp || localStorage.getItem('last_user_ip');
        
        // Registro de IP síncrono para esta atualização se necessário com múltiplos fallbacks
        if (!currentIp) {
          const services = [
            'https://api.ipify.org?format=json',
            'https://ipapi.co/json/',
            'https://api64.ipify.org?format=json',
            'https://extreme-ip-lookup.com/json/'
          ];
          
          for (const service of services) {
            try {
              const resp = await fetch(service, { signal: AbortSignal.timeout(3000) });
              const d = await resp.json();
              const foundIp = d.ip || d.query;
              if (foundIp) {
                currentIp = foundIp;
                setUserIp(foundIp);
                break;
              }
            } catch(e) {
              continue;
            }
          }
        }

        const fingerprint = {
          ua: navigator.userAgent,
          lang: navigator.language,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screen: `${window.screen.width}x${window.screen.height}`,
          cores: navigator.hardwareConcurrency || 'unknown',
          mem: (navigator as any).deviceMemory || 'unknown'
        };

        const presenceData: any = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Usuário Fluxion',
          photoURL: user.photoURL,
          updatedAt: serverTimestamp(),
        };

        if (currentIp) {
          presenceData.lastIp = currentIp;
          localStorage.setItem('last_user_ip', currentIp);
        }

        try {
          await supabaseService.updateUserProfile(user.uid, presenceData);
          if (currentIp) {
            await supabaseService.logAccess(user.uid, currentIp, user.email || '');
          }
        } catch (sErr) {
          console.warn("Supabase presence/log update failed:", sErr);
        }

        await setDoc(doc(db, 'users', user.uid), presenceData, { merge: true });
        localStorage.setItem('last_presence_update', Date.now().toString());
      } catch (e) {
        console.error("Presence update failed:", e);
      }
    };

    updatePresence();
  }, [user]);


  const isActuallyBlocked = () => {
    if (isAdmin) return false; // Admins never blocked
    if (isIpBanned) return true;
    if (!userStatus) return false;
    if (userStatus.banned) return true;
    if (userStatus.blockedUntil) {
      return userStatus.blockedUntil.toMillis() > Date.now();
    }
    return false;
  };

  const getBlockMessage = () => {
    if (isIpBanned) return '🚫 ACESSO NEGADO: Seu endereço IP foi banido por atividade suspeita.';
    if (!userStatus) return '';
    if (userStatus.banned) return '🚫 ACESSO NEGADO: Sua conta foi banida permanentemente por violação das diretrizes de segurança.';
    if (userStatus.blockedUntil) {
      const date = userStatus.blockedUntil.toDate();
      return `⏳ ACESSO SUSPENSO: Sua conta está bloqueada temporariamente até ${date.toLocaleString()}.`;
    }
    return '';
  };

  const [activeAnnouncementsCount, setActiveAnnouncementsCount] = useState(0);

  useEffect(() => {
    if (!user || fetchAnnouncementsRan.current) return;
    const fetchAnnouncements = async () => {
      try {
        const cachedCount = sessionStorage.getItem('active_announcements_count');
        const cachedData = sessionStorage.getItem('active_announcements_data');
        
        if (cachedCount && cachedData) {
          setActiveAnnouncementsCount(parseInt(cachedCount));
          fetchAnnouncementsRan.current = true;
          return;
        }

        console.log("🚀 [SUPABASE READ] Buscando anúncios...");
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setActiveAnnouncementsCount(data.length);
        sessionStorage.setItem('active_announcements_data', JSON.stringify(data));
        sessionStorage.setItem('active_announcements_count', data.length.toString());
        fetchAnnouncementsRan.current = true;
      } catch (error) {
        console.warn("Supabase announcements failed, falling back to Firestore...");
        try {
          const qAnnouncements = query(
            collection(db, 'announcements'), 
            where('isActive', '==', true),
            limit(5)
          );
          const snapshot = await getDocs(qAnnouncements);
          setActiveAnnouncementsCount(snapshot.size);
          const announcementsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          sessionStorage.setItem('active_announcements_data', JSON.stringify(announcementsData));
          sessionStorage.setItem('active_announcements_count', snapshot.size.toString());
          fetchAnnouncementsRan.current = true;
        } catch (fError) {
          console.error("Firestore announcements failure:", fError);
        }
      }
    };
    fetchAnnouncements();
  }, [user?.uid]);

  useEffect(() => {
    if (!user || syncChatsRan.current === user.uid) return;
    const syncChats = async () => {
      try {
        const lastSync = localStorage.getItem(`last_chat_sync_${user.uid}`);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        const local = await localChatService.getChats();
        if (local.length > 0) {
          setLocalChats(local);
        }

        if (lastSync && (now - parseInt(lastSync)) < oneDay && local.length > 0) {
          console.log("☁️ Sincronização em dia. Usando dados locais.");
          syncChatsRan.current = user.uid;
          return;
        }

        console.log("🚀 [SUPABASE READ] Sincronizando chats...");
        const remoteChats = await supabaseService.getChats(user.uid);
        
        if (remoteChats && remoteChats.length > 0) {
          await localChatService.syncWithSupabase(remoteChats);
        }

        const finalLocal = await localChatService.getChats();
        setLocalChats(finalLocal);
        localStorage.setItem(`last_chat_sync_${user.uid}`, now.toString());
        sessionStorage.setItem(`chats_${user.uid}`, JSON.stringify(finalLocal));
        syncChatsRan.current = user.uid;
      } catch (error) {
        console.error("Erro na sincronização de chats (Supabase):", error);
      }
    };
    syncChats();
  }, [user?.uid]);

  useEffect(() => {
    if (!user || fetchScriptsRan.current === user.uid) {
      if (!user) {
        const offline = localStorage.getItem('saved_scripts_offline');
        if (offline) setSavedScripts(JSON.parse(offline));
      }
      return;
    }
    const fetchScripts = async () => {
      try {
        const lastSync = localStorage.getItem(`last_script_sync_${user.uid}`);
        const now = Date.now();
        const twelveHours = 12 * 60 * 60 * 1000;

        const cached = sessionStorage.getItem(`scripts_${user.uid}`);
        if (cached) {
          setSavedScripts(JSON.parse(cached));
          if (lastSync && (now - parseInt(lastSync)) < twelveHours) {
            fetchScriptsRan.current = user.uid;
            return;
          }
        }

        console.log("🚀 [SUPABASE READ] Buscando scripts...");
        const scripts = await supabaseService.getScripts(user.uid);
        
        const scriptsList = scripts?.map((s: any) => ({
          id: s.id,
          name: s.name,
          content: s.content
        })) || [];

        setSavedScripts(scriptsList);
        sessionStorage.setItem(`scripts_${user.uid}`, JSON.stringify(scriptsList));
        localStorage.setItem('saved_scripts_offline', JSON.stringify(scriptsList));
        localStorage.setItem(`last_script_sync_${user.uid}`, now.toString());
        fetchScriptsRan.current = user.uid;
      } catch (error) {
        console.warn("Supabase scripts failure, falling back to local...");
        const cached = localStorage.getItem('saved_scripts_offline');
        if (cached) setSavedScripts(JSON.parse(cached));
      }
    };
    fetchScripts();
  }, [user?.uid]);

  const lastMsgsFetchId = useRef<string | null>(null);

  useEffect(() => {
    if (!currentChatId || !user || lastMsgsFetchId.current === currentChatId) return;

    // Se o chat for local (ID começa com local_), não buscamos na nuvem
    if (currentChatId.startsWith('local_')) return;

    const fetchMessages = async () => {
      try {
        // 1. Tentar carregar do banco local primeiro para exibição instantânea
        const localMsgs = await localChatService.getMessages(currentChatId);
        if (localMsgs.length > 0) {
          setMessages(localMsgs);
          
          // Verificar se buscamos recentemente (nos últimos 60 min) para este chat nesta sessão
          const lastFetched = sessionStorage.getItem(`last_fetch_msgs_${currentChatId}`);
          const canSkip = lastFetched && (Date.now() - parseInt(lastFetched)) < 60 * 60 * 1000;
          
          if (canSkip) {
            console.log(`📦 Cache: Usando mensagens locais para ${currentChatId} (Skip Firebase)`);
            lastMsgsFetchId.current = currentChatId;
            return;
          }
        }

        console.log(`🚀 [SUPABASE READ] Buscando mensagens para: ${currentChatId}`);
        const msgList = await supabaseService.getMessages(currentChatId);
        
        if (msgList && msgList.length > 0) {
          const finalMsgs = msgList.map((m: any) => ({
            id: m.id,
            chatId: m.chat_id,
            userId: user.uid,
            role: m.role,
            content: m.content,
            createdAt: { seconds: Math.floor(new Date(m.created_at).getTime() / 1000), nanoseconds: 0 } as any
          }));
          
          setMessages(finalMsgs);
          await localChatService.saveMessages(currentChatId, finalMsgs);
          sessionStorage.setItem(`last_fetch_msgs_${currentChatId}`, Date.now().toString());
          lastMsgsFetchId.current = currentChatId;
        }
      } catch (error) {
        console.error("Erro ao buscar mensagens no Supabase:", error);
      }
    };
    fetchMessages();
  }, [currentChatId, user?.uid]);

  const handleSignIn = async () => {
    setIsAuthModalOpen(true);
  };

  const createNewChat = async () => {
    if (!user && !apiKey) {
      setIsAuthModalOpen(true);
      return;
    }
    const currentUserId = user ? user.uid : 'local_offline_user';
    const newChat: Chat = {
      id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      userId: currentUserId,
      title: 'Novo Script',
      mode: ChatMode.NORMAL,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    await localChatService.saveChat(newChat);
    const updated = await localChatService.getChats();
    setLocalChats(updated);
    setCurrentChatId(newChat.id);
  };

  const createHeavyChat = async () => {
    if (!user && !apiKey) {
      setIsAuthModalOpen(true);
      return;
    }
    const currentUserId = user ? user.uid : 'local_offline_user';

    const chatId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const newChat: Chat = {
      id: chatId,
      userId: currentUserId,
      title: 'Modo Pesado',
      mode: ChatMode.HEAVY,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    await localChatService.saveChat(newChat);
    
    // Inject internal AI warning message locally
    const aiMsg: Message = {
      id: `m_ai_init_${Date.now()}`,
      chatId: chatId,
      userId: currentUserId,
      role: 'model',
      content: `🚨 **MODO PESADO ATIVADO** 🚨

Você está utilizando o sistema avançado de geração do Fluxion.

📦 **Como funciona:**
Todo código grande será automaticamente dividido em múltiplos blocos para evitar erros, cortes ou perda de linhas.

⚙️ **Como usar corretamente:**
Após cada parte gerada, digite:
👉 \`!next\`
Isso fará a IA continuar exatamente de onde parou.

📚 **Exemplo de fluxo:**
BLOCO 1 → \`!next\` → BLOCO 2 → \`!next\` → BLOCO 3 → \`!next\` → BLOCO FINAL

⚠️ **Importante:**
- Sempre aguarde cada bloco terminar antes de continuar
- Copie todos os blocos na ordem correta
- Execute apenas após ter o script completo

🔥 Isso garante um código limpo, completo e sem erros.`,
      createdAt: Timestamp.now()
    };
    
    await localChatService.addMessage(chatId, aiMsg);
    const updated = await localChatService.getChats();
    setLocalChats(updated);
    setCurrentChatId(chatId);
  };

  const createConversationChat = async () => {
    if (!user && !apiKey) {
      setIsAuthModalOpen(true);
      return;
    }
    const currentUserId = user ? user.uid : 'local_offline_user';
    const newChat: Chat = {
      id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      userId: currentUserId,
      title: 'Resenha (Modo Conversa)',
      mode: ChatMode.CHAT,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    await localChatService.saveChat(newChat);
    const updated = await localChatService.getChats();
    setLocalChats(updated);
    setCurrentChatId(newChat.id);
  };

  const deleteChat = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Chat',
      message: 'Tem certeza que deseja excluir este chat permanentemente?',
      onConfirm: async () => {
        if (id.startsWith('local_')) {
          await localChatService.deleteChat(id);
          const updated = await localChatService.getChats();
          setLocalChats(updated);
          if (currentChatId === id) setCurrentChatId(null);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          return;
        }

        if (!user) return;
        try {
          if (currentChatId === id) setCurrentChatId(null);
          await deleteDoc(doc(db, 'chats', id));
          // Limpar cache local se existir
          await localChatService.deleteChat(id);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `chats/${id}`, user);
        }
      }
    });
  }, [user, currentChatId]);

  const deleteScript = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Script',
      message: 'Tem certeza que deseja excluir este script salvo?',
      onConfirm: async () => {
        if (user) {
          try {
            await deleteDoc(doc(db, 'scripts', id));
          } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `scripts/${id}`, user);
          }
        } else {
          const updated = savedScripts.filter(s => s.id !== id);
          localStorage.setItem('saved_scripts_offline', JSON.stringify(updated));
          setSavedScripts(updated);
          window.dispatchEvent(new Event('storage'));
        }
      }
    });
  }, [user, savedScripts]);

  const handleExportChat = useCallback(async (chatId: string) => {
    if (!user) return;
    
    const now = Timestamp.now();
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const statsRef = doc(db, 'user_stats', user.uid);
      const statsSnap = await getDocFromServer(statsRef).catch(() => null);
      let stats = statsSnap?.exists() ? statsSnap.data() as UserStats : null;

      // Initialize stats if not exist
      if (!stats) {
        stats = {
          userId: user.uid,
          dailyExportCount: 0,
          lastExportDate: today,
          nextExportAllowedAt: now,
          lastMessagesCount: 0
        };
      }

      // Reset count if new day
      if (stats.lastExportDate !== today) {
        stats.dailyExportCount = 0;
        stats.lastExportDate = today;
      }

      // Check daily limit
      if (stats.dailyExportCount >= 5 && !isAdmin) {
        toast.error("Limite de 5 exportações diárias atingido! Tente novamente amanhã.");
        return;
      }

      // Check cooldown (3 hours)
      if (stats.nextExportAllowedAt.toMillis() > Date.now() && !isAdmin) {
        const remainingMs = stats.nextExportAllowedAt.toMillis() - Date.now();
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        toast.error(`Aguarde ${remainingHours}h para exportar novamente.`);
        return;
      }

      const localMsgs = await localChatService.getMessages(chatId);
      
      // Check for new messages
      if (localMsgs.length <= stats.lastMessagesCount && !isAdmin) {
        toast.info("Nada de novo para exportar neste chat.");
        return;
      }

      toast.loading("Sincronizando com a nuvem...", { id: 'export-sync' });

      // Create or update chat in Firebase
      const allLocal = await localChatService.getChats();
      const localChat = allLocal.find(c => c.id === chatId);
      if (!localChat) throw new Error("Chat local não encontrado");

      const firebaseChatId = chatId.startsWith('local_') ? chatId.replace('local_', '') : chatId;
      
      const ensureTimestamp = (t: any) => {
        if (t instanceof Timestamp) return t;
        if (t && typeof t === 'object' && 'seconds' in t && typeof t.seconds === 'number') {
          return new Timestamp(t.seconds, t.nanoseconds || 0);
        }
        return serverTimestamp();
      };

      try {
        console.log("🚀 [SUPABASE WRITE] Exportando chat e mensagens...");
        await supabaseService.createChat({
          userId: user.uid,
          title: localChat.title || "Untitled Chat"
        });

        for (const msg of localMsgs) {
          await supabaseService.addMessage({
            chatId: firebaseChatId,
            role: msg.role,
            content: msg.content || ""
          });
        }
      } catch (sErr) {
        console.warn("Supabase export failed, attempting Firestore fallback:", sErr);
      }

      try {
        await setDoc(doc(db, 'chats', firebaseChatId), {
          userId: user.uid,
          title: localChat.title || "Untitled Chat",
          createdAt: ensureTimestamp(localChat.createdAt),
          updatedAt: serverTimestamp(),
          mode: localChat.mode || 'heavy'
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `chats/${firebaseChatId}`, user);
      }

      // Sync all messages (clean them up first)
      for (const msg of localMsgs) {
        const msgId = msg.id.startsWith('m_') ? msg.id : `cloud_${msg.id}`;
        const cleanMsg: any = {
          id: msgId,
          chatId: firebaseChatId,
          userId: msg.userId,
          role: msg.role,
          content: msg.content || "",
          createdAt: ensureTimestamp(msg.createdAt)
        };
        if (msg.images && msg.images.length > 0) {
          cleanMsg.images = msg.images;
        }

        try {
          await setDoc(doc(db, `chats/${firebaseChatId}/messages`, msgId), cleanMsg, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `chats/${firebaseChatId}/messages/${msgId}`, user);
        }
      }

      // Update stats
      try {
        await setDoc(statsRef, {
          userId: user.uid,
          dailyExportCount: stats.dailyExportCount + 1,
          lastMessagesCount: localMsgs.length,
          nextExportAllowedAt: Timestamp.fromMillis(Date.now() + 3 * 60 * 60 * 1000),
          lastExportDate: today
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `user_stats/${user.uid}`, user);
      }

      toast.success("Chat exportado com sucesso! 🚀", { id: 'export-sync' });
      
    } catch (error) {
      console.error("Export failure:", error);
      toast.error("Falha ao exportar chat. Verifique sua conexão.", { id: 'export-sync' });
    }
  }, [user, isAdmin]);

  const handleSendMessage = useCallback(async (text: string, images?: string[], thinkingLevel?: string, useBlockMode?: boolean) => {
    if (!user && !apiKey) {
      setIsAuthModalOpen(true);
      return;
    }
    const currentUserId = user ? user.uid : 'local_offline_user';

    if (isActuallyBlocked()) {
      alert(getBlockMessage());
      return;
    }

    const now = Date.now();

    // 1. Cooldown de 3 segundos
    if (now - lastMessageTimeRef.current < 3000) {
      // no-op, just ignore
      return;
    }

    // 2. Bloqueio de 30 segundos se rate limit atingido
    if (now < rateLimitedUntilRef.current) {
      // no-op
      return;
    }

    // 3. Gerenciamento da janela de 1 minuto (5 msgs / min)
    if (now - windowStartTimeRef.current > 60000) {
      windowStartTimeRef.current = now;
      requestCountRef.current = 1;
    } else {
      requestCountRef.current += 1;
      
      if (requestCountRef.current > 5) {
        rateLimitedUntilRef.current = now + 15000; // Bloqueio de 15s (reduzido)
        return;
      }
    }

    lastMessageTimeRef.current = now;

    if (!text.trim() && (!images || images.length === 0)) return;

    let chatId = currentChatId;
    
    // Garantir que temos um chat local
    if (!chatId) {
      const newChat: Chat = {
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        userId: currentUserId,
        title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      await localChatService.saveChat(newChat);
      chatId = newChat.id;
      setCurrentChatId(chatId);
      const updatedLocal = await localChatService.getChats();
      setLocalChats(updatedLocal);
    }

    // Adicionar mensagem local
    const userMsg: Message = {
      id: `m_${Date.now()}`,
      chatId: chatId!,
      userId: currentUserId,
      role: 'user',
      content: text,
      images: images || [],
      createdAt: Timestamp.now()
    };
    
    await localChatService.addMessage(chatId!, userMsg);
    const updatedMsgs = await localChatService.getMessages(chatId!);
    setMessages(updatedMsgs);

    try {
      setIsGenerating(true);
      setStreamingText('');

      const allMessages: { role: 'user' | 'model', content: string, images?: string[] }[] = [
        ...messagesRef.current.map(m => ({ role: m.role, content: m.content, images: m.images })),
        { role: 'user', content: text, images: images }
      ];

      const currentChat = localChats.find(c => c.id === chatId) || chats.find(c => c.id === chatId);
      const isHeavy = currentChat?.mode === ChatMode.HEAVY;
      const isChatMode = currentChat?.mode === ChatMode.CHAT;

      const result = await getGeminiResponse(
        allMessages, 
        apiKey, 
        (chunk) => {
          setStreamingText(prev => prev + chunk);
        },
        isHeavy,
        isChatMode,
        'auto'
      );

      const aiMsg: Message = {
        id: `m_ai_${Date.now()}`,
        chatId: chatId!,
        userId: currentUserId,
        role: 'model',
        content: result,
        createdAt: Timestamp.now()
      };

      await localChatService.addMessage(chatId!, aiMsg);
      const finalMsgs = await localChatService.getMessages(chatId!);
      setMessages(finalMsgs);

      setIsGenerating(false);
      setStreamingText('');
    } catch (error: any) {
      setIsGenerating(false);
      setStreamingText('');

      const errorMessage = error instanceof Error ? error.message : String(error);
      const isSafetyError = errorMessage.toLowerCase().includes('safety') || errorMessage.toLowerCase().includes('finish_reason_safety');
      const isOverloaded = errorMessage.includes('SISTEMA SOBRECARREGADO');
      const isOpenRouterDisabled = errorMessage.includes('desativadas');

      if (!isOverloaded && !isOpenRouterDisabled) {
        console.error('CRITICAL ERROR in handleSendMessage:', error);
      }

      if (isOverloaded) {
        toast.error(
          <div className="flex flex-col gap-2">
            <p className="font-black text-[11px] uppercase leading-tight">
              SISTEMA SOBRECARREGADO
            </p>
            <p className="text-[10px] leading-tight">
              O tráfego global está muito alto. Tente novamente em alguns segundos ou use sua própria API Key nas Configurações.
            </p>
          </div>
        );
      } else if (isOpenRouterDisabled) {
        toast.error("Integração OpenRouter temporariamente desativada. Use uma chave do Google Gemini.", { duration: 5000 });
      } else {
        const isInvalidKey = errorMessage.toLowerCase().includes('api key') || 
                             errorMessage.includes('400') || 
                             errorMessage.includes('key not valid') ||
                             errorMessage.includes('invalid api key');
        
        if (isSafetyError) {
           toast.error("CONTEÚDO BLOQUEADO PELO GOOGLE SAFE SEARCH", { duration: 3000 });
        } else if (isInvalidKey) {
           toast.error("Erro na API Key. Verifique se ela é válida nas configurações.", { duration: 3000 });
        } else {
           console.warn("Erro ao gerar:", errorMessage);
           // Show generic error toast if it's not a common one and seems permanent
           if (errorMessage.length > 5 && !errorMessage.includes('Timeout')) {
             toast.error(`Erro: ${errorMessage.slice(0, 50)}...`, { duration: 4000 });
           }
        }
      }
    }
  }, [user, currentChatId, apiKey, chats, localChats, selectedModel, userIp]);

  const handleSaveScript = async (name: string, content: string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setSaveModal({
      isOpen: true,
      content: content,
      defaultName: name
    });
  };

  const executeSaveScript = async (name: string, overwrite: boolean) => {
    if (!user) return;
    try {
      // Supabase Write
      try {
        await supabaseService.saveScript({
          userId: user.uid,
          name: name,
          content: saveModal.content
        });
      } catch (sErr) {
        console.warn("Supabase script save failed:", sErr);
      }

      if (overwrite) {
        const existingScript = savedScripts.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (existingScript) {
          await updateDoc(doc(db, 'scripts', existingScript.id), {
            content: saveModal.content,
            updatedAt: serverTimestamp()
          });
        }
      } else {
        await addDoc(collection(db, 'scripts'), {
          userId: user.uid,
          name: name,
          content: saveModal.content,
          createdAt: serverTimestamp()
        });
      }
      setSaveModal(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'scripts');
    }
  };

  const handleDownloadScript = (name: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'script'}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if ((userStatus?.banned || isIpBanned) && !isAdmin) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center font-sans text-white text-center p-4">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white/80 mb-2 uppercase">
          🚫 Usuário banido por violação das diretrizes
        </h1>
        <p className="text-sm text-gray-500 max-w-md">
          Seu acesso a esta plataforma foi permanentemente revogado por violar nossos termos de uso.
        </p>
      </div>
    );
  }

  if (!authLoaded || !userStatusLoaded) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion={isOptimized ? "always" : "never"}>
      <Toaster theme="dark" position="top-right" richColors closeButton />


      <AnimatePresence>
        {isOffline && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[10000] bg-red-600 text-white text-[10px] font-black py-1 text-center uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap- hover:bg-red-500 transition-colors cursor-pointer"
            onClick={() => window.location.reload()}
          >
            Modo Offline Ativado • Clique para Tentar Reconectar
          </motion.div>
        )}
      </AnimatePresence>

      <BrowserRouter>
        <Routes>
          <Route path="/home" element={<ConfigPage />} />
          <Route path="/config" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/" element={
            <motion.div 
              initial={isOptimized ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: isOptimized ? 0 : 1 }}
              className="flex h-screen text-white font-sans selection:bg-white/20 overflow-hidden relative"
            >
              {/* Theme Color Background Glow */}
              <AnimatePresence>
              </AnimatePresence>

              {/* Star Background Layer - Disabled when optimized */}
              {!isOptimized && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                  {[...Array(80)].map((_, i) => (
                    <div
                      key={`star-${i}`}
                      className="absolute bg-white rounded-full animate-pulse"
                      style={{
                        width: Math.random() * 2 + 'px',
                        height: Math.random() * 2 + 'px',
                        top: Math.random() * 100 + '%',
                        left: Math.random() * 100 + '%',
                        animationDelay: Math.random() * 5 + 's',
                        opacity: Math.random() * 0.3
                      }}
                    />
                  ))}
                </div>
              )}

            <Sidebar 
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              chats={[...localChats, ...chats.filter(c => !localChats.some(lc => lc.id === c.id || lc.id === `local_${c.id}` || c.id === lc.id.replace('local_', '')))]}
              currentChatId={currentChatId}
              setCurrentChatId={setCurrentChatId}
              createNewChat={createNewChat}
              createHeavyChat={createHeavyChat}
              createConversationChat={createConversationChat}
              deleteChat={deleteChat}
              savedScripts={savedScripts}
              deleteScript={deleteScript}
              user={user}
              apiKey={apiKey}
              setApiKey={setApiKey}
              signOut={signOut}
              signIn={() => setIsAuthModalOpen(true)}
              deferredPrompt={deferredPrompt}
              setDeferredPrompt={setDeferredPrompt}
              isOptimized={isOptimized}
              setIsOptimized={setIsOptimized}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              onExportChat={handleExportChat}
              appUser={appUser}
            />

            <main className="flex-1 flex flex-col relative min-w-0 z-10">
              <div className="lg:hidden absolute top-4 left-4 z-40">
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-black/60 transition-all"
                >
                  <MessageSquare size={16} />
                </button>
              </div>


              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar scroll-smooth"
              >
                <MessageList 
                  messages={messages} 
                  isGenerating={isGenerating} 
                  streamingText={streamingText}
                  onSuggestionClick={(text) => setSuggestion(text)}
                  onSaveScript={handleSaveScript}
                  onDownloadScript={handleDownloadScript}
                  isHeavyMode={chats.find(c => c.id === currentChatId)?.mode === ChatMode.HEAVY}
                  isChatMode={chats.find(c => c.id === currentChatId)?.mode === ChatMode.CHAT}
                />
              </div>

              <ChatInput 
                onSend={handleSendMessage} 
                isGenerating={isGenerating} 
                initialValue={suggestion}
                savedScripts={savedScripts}
                isBlockMode={isBlockMode}
                setIsBlockMode={setIsBlockMode}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                appUser={appUser}
              />
            </main>

            <AuthModal 
              isOpen={isAuthModalOpen} 
              onClose={() => setIsAuthModalOpen(false)} 
            />

            <ConfirmationModal 
              isOpen={confirmModal.isOpen}
              title={confirmModal.title}
              message={confirmModal.message}
              onConfirm={confirmModal.onConfirm}
              onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />

            <SaveScriptModal
              isOpen={saveModal.isOpen}
              onClose={() => setSaveModal(prev => ({ ...prev, isOpen: false }))}
              onSave={executeSaveScript}
              existingScripts={savedScripts}
              defaultName={saveModal.defaultName}
            />

            <style>{`
              .custom-scrollbar::-webkit-scrollbar {
                width: 3px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.2);
              }
            `}</style>
          </motion.div>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </MotionConfig>
  );
}
