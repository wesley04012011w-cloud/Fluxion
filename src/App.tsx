import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, 
  LogOut, 
  User as UserIcon,
  Bell
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
  limit
} from 'firebase/firestore';
import { getGeminiResponse, geminiModel } from './gemini';
import { checkSecurityWithGroq } from './services/groqService';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import Sidebar from './components/Sidebar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import ConfirmationModal from './components/ConfirmationModal';
import SaveScriptModal from './components/SaveScriptModal';
import { Chat, Message, OperationType, handleFirestoreError, ChatMode } from './types';
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
  const [savedScripts, setSavedScripts] = useState<{id: string, name: string, content: string}[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
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
        console.error("IP check error:", error);
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

  const isAdmin = user && (
    user.email === 'wesley04012011w@gmail.com' || 
    user.email === 'soparonosk37@gmail.com' ||
    user.uid === 'lNvYzIXKQWQ85n51WgFfM1Axw733'
  );

  const isActuallyBlocked = () => {
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
    if (!user || !currentChatId) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, `chats/${currentChatId}/messages`),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${currentChatId}/messages`, user);
    });
    return unsubscribe;
  }, [currentChatId, user]);

  const handleSignIn = async () => {
    setIsAuthModalOpen(true);
  };

  const createNewChat = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: 'Novo Script',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setCurrentChatId(docRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const createHeavyChat = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: 'Modo Pesado',
        mode: 'heavy',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setCurrentChatId(docRef.id);
      
      // Inject internal AI warning message
      await addDoc(collection(db, `chats/${docRef.id}/messages`), {
        chatId: docRef.id,
        userId: user.uid,
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
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const createConversationChat = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: 'Resenha (Modo Conversa)',
        mode: 'chat',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setCurrentChatId(docRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const deleteChat = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Chat',
      message: 'Tem certeza que deseja excluir este chat permanentemente?',
      onConfirm: async () => {
        try {
          if (currentChatId === id) setCurrentChatId(null);
          await deleteDoc(doc(db, 'chats', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `chats/${id}`, user);
        }
      }
    });
  }, [currentChatId]);

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

  const handleSendMessage = useCallback(async (text: string, images?: string[], thinkingLevel?: string, useBlockMode?: boolean) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (isActuallyBlocked()) {
      alert(getBlockMessage());
      return;
    }

    if (!text.trim() && (!images || images.length === 0)) return;

    let chatId = currentChatId;
    if (!chatId) {
      try {
        const docRef = await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        chatId = docRef.id;
        setCurrentChatId(chatId);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'chats');
        return;
      }
    }

    try {
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        chatId,
        userId: user.uid,
        role: 'user',
        content: text,
        images: images || [],
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'chats', chatId), { updatedAt: serverTimestamp() });

      setIsGenerating(true);
      setStreamingText('');

      const allMessages: { role: 'user' | 'model', content: string, images?: string[] }[] = [
        ...messages.map(m => ({ role: m.role, content: m.content, images: m.images })),
        { role: 'user', content: text, images: images }
      ];

      const currentChat = chats.find(c => c.id === chatId);
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

      await addDoc(collection(db, `chats/${chatId}/messages`), {
        chatId,
        userId: user.uid,
        role: 'model',
        content: result,
        createdAt: serverTimestamp()
      });

      // 1. Audit conversation with Groq (NORMAL CASE)
      console.log('🛡️ Triggering security audit for message:', text.slice(0, 50));
      const auditResult = await checkSecurityWithGroq(text, result, user.uid, user.email || 'Anônimo', { success: true }, chatId);
      
      // Se o auditor Groq detectar algo pesado que passou pelo Gemini, forçamos um log extra se necessário (embora o groqService já logue)
      console.log('Audit Normal Result:', auditResult);

      setIsGenerating(false);
      setStreamingText('');
    } catch (error: any) {
      console.error('Error in send message:', error);
      setIsGenerating(false);
      setStreamingText('');
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isSafetyError = errorMessage.toLowerCase().includes('safety') || errorMessage.toLowerCase().includes('finish_reason_safety');

      // LOG IMEDIATO PARA O PAINEL SE FOR BLOQUEIO DE SEGURANÇA
      if (isSafetyError) {
        await addDoc(collection(db, 'security_alerts'), {
          userId: user.uid,
          userEmail: user.email || 'Anônimo',
          chatId: chatId || null,
          type: 'jailbreak_attempt',
          content: `MENSAGEM BLOQUEADA PELO GEMINI: ${text}`,
          analysis: 'O filtro de segurança do Google (Gemini) barrou esta mensagem por conteúdo impróprio ou tentativa de bypass.',
          severity: 'high',
          createdAt: Timestamp.now(),
          status: 'pending',
          flow: {
            readMessage: true,
            responseSent: false,
            blocked: true,
            blockedBy: 'Gemini Safety Filter',
            error: errorMessage
          }
        });
      }

      // 2. Audit conversation with Groq (ERROR/SAFETY CASE)
      checkSecurityWithGroq(text, `[ERRO/BLOQUEIO]: ${errorMessage}`, user.uid, user.email || 'Anônimo', { 
        success: false, 
        error: errorMessage, 
        isSafetyError: isSafetyError 
      }, chatId).catch(err => console.error("Groq Check error (on fail):", err));

      // Error Reporting System
      try {
        await addDoc(collection(db, 'error_logs'), {
          userId: user.uid,
          userEmail: user.email,
          error: errorMessage,
          chatId: chatId,
          createdAt: serverTimestamp(),
          resolved: false,
          model: selectedModel,
          isSafetyAlert: isSafetyError
        });
        
        let userFeedback = `❌ Ops, ocorreu um erro de conexão ou de API ao gerar a resposta.`;
        if (isSafetyError) {
          userFeedback = `🛡️ **ALERTA DE SEGURANÇA**\n\nO Fluxion identificou que sua solicitação viola nossas diretrizes de segurança. Esta interação foi registrada e enviada para revisão dos administradores.`;
        }

        await addDoc(collection(db, `chats/${chatId}/messages`), {
          chatId,
          userId: user.uid,
          role: 'model',
          content: `${userFeedback}\n\nRelatório: ${errorMessage.slice(0, 100)}...`,
          createdAt: serverTimestamp()
        });
      } catch(logError) {
        console.error("Failed to log error to firestore", logError);
      }
    }
  }, [user, currentChatId, messages, apiKey, chats]);

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
              <Toaster theme="dark" position="top-right" richColors closeButton />
              
              <AnimatePresence>
                {isOffline && (
                  <motion.div 
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white text-[10px] font-black py-1 text-center uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap- hover:bg-red-500 transition-colors cursor-pointer"
                    onClick={() => window.location.reload()}
                  >
                    Modo Offline Ativado • Clique para Tentar Reconectar
                  </motion.div>
                )}
              </AnimatePresence>
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
              chats={chats}
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
