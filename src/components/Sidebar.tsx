import React from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  FileCode, 
  ChevronLeft,
  Key,
  LogOut,
  Settings,
  Shield
} from 'lucide-react';
import { Chat, cn } from '../types';
import { User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  chats: Chat[];
  currentChatId: string | null;
  setCurrentChatId: (id: string) => void;
  createNewChat: () => void;
  createHeavyChat?: () => void;
  deleteChat: (id: string, e: React.MouseEvent) => void;
  savedScripts: {id: string, name: string, content: string}[];
  deleteScript: (id: string, e: React.MouseEvent) => void;
  user: User | null;
  apiKey: string;
  setApiKey: (key: string) => void;
  signOut: () => void;
  signIn: () => void;
  deferredPrompt?: any;
  setDeferredPrompt?: (prompt: any) => void;
}

const Sidebar = React.memo(({
  isSidebarOpen,
  setIsSidebarOpen,
  chats,
  currentChatId,
  setCurrentChatId,
  createNewChat,
  createHeavyChat,
  deleteChat,
  savedScripts,
  deleteScript,
  user,
  apiKey,
  setApiKey,
  signOut,
  signIn,
  deferredPrompt,
  setDeferredPrompt
}: SidebarProps) => {
  const [showApiInput, setShowApiInput] = React.useState(false);
  const navigate = useNavigate();
  const isAdmin = user?.email === 'soparonosk37@gmail.com';

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt?.(null);
    }
  };

  return (
    <motion.aside
      initial={false}
      animate={{ 
        x: isSidebarOpen ? 0 : -240,
        width: isSidebarOpen ? 240 : 0
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={cn(
        "fixed lg:relative inset-y-0 left-0 bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col z-50 overflow-hidden",
        !isSidebarOpen && "lg:w-0"
      )}
    >
      <div className="p-3 flex flex-col h-full w-[240px]">
        <div className="flex items-center justify-between mb-4 lg:hidden">
          <h2 className="font-bold text-white text-sm">Menu</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 hover:bg-white/5 rounded-lg">
            <ChevronLeft size={18} />
          </button>
        </div>

        <button
          onClick={() => {
            createNewChat();
            if (window.innerWidth < 1024) setIsSidebarOpen(false);
          }}
          className="flex items-center gap-2 w-full p-2.5 rounded-lg bg-white hover:bg-gray-200 text-black font-bold transition-all mb-2 shadow-lg shadow-white/5 text-xs"
        >
          <Plus size={16} />
          <span>NOVO SCRIPT</span>
        </button>

        <button
          onClick={() => {
            // Functionality for setting heavy mode string directly will be implemented down the line
            // for now, we just pass another prop or dispatch event.
            // A better way is to pass a prop 'createHeavyChat' from App.tsx.
            createHeavyChat?.();
            if (window.innerWidth < 1024) setIsSidebarOpen(false);
          }}
          className="flex items-center gap-2 w-full p-2.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 font-bold transition-all mb-4 shadow-lg shadow-black/20 text-xs"
        >
          <Plus size={16} />
          <span>MODO PESADO</span>
        </button>

        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
          {/* Chats Section */}
          <div className="space-y-0.5">
            <div className="px-2 mb-1">
              <label className="text-[8px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare size={8} />
                Histórico de Chats
              </label>
            </div>
            {!user ? (
              <div className="px-2 py-3 text-[10px] text-gray-600 italic">Faça login para ver seu histórico.</div>
            ) : chats.length === 0 ? (
              <div className="px-2 py-3 text-[10px] text-gray-600 italic">Nenhum chat encontrado.</div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => {
                    setCurrentChatId(chat.id);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all",
                    currentChatId === chat.id ? "bg-white/10 text-white" : "hover:bg-white/5 text-gray-400"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare size={14} className={currentChatId === chat.id ? "text-white" : ""} />
                    <span className="truncate text-xs font-medium">{chat.title}</span>
                  </div>
                  <button
                    onClick={(e) => deleteChat(chat.id, e)}
                    className="p-1 hover:text-red-500 transition-all text-gray-600 hover:bg-white/5 rounded"
                    title="Excluir Chat"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Scripts Section */}
          <div className="space-y-0.5">
            <div className="px-2 mb-1">
              <label className="text-[8px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode size={8} />
                Scripts Salvos
              </label>
            </div>
            {!user ? (
              <div className="px-2 py-3 text-[10px] text-gray-600 italic">Faça login para ver seus scripts.</div>
            ) : savedScripts.length === 0 ? (
              <div className="px-2 py-3 text-[10px] text-gray-600 italic">Nenhum script salvo.</div>
            ) : (
              savedScripts.map((script) => (
                <div
                  key={script.id}
                  className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-all"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode size={14} className="text-gray-500" />
                    <span className="truncate text-xs font-medium">{script.name}</span>
                  </div>
                  <button
                    onClick={(e) => deleteScript(script.id, e)}
                    className="p-1 hover:text-red-500 transition-all text-gray-600 hover:bg-white/5 rounded"
                    title="Excluir Script"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom Section: API Key & Sign Out */}
        <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 w-full p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all text-xs font-bold border border-blue-500/20 mb-2 shadow-lg shadow-black/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              <span>INSTALAR APP</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => navigate('/home')}
              className="flex items-center gap-2 w-full p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all text-xs font-bold border border-white/10"
            >
              <Shield size={14} />
              <span>PAINEL ADMIN</span>
            </button>
          )}

          {user?.email === 'soparonosk37@gmail.com' && (
            <div className="space-y-2">
              <button
                onClick={() => setShowApiInput(!showApiInput)}
                className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all text-xs font-medium"
              >
                <Key size={14} />
                <span>Configurar API Key</span>
              </button>
              
              {showApiInput && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-2 pb-2"
                >
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Cole sua chave aqui..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] focus:outline-none focus:border-white/30 transition-all text-white"
                  />
                </motion.div>
              )}
            </div>
          )}

          {user ? (
            <button
              onClick={signOut}
              className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all text-xs font-medium"
            >
              <LogOut size={14} />
              <span>Sair da Conta</span>
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={signIn}
                className="flex items-center gap-2 w-full p-2 rounded-lg bg-white hover:bg-gray-200 text-black font-bold transition-all text-xs"
              >
                <LogOut size={14} className="rotate-180" />
                <span>ENTRAR COM GOOGLE</span>
              </button>
              <p className="text-[9px] text-gray-500 text-center px-2">
                Problemas no login? <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="text-white hover:underline">Abra em uma nova aba</a>.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
});

export default Sidebar;
