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
  Settings
} from 'lucide-react';
import { Chat, cn } from '../types';
import { User } from 'firebase/auth';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  chats: Chat[];
  currentChatId: string | null;
  setCurrentChatId: (id: string) => void;
  createNewChat: () => void;
  deleteChat: (id: string, e: React.MouseEvent) => void;
  savedScripts: {id: string, name: string, content: string}[];
  deleteScript: (id: string, e: React.MouseEvent) => void;
  user: User | null;
  apiKey: string;
  setApiKey: (key: string) => void;
  signOut: () => void;
}

const Sidebar = React.memo(({
  isSidebarOpen,
  setIsSidebarOpen,
  chats,
  currentChatId,
  setCurrentChatId,
  createNewChat,
  deleteChat,
  savedScripts,
  deleteScript,
  user,
  apiKey,
  setApiKey,
  signOut
}: SidebarProps) => {
  const [showApiInput, setShowApiInput] = React.useState(false);
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
          className="flex items-center gap-2 w-full p-2.5 rounded-lg bg-white hover:bg-gray-200 text-black font-bold transition-all mb-4 shadow-lg shadow-white/5 text-xs"
        >
          <Plus size={16} />
          <span>NOVO SCRIPT</span>
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
            {chats.map((chat) => (
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
            ))}
          </div>

          {/* Scripts Section */}
          <div className="space-y-0.5">
            <div className="px-2 mb-1">
              <label className="text-[8px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode size={8} />
                Scripts Salvos
              </label>
            </div>
            {savedScripts.length === 0 ? (
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

          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all text-xs font-medium"
          >
            <LogOut size={14} />
            <span>Sair da Conta</span>
          </button>
        </div>
      </div>
    </motion.aside>
  );
});

export default Sidebar;
