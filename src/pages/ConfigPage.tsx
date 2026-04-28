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
  Circle,
  AlertTriangle,
  RefreshCw
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
  getDocs,
  limit,
  serverTimestamp,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { AppUser, AppConfig, OperationType, handleFirestoreError, cn } from '../types';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const ADMIN_EMAILS = ['wesley04012011w@gmail.com', 'soparonosk37@gmail.com'];

export default function ConfigPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSavingGroq, setIsSavingGroq] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/');
        return;
      }

      if (!ADMIN_EMAILS.includes(user.email || '')) {
        navigate('/');
        return;
      }
      
      setAuthChecked(true);
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!authChecked) return;

    const fetchData = async () => {
      try {
        // Fetch active users once
        const usersQuery = query(collection(db, 'users'), orderBy('lastActive', 'desc'), limit(50));
        const usersSnap = await getDocs(usersQuery);
        setUsers(usersSnap.docs.map(doc => doc.data() as AppUser));

        // Fetch config once
        const configDoc = doc(db, 'config', 'main');
        const configSnap = await getDoc(configDoc);
        if (configSnap.exists()) {
          const data = configSnap.data() as AppConfig;
          setConfig({ id: configSnap.id, ...data } as AppConfig);
        } else {
          setDoc(configDoc, {
            geminiApiKeys: [],
            updatedAt: serverTimestamp()
          }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'config/main', auth.currentUser));
        }
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'config/main or users', auth.currentUser);
        setLoading(false);
      }
    };
    fetchData();
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
      handleFirestoreError(error, OperationType.UPDATE, 'config/main', auth.currentUser);
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
      handleFirestoreError(error, OperationType.UPDATE, 'config/main', auth.currentUser);
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
      handleFirestoreError(error, OperationType.UPDATE, 'config/main', auth.currentUser);
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
      handleFirestoreError(error, OperationType.UPDATE, 'config/main', auth.currentUser);
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
        </div>
      </div>
    </div>
  );
}
