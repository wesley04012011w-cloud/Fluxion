import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, 
  LogOut, 
  User as UserIcon, 
} from 'lucide-react';
import { auth, db, signIn, signOut } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
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
  Timestamp
} from 'firebase/firestore';
import { getGeminiResponse, geminiModel } from './gemini';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import ConfirmationModal from './components/ConfirmationModal';
import SettingsModal from './components/SettingsModal';
import { Chat, Message, OperationType, handleFirestoreError, AppSettings, UserProfile, cn } from './types';
import { setDoc } from 'firebase/firestore';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 text-white">
          <div className="max-w-md w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Ops! Algo deu errado.</h2>
            <p className="text-gray-400 mb-6 text-sm">
              {this.state.error?.message || "Ocorreu um erro inesperado na interface."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all"
            >
              RECARREGAR APP
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [streamingText, setStreamingText] = useState('');
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('fluxion_settings');
    return saved ? JSON.parse(saved) : {
      theme: 'glass',
      aiTone: 'professional',
      isOptimized: false,
      lastAiMode: 'explain',
      apiKeys: []
    };
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('fluxion_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Update user profile in Firestore
        try {
          await setDoc(doc(db, 'users', u.uid), {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            lastSeen: serverTimestamp(),
            role: u.email === 'soparonosk37@gmail.com' ? 'admin' : 'user'
          }, { merge: true });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `users/${u.uid}`);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'scripts'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scripts = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name, 
        content: doc.data().content 
      }));
      setSavedScripts(scripts);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!currentChatId) {
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
    });
    return unsubscribe;
  }, [currentChatId]);

  const createNewChat = async () => {
    if (!user) return;
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

  const deleteChat = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Chat',
      message: 'Tem certeza que deseja excluir este chat permanentemente?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'chats', id));
          if (currentChatId === id) setCurrentChatId(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `chats/${id}`);
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
        try {
          await deleteDoc(doc(db, 'scripts', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `scripts/${id}`);
        }
      }
    });
  }, []);

  const handleSendMessage = useCallback(async (text: string, images?: string[]) => {
    if (!user || (!text.trim() && (!images || images.length === 0))) return;

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

      const result = await getGeminiResponse(allMessages, settings.apiKeys, settings.aiTone);
      let fullText = '';
      
      for await (const chunk of result) {
        const chunkText = chunk.text;
        fullText += chunkText;
        setStreamingText(fullText);
      }

      await addDoc(collection(db, `chats/${chatId}/messages`), {
        chatId,
        role: 'model',
        content: fullText,
        createdAt: serverTimestamp()
      });

      setIsGenerating(false);
      setStreamingText('');
    } catch (error: any) {
      console.error('Error:', error);
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        chatId,
        role: 'model',
        content: `**Erro:** ${error.message || 'Falha ao gerar resposta.'}`,
        createdAt: serverTimestamp()
      });
      setIsGenerating(false);
      setStreamingText('');
    }
  }, [user, currentChatId, messages]);

  const handleSaveScript = async (name: string, content: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'scripts'), {
        userId: user.uid,
        name: name,
        content: content,
        createdAt: serverTimestamp()
      });
      alert('Script salvo com sucesso!');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 overflow-hidden relative">
        <div className="absolute inset-0 z-0">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-white rounded-full animate-pulse"
              style={{
                width: Math.random() * 2 + 'px',
                height: Math.random() * 2 + 'px',
                top: Math.random() * 100 + '%',
                left: Math.random() * 100 + '%',
                animationDelay: Math.random() * 5 + 's',
                opacity: Math.random() * 0.5
              }}
            />
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-md w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 text-center relative z-10 shadow-2xl"
        >
          <div className="w-24 h-24 bg-black border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl overflow-hidden group">
            <img 
              src="/logo.png" 
              alt="Fluxion Logo" 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback if logo.png doesn't exist
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="text-4xl font-black text-white">F</div>';
              }}
            />
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">FLUXION</h1>
          <p className="text-gray-400 mb-8 text-sm">A inteligência definitiva para desenvolvedores Roblox.</p>
          <button
            onClick={signIn}
            className="w-full py-4 bg-white hover:bg-gray-200 text-black font-black rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3"
          >
            <UserIcon size={20} />
            ENTRAR COM GOOGLE
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <motion.div 
        initial={settings.isOptimized ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: settings.isOptimized ? 0 : 1 }}
        className={cn(
          "flex h-screen text-white font-sans selection:bg-white/20 overflow-hidden relative",
          settings.theme === 'dark' ? "bg-black" : settings.theme === 'light' ? "bg-gray-100 text-black" : "bg-[#050505]"
        )}
      >
        {/* Star Background Layer */}
        {!settings.isOptimized && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            {[...Array(80)].map((_, i) => (
              <div
                key={i}
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
          deleteChat={deleteChat}
          savedScripts={savedScripts}
          deleteScript={deleteScript}
          user={user}
          signOut={signOut}
          onOpenSettings={() => setIsSettingsOpen(true)}
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
            />
          </div>

          <ChatInput 
            onSend={handleSendMessage} 
            isGenerating={isGenerating} 
            initialValue={suggestion}
            savedScripts={savedScripts}
            lastAiMode={settings.lastAiMode}
            onModeChange={(mode) => setSettings(prev => ({ ...prev, lastAiMode: mode }))}
          />
        </main>

        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={(newSettings) => setSettings(prev => ({ ...prev, ...newSettings }))}
          isAdmin={user?.email === 'soparonosk37@gmail.com'}
        />

        <ConfirmationModal 
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
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
    </ErrorBoundary>
  );
}
