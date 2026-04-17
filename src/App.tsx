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
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { getGeminiResponse, geminiModel } from './gemini';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import ConfirmationModal from './components/ConfirmationModal';
import SaveScriptModal from './components/SaveScriptModal';
import { Chat, Message, OperationType, handleFirestoreError } from './types';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ConfigPage from './pages/ConfigPage';

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
  const [isBlockMode, setIsBlockMode] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');

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
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      
      if (u) {
        // Update user activity
        setDoc(doc(db, 'users', u.uid), {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          lastActive: serverTimestamp(),
          isOnline: true
        }, { merge: true });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Heartbeat for online status
    const interval = setInterval(() => {
      setDoc(doc(db, 'users', user.uid), {
        lastActive: serverTimestamp(),
        isOnline: true
      }, { merge: true });
    }, 60000); // Every minute

    return () => clearInterval(interval);
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
      handleFirestoreError(error, OperationType.LIST, 'chats');
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'scripts');
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
      handleFirestoreError(error, OperationType.LIST, `chats/${currentChatId}/messages`);
    });
    return unsubscribe;
  }, [currentChatId, user]);

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

  const createHeavyChat = async () => {
    if (!user) {
      await signIn();
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

  const handleSendMessage = useCallback(async (text: string, images?: string[], thinkingLevel?: string, useBlockMode?: boolean) => {
    if (!user) {
      try {
        await signIn();
        return; // Stop here, user needs to send message again 
      } catch (error) {
        console.error("Login failed:", error);
        return;
      }
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

      const result = await getGeminiResponse(
        allMessages, 
        apiKey, 
        thinkingLevel as any, 
        useBlockMode, 
        chats.find(c => c.id === chatId)?.mode === 'heavy'
      );
      let fullText = '';
      
      for await (const chunk of result) {
        const chunkText = chunk.text;
        fullText += chunkText;
        setStreamingText(fullText);
      }

      await addDoc(collection(db, `chats/${chatId}/messages`), {
        chatId,
        userId: user.uid,
        role: 'model',
        content: fullText,
        createdAt: serverTimestamp()
      });

      setIsGenerating(false);
      setStreamingText('');
    } catch (error) {
      console.error('Error:', error);
      setIsGenerating(false);
      setStreamingText('');
    }
  }, [user, currentChatId, messages, apiKey]);

  const handleSaveScript = async (name: string, content: string) => {
    if (!user) {
      try {
        await signIn();
        return;
      } catch (error) {
        return;
      }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/home" element={<ConfigPage />} />
        <Route path="/" element={
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="flex h-screen bg-[#050505] text-white font-sans selection:bg-white/20 overflow-hidden relative"
          >
            {/* Star Background Layer */}
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

            <Sidebar 
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              chats={chats}
              currentChatId={currentChatId}
              setCurrentChatId={setCurrentChatId}
              createNewChat={async () => {
                if (!user) {
                  await signIn();
                  return;
                }
                createNewChat();
              }}
              createHeavyChat={createHeavyChat}
              deleteChat={deleteChat}
              savedScripts={savedScripts}
              deleteScript={deleteScript}
              user={user}
              apiKey={apiKey}
              setApiKey={setApiKey}
              signOut={signOut}
              signIn={signIn}
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
                  isHeavyMode={chats.find(c => c.id === currentChatId)?.mode === 'heavy'}
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
  );
}
