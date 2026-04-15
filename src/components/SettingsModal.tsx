import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Moon, 
  Sun, 
  Zap, 
  Shield, 
  Users, 
  Key, 
  MessageSquare, 
  Check,
  Monitor,
  Trash2,
  Plus
} from 'lucide-react';
import { AppSettings, UserProfile, cn } from '../types';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  orderBy
} from 'firebase/firestore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  isAdmin: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onUpdateSettings,
  isAdmin 
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'admin'>('general');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    if (isAdmin && activeTab === 'admin') {
      const q = query(collection(db, 'users'), orderBy('lastSeen', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const userList = snapshot.docs.map(doc => doc.data() as UserProfile);
        setUsers(userList);
      });
      return unsubscribe;
    }
  }, [isAdmin, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Monitor size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Configurações</h2>
              <p className="text-xs text-gray-500">Personalize sua experiência no Fluxion</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6 bg-white/5">
          <button 
            onClick={() => setActiveTab('general')}
            className={cn(
              "px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
              activeTab === 'general' ? "border-white text-white" : "border-transparent text-gray-500 hover:text-gray-300"
            )}
          >
            Geral
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={cn(
                "px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
                activeTab === 'admin' ? "border-white text-white" : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              Admin Panel
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {activeTab === 'general' ? (
            <>
              {/* Theme */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Sun size={14} /> Tema Visual
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {(['dark', 'light', 'glass'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => onUpdateSettings({ theme: t })}
                      className={cn(
                        "p-4 rounded-2xl border transition-all text-center space-y-2",
                        settings.theme === t 
                          ? "bg-white/10 border-white/30 text-white" 
                          : "bg-white/5 border-white/5 text-gray-500 hover:border-white/20"
                      )}
                    >
                      <div className="text-xs font-bold capitalize">{t}</div>
                      {settings.theme === t && <Check size={12} className="mx-auto" />}
                    </button>
                  ))}
                </div>
              </section>

              {/* AI Tone */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <MessageSquare size={14} /> Tom da IA
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {(['friendly', 'direct', 'professional'] as const).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => onUpdateSettings({ aiTone: tone })}
                      className={cn(
                        "p-4 rounded-2xl border transition-all text-center space-y-2",
                        settings.aiTone === tone 
                          ? "bg-white/10 border-white/30 text-white" 
                          : "bg-white/5 border-white/5 text-gray-500 hover:border-white/20"
                      )}
                    >
                      <div className="text-xs font-bold capitalize">{tone === 'friendly' ? 'Amigável' : tone === 'direct' ? 'Direto' : 'Profissional'}</div>
                      {settings.aiTone === tone && <Check size={12} className="mx-auto" />}
                    </button>
                  ))}
                </div>
              </section>

              {/* Optimization */}
              <section className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/10 rounded-xl text-yellow-500">
                    <Zap size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Otimizar Aplicativo</h4>
                    <p className="text-[10px] text-gray-500">Remove animações e efeitos para máximo desempenho</p>
                  </div>
                </div>
                <button 
                  onClick={() => onUpdateSettings({ isOptimized: !settings.isOptimized })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    settings.isOptimized ? "bg-white" : "bg-white/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full transition-all",
                    settings.isOptimized ? "right-1 bg-black" : "left-1 bg-gray-500"
                  )} />
                </button>
              </section>
            </>
          ) : (
            <>
              {/* API Keys Management */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Key size={14} /> Gerenciamento de API Keys
                </h3>
                <div className="space-y-2">
                  {settings.apiKeys.map((key, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                      <code className="text-[10px] text-gray-400 truncate max-w-[200px]">
                        {key.slice(0, 10)}...{key.slice(-4)}
                      </code>
                      <button 
                        onClick={() => {
                          const newKeys = settings.apiKeys.filter((_, idx) => idx !== i);
                          onUpdateSettings({ apiKeys: newKeys });
                        }}
                        className="p-1.5 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input 
                      type="password"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="Adicionar nova chave..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-white/30 text-white"
                    />
                    <button 
                      onClick={() => {
                        if (newKey.trim()) {
                          onUpdateSettings({ apiKeys: [...settings.apiKeys, newKey.trim()] });
                          setNewKey('');
                        }
                      }}
                      className="p-2 bg-white text-black rounded-xl hover:bg-gray-200 transition-all"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </section>

              {/* Users Management */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} /> Usuários Conectados
                </h3>
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.uid} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                          {u.photoURL ? <img src={u.photoURL} alt="" /> : u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{u.email}</div>
                          <div className="text-[8px] text-gray-500 uppercase tracking-widest">
                            Visto em: {u.lastSeen?.toDate().toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest",
                        u.role === 'admin' ? "bg-white text-black" : "bg-white/10 text-gray-400"
                      )}>
                        {u.role}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsModal;
