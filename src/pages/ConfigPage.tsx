import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Key, 
  Shield, 
  Activity, 
  Plus, 
  Trash2, 
  Save,
  ChevronLeft,
  Circle
} from 'lucide-react';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  getDoc,
  serverTimestamp,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { AppUser, AppConfig, OperationType, handleFirestoreError, cn } from '../types';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const ADMIN_EMAIL = 'soparonosk37@gmail.com';

export default function ConfigPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [moderationLogs, setModerationLogs] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/');
        return;
      }

      if (user.email !== ADMIN_EMAIL) {
        navigate('/');
        return;
      }
      
      setAuthChecked(true);
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!authChecked) return;

    // Listen to active users
    const usersQuery = query(collection(db, 'users'), orderBy('lastActive', 'desc'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const userList = snapshot.docs.map(doc => doc.data() as AppUser);
      setUsers(userList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // Listen to config
    const configDoc = doc(db, 'config', 'main');
    const unsubscribeConfig = onSnapshot(configDoc, (snapshot) => {
      if (snapshot.exists()) {
        setConfig({ id: snapshot.id, ...snapshot.data() } as AppConfig);
      } else {
        setDoc(configDoc, {
          geminiApiKeys: [],
          updatedAt: serverTimestamp()
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/main');
    });

    // Listen to error logs
    const logsQuery = query(collection(db, 'error_logs'), orderBy('createdAt', 'desc'));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setErrorLogs(logsList);
    }, (error) => {
      console.warn("Could not fetch error logs:", error);
    });

    // Listen to moderation logs
    const modQuery = query(collection(db, 'moderation_reports'), orderBy('createdAt', 'desc'));
    const unsubscribeMods = onSnapshot(modQuery, (snapshot) => {
      const modLogsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setModerationLogs(modLogsList);
    }, (error) => {
      console.warn("Could not fetch moderation logs:", error);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeConfig();
      unsubscribeLogs();
      unsubscribeMods();
    };
  }, [authChecked]);

  const addApiKey = async () => {
    if (!newKey.trim() || !config) return;
    try {
      const updatedKeys = [...(config.geminiApiKeys || []), newKey.trim()];
      await updateDoc(doc(db, 'config', 'main'), {
        geminiApiKeys: updatedKeys,
        updatedAt: serverTimestamp()
      });
      setNewKey('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/main');
    }
  };

  const removeApiKey = async (index: number) => {
    if (!config) return;
    try {
      const updatedKeys = config.geminiApiKeys.filter((_, i) => i !== index);
      await updateDoc(doc(db, 'config', 'main'), {
        geminiApiKeys: updatedKeys,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/main');
    }
  };

  const selectApiKey = async (index: number) => {
    if (!config) return;
    try {
      // Alternar seleção: se clicar na já selecionada, desativa a seleção manual (volta para rodízio)
      const newIndex = config.selectedApiKeyIndex === index ? -1 : index;
      await updateDoc(doc(db, 'config', 'main'), {
        selectedApiKeyIndex: newIndex,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/main');
    }
  };

  const toggleAutoSelection = async () => {
    if (!config) return;
    try {
      const newAutoMode = config.autoApiKeySelection === false; // Toggle
      await updateDoc(doc(db, 'config', 'main'), {
        autoApiKeySelection: newAutoMode,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/main');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#050505] text-white p-4 md:p-8 font-sans custom-scrollbar pb-20">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
                <Shield className="text-white" />
                PAINEL DE CONTROLE
              </h1>
              <p className="text-gray-500 text-sm">Administração do sistema Fluxion</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* API Keys Management */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Key size={20} />
                </div>
                <h2 className="text-xl font-bold">Gerenciar API Keys</h2>
              </div>
              
              <div className="flex items-center gap-3 bg-black/40 p-1.5 px-3 rounded-2xl border border-white/5">
                <span className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors", config?.autoApiKeySelection === false ? "text-white" : "text-gray-600")}>Manual</span>
                <button 
                  onClick={toggleAutoSelection}
                  className={cn(
                    "w-10 h-5 rounded-full relative transition-all duration-300",
                    config?.autoApiKeySelection !== false ? "bg-white" : "bg-gray-800"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-3 h-3 rounded-full transition-all duration-300",
                    config?.autoApiKeySelection !== false ? "right-1 bg-black" : "left-1 bg-white"
                  )} />
                </button>
                <span className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors", config?.autoApiKeySelection !== false ? "text-white" : "text-gray-600")}>Auto</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="password" 
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Nova Gemini API Key..."
                  className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all"
                />
                <button 
                  onClick={addApiKey}
                  className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center gap-2"
                >
                  <Plus size={18} />
                  ADD
                </button>
              </div>

              <div className="space-y-2 mt-6">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
                  Chaves Ativas
                  <span className="text-[9px] text-gray-600 lowercase font-normal italic">clique para isolar uma chave</span>
                </label>
                {config?.geminiApiKeys.length === 0 ? (
                  <p className="text-gray-600 text-sm italic py-4">Nenhuma chave configurada.</p>
                ) : (
                  config?.geminiApiKeys.map((key, index) => (
                    <div 
                      key={`key-${index}`} 
                      className={cn(
                        "flex items-center justify-between bg-black/40 border p-3 rounded-xl group transition-all cursor-pointer",
                        config.selectedApiKeyIndex === index ? "border-green-500/50 bg-green-500/5 shadow-[0_0_15px_rgba(34,197,94,0.05)]" : "border-white/5 hover:border-white/10"
                      )}
                      onClick={() => selectApiKey(index)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          config.selectedApiKeyIndex === index ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-gray-700"
                        )} />
                        <code className={cn(
                          "text-xs font-mono transition-colors",
                          config.selectedApiKeyIndex === index ? "text-white" : "text-gray-400"
                        )}>
                          {key.substring(0, 8)}••••••••••••{key.substring(key.length - 4)}
                          {config.selectedApiKeyIndex === index && <span className="ml-2 text-[9px] text-green-500 font-black uppercase tracking-tighter">Ativa</span>}
                        </code>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeApiKey(index);
                        }}
                        className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.section>

          {/* User Management */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Users size={20} />
                </div>
                <h2 className="text-xl font-bold">Usuários Ativos</h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                <Activity size={12} className="text-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-green-500 uppercase">{users.length} ONLINE</span>
              </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {users.length === 0 ? (
                <p className="text-gray-600 text-sm italic py-4">Nenhum usuário ativo no momento.</p>
              ) : (
                users.map((user) => (
                  <div key={user.uid} className="flex items-center gap-4 bg-black/40 border border-white/5 p-4 rounded-2xl">
                    <div className="relative">
                      <img 
                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=random`} 
                        alt={user.displayName || ''} 
                        className="w-10 h-10 rounded-full border border-white/10"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-black rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold truncate">{user.displayName || 'Usuário Anônimo'}</h3>
                      <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-600 uppercase">Visto por último</p>
                      <p className="text-[10px] text-gray-400">
                        {user.lastActive?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.section>
        </div>

        {/* Error Logs Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl mt-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold">Relatórios de Erros (Status da API)</h2>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
              <span className="text-[10px] font-bold text-red-500 uppercase">{errorLogs.length} RELATÓRIOS</span>
            </div>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {errorLogs.length === 0 ? (
              <p className="text-gray-600 text-sm italic py-4">Nenhum erro registrado. O sistema está estável 🚀</p>
            ) : (
              errorLogs.map((log) => (
                <div key={log.id} className="flex flex-col bg-black/40 border border-white/5 p-4 rounded-2xl gap-2 relative">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-bold text-red-400">Falha Interna {log.resolved ? '(Resolvido)' : ''}</h3>
                      <p className="text-[10px] text-gray-400 mt-1">Usuário: {log.userEmail || 'Anônimo'} ({log.userId})</p>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {log.createdAt?.toDate().toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl mt-2 overflow-x-auto">
                    <code className="text-xs text-red-300 font-mono whitespace-pre-wrap">
                      {log.error}
                    </code>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-gray-500">ID do Chat Afetado: {log.chatId}</span>
                    <button 
                      onClick={() => {
                        // Deletar o log
                        const docRef = doc(db, 'error_logs', log.id);
                        import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(docRef));
                      }}
                      className="text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-all"
                    >
                      LIMPAR / DELETAR
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.section>

        {/* Moderation Logs Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl mt-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Shield size={20} className="text-purple-500" />
              </div>
              <h2 className="text-xl font-bold">Alertas de Moderação (Atividade Suspeita)</h2>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">
              <span className="text-[10px] font-bold text-purple-500 uppercase">{moderationLogs.length} CASOS</span>
            </div>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {moderationLogs.length === 0 ? (
              <p className="text-gray-600 text-sm italic py-4">Nenhuma mensagem suspensa ou perigosa encontrada.</p>
            ) : (
              moderationLogs.map((modLog) => (
                <div key={modLog.id} className="flex flex-col bg-black/40 border border-white/5 p-4 rounded-2xl gap-2 relative">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-bold text-purple-400">Auditoria Automática</h3>
                      <p className="text-[10px] text-gray-400 mt-1">Chat associado: {modLog.chatId}</p>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {modLog.createdAt?.toDate().toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-3 rounded-xl mt-2 overflow-x-auto">
                    <p className="text-xs text-white mb-2 font-bold opacity-50">Log do Modelo:</p>
                    <code className="text-xs text-purple-300 font-mono whitespace-pre-wrap leading-relaxed block">
                      {modLog.report}
                    </code>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-gray-500">
                      Caso gerado após mensagem enviada pelo usuário na UI.
                    </span>
                    <button 
                      onClick={() => {
                        // Deletar o log de moderação
                        const docRef = doc(db, 'moderation_reports', modLog.id);
                        import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(docRef));
                      }}
                      className="text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-all"
                    >
                      ARQUIVAR CASO
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.section>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
