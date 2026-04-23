import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  FileCode, 
  ChevronLeft,
  Key,
  LogOut,
  Settings,
  Shield,
  Zap,
  Github,
  ChevronDown,
  Lock
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
  createConversationChat?: () => void;
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
  isOptimized?: boolean;
  setIsOptimized?: (optimized: boolean) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

const Sidebar = React.memo(({
  isSidebarOpen,
  setIsSidebarOpen,
  chats,
  currentChatId,
  setCurrentChatId,
  createNewChat,
  createHeavyChat,
  createConversationChat,
  deleteChat,
  savedScripts,
  deleteScript,
  user,
  apiKey,
  setApiKey,
  signOut,
  signIn,
  deferredPrompt,
  setDeferredPrompt,
  isOptimized,
  setIsOptimized,
  selectedModel,
  setSelectedModel
}: SidebarProps) => {
  const navigate = useNavigate();
  const isAdmin = user?.email === 'wesley04012011w@gmail.com';
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

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
        "fixed lg:relative inset-y-0 left-0 ui-bg-secondary backdrop-blur-xl border-r border-white/10 flex flex-col z-50 overflow-hidden ui-border !border-y-0 !border-l-0 !rounded-none transition-colors duration-500",
        !isSidebarOpen && "lg:w-0"
      )}
    >
      <div className="p-3 flex flex-col h-full w-[240px]">
        <div className="flex items-center justify-between mb-4 lg:hidden">
          <h2 className="font-bold ui-text-main text-sm text-[var(--accent-primary)]">MENU PRINCIPAL</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 hover:bg-white/5 rounded-lg ui-border">
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="relative mb-4">
          <button
            onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
            className="flex items-center justify-between w-full p-2.5 rounded-lg bg-[var(--accent-primary)] hover:opacity-90 text-[var(--bg-primary)] font-bold transition-all shadow-lg shadow-white/5 text-xs ui-border !border-transparent"
          >
            <div className="flex items-center gap-2">
              <Plus size={16} />
              <span>SELECIONAR MODO</span>
            </div>
            <ChevronDown size={14} className={cn("transition-transform duration-300", isModeDropdownOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {isModeDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute top-full left-0 w-full mt-1 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-[60] p-1 overflow-hidden"
              >
                <button
                  onClick={() => {
                    createNewChat();
                    setIsModeDropdownOpen(false);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className="flex items-center gap-2 w-full p-2.5 rounded-lg hover:bg-white/5 text-white transition-all text-left text-xs group"
                >
                  <div className="p-1.5 rounded bg-white/5 group-hover:bg-[var(--accent-primary)] group-hover:text-black transition-all">
                    <Plus size={14} />
                  </div>
                  <div>
                    <div className="font-bold">Normal</div>
                    <div className="text-[10px] text-gray-500 font-medium">Chat padrão de codificação</div>
                  </div>
                </button>

                <div className="h-px bg-white/5 my-1" />

                <button
                  onClick={() => {
                    createHeavyChat?.();
                    setIsModeDropdownOpen(false);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className="flex items-center gap-2 w-full p-2.5 rounded-lg hover:bg-white/5 text-white transition-all text-left text-xs group"
                >
                  <div className="p-1.5 rounded bg-white/5 group-hover:bg-[var(--accent-primary)] group-hover:text-black transition-all">
                    <Zap size={14} />
                  </div>
                  <div>
                    <div className="font-bold">Heavy</div>
                    <div className="text-[10px] text-gray-500 font-medium">Processamento de scripts longos</div>
                  </div>
                </button>

                <div className="h-px bg-white/5 my-1" />

                <button
                  onClick={() => {
                    createConversationChat?.();
                    setIsModeDropdownOpen(false);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className="flex items-center gap-2 w-full p-2.5 rounded-lg hover:bg-white/5 text-white transition-all text-left text-xs group"
                >
                  <div className="p-1.5 rounded bg-white/5 group-hover:bg-[var(--accent-primary)] group-hover:text-black transition-all">
                    <MessageSquare size={14} />
                  </div>
                  <div>
                    <div className="font-bold">Modo Chat</div>
                    <div className="text-[10px] text-gray-500 font-medium">Conversa casual e resenha</div>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
                    "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ui-border !border-transparent",
                    currentChatId === chat.id ? "bg-white/10 text-white !border-[var(--border-ui)]" : "hover:bg-white/5 text-gray-400"
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
                  className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-all ui-border !border-transparent"
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

        {/* Bottom Section: Shortcuts */}
        <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 w-full p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all text-xs font-bold border border-blue-500/20 mb-2 shadow-lg shadow-black/20 ui-border"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              <span>INSTALAR APP</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => navigate('/home')}
              className="flex items-center gap-2 w-full p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all text-xs font-bold border border-white/10 ui-border"
            >
              <Shield size={14} />
              <span>PAINEL ADMIN</span>
            </button>
          )}

          <button
            onClick={() => navigate('/config')}
            className="flex items-center gap-2 w-full p-2 rounded-lg ui-bg-muted hover:bg-white/10 ui-text-muted border border-transparent transition-all text-xs font-bold ui-border"
          >
            <Settings size={14} />
            <span>CONFIGURAÇÕES</span>
          </button>

          <button
            onClick={() => navigate('/config#github')}
            className="flex items-center gap-2 w-full p-2 rounded-lg ui-bg-muted hover:bg-white/10 text-gray-400 border border-transparent transition-all text-xs font-bold ui-border"
          >
            <Github size={14} />
            <span>GITHUB LOADER</span>
          </button>

          {user ? (
            <button
              onClick={signOut}
              className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all text-xs font-medium ui-border !border-transparent"
            >
              <LogOut size={14} />
              <span>Sair da Conta</span>
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={signIn}
                className="flex items-center gap-2 w-full p-2 rounded-lg bg-white hover:bg-gray-200 text-black font-bold transition-all text-xs ui-border !border-transparent"
              >
                <LogOut size={14} className="rotate-180" />
                <span>ENTRAR COM GOOGLE</span>
              </button>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 space-y-1.5">
                <p className="text-[9px] text-gray-400 leading-tight">
                  <span className="text-white font-bold">Problemas no login?</span><br />
                  Se após logar você voltar para cá e continuar "deslogado", abra em uma nova aba.
                </p>
                <a 
                  href={window.location.href} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="block w-full text-center py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-[9px] font-bold transition-all border border-white/10"
                >
                  ABRIR EM NOVA ABA
                </a>
              </div>
            </div>
          )}

        </div>
      </div>
    </motion.aside>
  );
});

export default Sidebar;
