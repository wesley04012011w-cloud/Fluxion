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
  getDocFromServer
} from 'firebase/firestore';
import { getGeminiResponse, geminiModel } from './gemini';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import Sidebar from './components/Sidebar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import ConfirmationModal from './components/ConfirmationModal';
import SaveScriptModal from './components/SaveScriptModal';
import { Chat, Message, OperationType, handleFirestoreError, ChatMode, UserStats } from './types';
import { localChatService } from './services/localChatService';
import AuthModal from './components/AuthModal';
import NotificationsModal from './components/NotificationsModal';
import { Toaster, toast } from 'sonner';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ConfigPage from './pages/ConfigPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'fluxion');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  
  // MODO MANUTENÇÃO FORÇADO (LOCAL)
  const [hardcodedMaintenance, setHardcodedMaintenance] = useState(false);
  const [showGhostModal, setShowGhostModal] = useState(false);
  const [ghostEmailInput, setGhostEmailInput] = useState('');
  
  const [localMaintenancePreview, setLocalMaintenancePreview] = useState(() => {
    return localStorage.getItem('admin_maintenance_preview') === 'true';
  });
  const [adminBypassedMode, setAdminBypassedMode] = useState(() => {
    return localStorage.getItem('admin_bypassed_mode') === 'true' || localStorage.getItem('local_bypass_active') === 'true';
  });

  const handleGhostBypassSubmit = () => {
    if (ghostEmailInput.trim() === 'wesley04012011w@gmail.com' || ghostEmailInput.trim() === 'soparonosk37@gmail.com') {
      setHardcodedMaintenance(false);
      setAdminBypassedMode(true);
      localStorage.setItem('local_bypass_active', 'true');
      localStorage.setItem('admin_bypassed_mode', 'true');
      setShowGhostModal(false);
      setGhostEmailInput('');
      toast.success("ACESSO ADMIN LIBERADO");
    } else {
      toast.error("ACESSO NEGADO");
      setShowGhostModal(false);
    }
  };
  const lastMessageTimeRef = useRef<number>(0);
  const requestCountRef = useRef<number>(0);
  const windowStartTimeRef = useRef<number>(0);
  const rateLimitedUntilRef = useRef<number>(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleQuota = () => {
      setIsQuotaExceeded(true);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsQuotaExceeded(false);
      }, 5000); // Esconde após 5 segundos
    };
    window.addEventListener('firestore-quota-exceeded', handleQuota);
    return () => {
      window.removeEventListener('firestore-quota-exceeded', handleQuota);
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
    // Monitor Maintenance Mode from System Config
    const unsub = onSnapshot(doc(db, 'config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMaintenanceMode(data.maintenanceMode || false);
      }
    }, (error) => {
      console.warn("Could not fetch maintenance status (offline/quota):", error);
    });

    // Handle Local Maintenance Preview from Admin Page
    const handleLocalPreview = (e: any) => {
      setLocalMaintenancePreview(e.detail.active);
      if (e.detail.active) {
        setAdminBypassedMode(false);
        localStorage.setItem('admin_bypassed_mode', 'false');
      }
    };
    window.addEventListener('local-maintenance-preview', handleLocalPreview);

    return () => {
      unsub();
      window.removeEventListener('local-maintenance-preview', handleLocalPreview);
    };
  }, [isAdmin]);

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

      // Verificar se o IP está banido
      const ipKey = ip.replace(/\./g, '_');
      const ipDocRef = doc(db, 'banned_ips', ipKey);
      
      const unsub = onSnapshot(ipDocRef, (snapshot) => {
        if (snapshot.exists()) {
          setIsIpBanned(true);
          console.log("🚫 Status: IP Banido", ip);
          toast.error("ACESSO NEGADO: Seu endereço IP está na lista negra.", { duration: Infinity });
        } else {
          setIsIpBanned(false);
          console.log("✅ Status: IP Limpo", ip);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `banned_ips/${ipKey}`, user);
      });
      
      return unsub;
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
    localStorage.setItem('app_theme', theme);
    document.body.className = `theme-${theme}`;
  }, [theme]);

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
      setTheme(localStorage.getItem('app_theme') || 'fluxion');
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

    const unsubscribe = onAuthStateChanged(auth, (u) => {
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
              scripts.forEach(async (script: any) => {
                await addDoc(collection(db, 'scripts'), {
                  userId: u.uid,
                  name: script.name,
                  content: script.content,
                  createdAt: serverTimestamp()
                });
              });
              localStorage.removeItem('saved_scripts_offline');
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

  useEffect(() => {
    if (!user) {
      setUserStatus(null);
      setUserStatusLoaded(true);
      return;
    }

    // Monitorar status do usuário em tempo real
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserStatus({
          banned: data.isBanned || false,
          blockedUntil: data.blockedUntil
        });
      } else {
        setUserStatus({ banned: false });
      }
      setUserStatusLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`, user);
      setUserStatusLoaded(true);
    });

    // Batimento cardíaco de presença e registro de IP agressivo
    const updatePresence = async () => {
      // Evitar logs se já estivermos detectados como bloqueados
      if (isIpBanned) return; 

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
          lastActive: serverTimestamp(),
          isOnline: true,
          updatedAt: serverTimestamp(),
          fingerprint: fingerprint
        };

        if (currentIp) {
          presenceData.lastIp = currentIp;
          localStorage.setItem('last_user_ip', currentIp);
          
          // Log extra de segurança para capturar invasores (agora com fingerprint)
          const logRef = doc(db, 'access_logs', `${user.uid}_${Date.now()}`);
          setDoc(logRef, {
            uid: user.uid,
            email: user.email,
            ip: currentIp,
            fingerprint: fingerprint,
            timestamp: serverTimestamp()
          }).catch(() => {});
        } else {
          // Log de acesso sem IP (suspeito ou bloqueado)
          const logRef = doc(db, 'access_logs', `NOIP_${user.uid}_${Date.now()}`);
          setDoc(logRef, {
            uid: user.uid,
            email: user.email,
            ip: 'BLOCKED/HIDDEN',
            fingerprint: fingerprint,
            timestamp: serverTimestamp(),
            suspicious: true
          }).catch(() => {});
        }

        await setDoc(doc(db, 'users', user.uid), presenceData, { merge: true });
      } catch (e) {
        console.error("Presence update failed:", e);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 60000); // 1 minuto
    
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [user, userIp]);

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
    if (!user) return;
    const qAnnouncements = query(collection(db, 'announcements'), where('isActive', '==', true));
    const unsubAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
      setActiveAnnouncementsCount(snapshot.size);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements', user);
    });
    return () => unsubAnnouncements();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(chatList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats', user);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) {
      // Load offline scripts if not logged in
      const offline = localStorage.getItem('saved_scripts_offline');
      if (offline) setSavedScripts(JSON.parse(offline));
      return;
    }
    const q = query(
      collection(db, 'scripts'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scriptsList = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name, 
        content: doc.data().content 
      }));
      setSavedScripts(scriptsList);
      // Cache scripts for offline viewing/copying
      localStorage.setItem('saved_scripts_offline', JSON.stringify(scriptsList));
    }, (error) => {
      // On error (like offline), try to load from cache
      const cached = localStorage.getItem('saved_scripts_offline');
      if (cached) setSavedScripts(JSON.parse(cached));
      handleFirestoreError(error, OperationType.LIST, 'scripts', user);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!currentChatId || !user) return;

    // Se o chat for local (ID começa com local_), não buscamos na nuvem
    if (currentChatId.startsWith('local_')) return;

    const q = query(
      collection(db, `chats/${currentChatId}/messages`),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const msgList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
        setMessages(msgList);
        // Sincroniza com local para visualização offline
        await localChatService.saveMessages(currentChatId, msgList);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${currentChatId}/messages`, user);
    });
    return unsubscribe;
  }, [currentChatId, user]);

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

      // Check cooldown (5 min)
      if (stats.nextExportAllowedAt.toMillis() > Date.now() && !isAdmin) {
        const remaining = Math.ceil((stats.nextExportAllowedAt.toMillis() - Date.now()) / 60000);
        toast.error(`Aguarde ${remaining}min para exportar novamente.`);
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
          nextExportAllowedAt: Timestamp.fromMillis(Date.now() + 5 * 60000),
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
      toast.error("calma aí chefe 🧠", { id: 'spam-warning' });
      return;
    }

    // 2. Bloqueio de 30 segundos se rate limit atingido
    if (now < rateLimitedUntilRef.current) {
      const remaining = Math.ceil((rateLimitedUntilRef.current - now) / 1000);
      toast.error(`Muitas mensagens! Aguarde mais ${remaining}s 🧠`, { id: 'rate-limit-warning' });
      return;
    }

    // 3. Gerenciamento da janela de 1 minuto (5 msgs / min)
    if (now - windowStartTimeRef.current > 60000) {
      windowStartTimeRef.current = now;
      requestCountRef.current = 1;
    } else {
      requestCountRef.current += 1;
      
      if (requestCountRef.current > 5) {
        rateLimitedUntilRef.current = now + 30000; // Bloqueio de 30s
        toast.error("Limite atingido! Bloqueado por 30s 🧠", { duration: 5000 });
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
        selectedModel
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

      if (!isOverloaded) {
        console.error('CRITICAL ERROR in handleSendMessage:', error);
      }

      if (isOverloaded) {
        toast.error(
          <div className="flex flex-col gap-2">
            <p className="font-black text-[11px] uppercase leading-tight">
              SISTEMA SOBRECARREGADO
            </p>
            <p className="text-[10px] leading-tight">
              Vá em <b>Configurações</b> (ícone de engrenagem) e insira sua própria API Key do Gemini (gratuita) para continuar usando localmente.
            </p>
          </div>
        );
      } else {
        const isInvalidKey = errorMessage.toLowerCase().includes('api key') || errorMessage.includes('400') || errorMessage.includes('key not valid');
        
        toast.error(
          <div className="flex flex-col gap-2">
            <p className="font-black text-[10px] uppercase">
              {isSafetyError ? "CONTEÚDO BLOQUEADO" : (isInvalidKey ? "API KEY INVÁLIDA" : "ERRO AO ENVIAR")}
            </p>
            {isInvalidKey && (
              <p className="text-[9px] leading-tight text-white/80">
                A API Key que você inseriu parece ser inválida. Verifique nas configurações.
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-bold">Dúvidas? Staff:</span>
              <a 
                href="https://discord.gg/YvRBUyhpZ" 
                target="_blank" 
                rel="noreferrer"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-[8px] font-black uppercase transition-all"
              >
                Discord
              </a>
            </div>
            {!isInvalidKey && !isSafetyError && (
              <p className="text-[8px] opacity-50 break-words mt-1">{errorMessage.slice(0, 50)}...</p>
            )}
          </div>
        );
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
      
      {/* GHOST ADMIN BUTTON */}
      <div 
        onClick={() => setShowGhostModal(true)}
        className="fixed bottom-4 left-4 w-12 h-12 z-[10000] bg-white/[0.01] hover:bg-white/[0.05] border border-white/[0.02] rounded-full transition-all cursor-pointer flex items-center justify-center pointer-events-auto shadow-2xl"
        title="Portal Admin Secret"
      >
        <div className="w-1.5 h-1.5 bg-white/20 rounded-full group-hover:bg-white/40" />
      </div>

      {showGhostModal && (
        <div className="fixed inset-0 z-[10001] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 p-6 rounded-2xl w-full max-w-sm space-y-4">
            <h3 className="font-black text-white text-lg tracking-tight">ACESSO DESENVOLVEDOR</h3>
            <input 
              type="email" 
              placeholder="Digite seu email..."
              value={ghostEmailInput}
              onChange={(e) => setGhostEmailInput(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleGhostBypassSubmit()}
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setShowGhostModal(false)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all text-xs"
              >
                CANCELAR
              </button>
              <button 
                onClick={handleGhostBypassSubmit}
                className="flex-1 px-4 py-3 bg-white hover:bg-gray-200 text-black rounded-xl font-black transition-all text-xs"
              >
                ACESSAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODO MANUTENÇÃO OVERLAY */}
      <AnimatePresence>
        {(hardcodedMaintenance || maintenanceMode || (isAdmin && localMaintenancePreview)) && (!isAdmin || !adminBypassedMode) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[#050505] flex flex-col items-center justify-center p-6 text-center overflow-hidden"
          >
            <div 
              className="absolute inset-0 z-0 opacity-20"
              style={{
                background: `radial-gradient(circle at 50% 50%, #3b82f6 0%, transparent 70%)`
              }}
            />
            
            <div className="relative z-10 space-y-8 max-w-md">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 mx-auto text-blue-500 opacity-80"
              >
                <RefreshCw size={96} strokeWidth={1} />
              </motion.div>
              
              <div className="space-y-4">
                <h1 className="text-4xl font-black tracking-tighter uppercase text-white">
                  App em Manutenção
                </h1>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs leading-relaxed">
                  Estamos realizando melhorias técnicas para garantir a melhor experiência possível. Voltaremos em instantes!
                </p>
              </div>

              {isAdmin && (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setAdminBypassedMode(true);
                      localStorage.setItem('admin_bypassed_mode', 'true');
                    }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black text-white transition-all uppercase tracking-widest shadow-xl shadow-blue-900/20"
                  >
                    Continuar como Administrador
                  </button>
                  <p className="text-[9px] text-gray-500 font-bold uppercase text-center opacity-60">
                    Você está vendo isso porque é um Admin
                  </p>
                </div>
              )}

              <div className="pt-8 border-t border-white/5">
                <div className="flex items-center justify-center gap-3 text-blue-400">
                  <Activity size={16} className="animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-tight">Status: Otimizando Infraestrutura</span>
                </div>
              </div>
              
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                <p className="text-gray-500 text-[10px] font-mono italic">
                  Agradecemos a paciência. Siga-nos no Discord para atualizações em tempo real.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        {isQuotaExceeded && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[10000] bg-amber-600 text-white text-[10px] font-black py-1.5 px-4 text-center uppercase tracking-[0.1em] shadow-lg flex flex-col items-center justify-center gap-0 pointer-events-auto cursor-pointer"
            onClick={() => document.getElementById('settings-btn')?.click()}
          >
            <span className="font-bold">⚠️ Banco de dados em sobrecarga (Cota Excedida)</span>
            <span className="text-[8px] opacity-90 max-w-sm normal-case tracking-normal">A cota do sistema esgotou. Vá em <b>Configurações</b> (ícone de engrenagem) e insira sua própria API Key do Gemini (gratuita) para usar o app localmente enquanto resolvemos.</span>
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
                {isGlowEnabled && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.12 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-0 pointer-events-none transition-all duration-1000"
                    style={{
                      background: `radial-gradient(circle at 50% 120%, var(--accent-primary) 0%, transparent 60%)`
                    }}
                  />
                )}
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
            />

            <main className="flex-1 flex flex-col relative min-w-0 z-10">
              <div className="lg:hidden absolute top-4 left-4 z-40">
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-white/20 transition-all"
                >
                  <MessageSquare size={16} />
                </button>
              </div>

              {user && (
                <div className="absolute top-4 right-4 z-40">
                  <button 
                    onClick={() => setIsNotificationsOpen(true)}
                    className="p-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all relative"
                    title="Comunicados"
                  >
                    <Bell size={16} />
                    {activeAnnouncementsCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#09090b]"></span>
                    )}
                  </button>
                </div>
              )}

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

            <NotificationsModal
              isOpen={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
              user={user}
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
