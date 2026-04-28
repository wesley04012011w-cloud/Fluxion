import React, { useState, useEffect, useRef } from 'react';
import { 
  Palette, 
  ChevronLeft,
  Check,
  Moon,
  Cloud,
  Terminal,
  Zap,
  Flame,
  ChevronDown,
  Github,
  Key as KeyIcon,
  Cpu,
  RefreshCw,
  Search,
  FileCode,
  Folder,
  ArrowRight,
  Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser, OperationType, handleFirestoreError, cn } from '../types';
import { fetchRepoContents, fetchFileContent, updateFileContent, GitHubFile } from '../services/githubService';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';

const MODELS = [
  { id: 'auto', name: 'Automático (Fallback)', desc: 'Troca se houver erro ou cota cheia' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Heavy)', desc: 'Melhor raciocínio para scripts complexos' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Estável)', desc: 'Equilíbrio entre velocidade e inteligência' },
  { id: 'gemini-3-flash-preview', name: '3.0 Flash (Veloz)', desc: 'Respostas instantâneas e maior cota' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', desc: 'Modelo de chat eficiente' },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', desc: 'Modelo especializado em raciocínio' }
];

export default function SettingsPage() {
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('github_token') || '');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [isOptimized, setIsOptimized] = useState(() => localStorage.getItem('app_optimized') === 'true');
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [repoPath, setRepoPath] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState('');
  const [repoFiles, setRepoFiles] = useState<GitHubFile[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [scriptsLoading, setScriptsLoading] = useState(true);
  const [exportModal, setExportModal] = useState<{ isOpen: boolean; githubFile: GitHubFile | null }>({
    isOpen: false,
    githubFile: null
  });
  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [savedScripts, setSavedScripts] = useState<{id: string, name: string, content: string}[]>([]);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('github_token', githubToken);
  }, [githubToken]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
    window.dispatchEvent(new Event('storage'));
  }, [apiKey]);

// Removed model effects

  useEffect(() => {
    localStorage.setItem('app_optimized', String(isOptimized));
  }, [isOptimized]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (window.location.hash === '#github') {
      const el = document.getElementById('github');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleTestRepo = async (pathOverride?: string) => {
    if (!repoPath) return;
    setGithubLoading(true);
    setGithubError('');
    try {
      const contents = await fetchRepoContents(repoPath, githubToken, pathOverride !== undefined ? pathOverride : currentPath);
      setRepoFiles(contents);
      if (currentPath === '' && pathOverride === undefined) alert('✅ Repositório conectado!');
    } catch (err: any) {
      setGithubError(err.message);
      setRepoFiles([]);
    } finally {
      setGithubLoading(false);
    }
  };

  const navigateToPath = (newPath: string) => {
    setCurrentPath(newPath);
  };

  useEffect(() => {
    if (repoPath) {
      handleTestRepo();
    }
  }, [currentPath]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

  useEffect(() => {
    setScriptsLoading(true);
    if (!user) {
      setSavedScripts(JSON.parse(localStorage.getItem('saved_scripts_offline') || '[]'));
      setScriptsLoading(false);
      const handleStorage = () => {
        setSavedScripts(JSON.parse(localStorage.getItem('saved_scripts_offline') || '[]'));
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }

    const fetchScripts = async () => {
      try {
        const q = query(
          collection(db, 'scripts'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const scripts = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          name: doc.data().name, 
          content: doc.data().content 
        }));
        setSavedScripts(scripts);
        setScriptsLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'scripts', user);
        setScriptsLoading(false);
      }
    };
    fetchScripts();
  }, [user]);

  const handleLoadFile = async (file: GitHubFile) => {
    if (!repoPath) return;
    setGithubLoading(true);
    try {
      const { content } = await fetchFileContent(repoPath, file.path, githubToken);
      const confirmLoad = confirm(`Deseja importar o script "${file.name}" para seus scripts salvos?`);
      if (confirmLoad) {
        if (user) {
          try {
            await addDoc(collection(db, 'scripts'), {
              userId: user.uid,
              name: file.name,
              content: content,
              createdAt: serverTimestamp()
            });
            alert('✅ Script salvo no nuvem com sucesso!');
          } catch (e: any) {
             handleFirestoreError(e, OperationType.WRITE, 'scripts', user);
             alert('Erro ao salvar no Firestore: ' + (e.message || e));
          }
        } else {
          const newScript = {
            id: Date.now().toString(),
            name: file.name,
            content: content
          };
          const updated = [...savedScripts, newScript];
          localStorage.setItem('saved_scripts_offline', JSON.stringify(updated));
          setSavedScripts(updated);
          window.dispatchEvent(new Event('storage'));
          alert('✅ Script salvo localmente com sucesso!');
        }
      }
    } catch (err: any) {
      alert('Erro ao carregar arquivo: ' + err.message);
    } finally {
      setGithubLoading(false);
    }
  };

  const handleExportClick = (file: GitHubFile) => {
    if (!githubToken) {
      alert('⚠️ Você precisa configurar um Token do GitHub para exportar/atualizar arquivos.');
      return;
    }
    setExportModal({ isOpen: true, githubFile: file });
  };

  const executeExport = async () => {
    if (!exportModal.githubFile || !selectedScriptId || !githubToken || !repoPath) return;
    
    const script = savedScripts.find(s => s.id === selectedScriptId);
    if (!script) return;

    setGithubLoading(true);
    try {
      // First get the latest SHA to avoid conflicts
      const { sha } = await fetchFileContent(repoPath, exportModal.githubFile.path, githubToken);
      
      await updateFileContent(
        repoPath,
        exportModal.githubFile.path,
        script.content,
        sha,
        githubToken,
        `Atualizado via Fluxion App: ${script.name}`
      );

      alert('✅ Arquivo atualizado no GitHub com sucesso!');
      setExportModal({ isOpen: false, githubFile: null });
    } catch (err: any) {
      alert('Erro ao exportar: ' + err.message);
    } finally {
      setGithubLoading(false);
    }
  };

  return (
    <div className="h-screen text-white overflow-y-auto custom-scrollbar font-sans transition-colors duration-500 pb-24 relative">
      {/* Theme Color Background Glow */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-20 transition-all duration-1000 fixed"
        style={{
          background: `radial-gradient(circle at 50% 120%, var(--accent-primary) 0%, transparent 60%)`
        }}
      />

      <div className="max-w-3xl mx-auto p-4 md:p-12 relative z-10">
        <header className="flex items-center gap-4 mb-10">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white ui-border"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Configurações Gerais</h1>
            <p className="text-gray-500 text-xs">Ajuste o motor e a aparência do Fluxion</p>
          </div>
        </header>

        <section className="space-y-6">
          {/* Motor de IA */}
          <div className="p-6 md:p-8 ui-card border border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-purple-500/10 rounded-lg ui-border border-purple-500/20 text-purple-400">
                <Cpu size={20} />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Motor de IA (Gemini)</h2>
            </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block ml-1">
                    Gemini API Key
                  </label>
                  <div className="relative">
                    <KeyIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value.trim())}
                      placeholder="Sua Gemini API Key"
                      className="w-full ui-bg-muted border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:border-purple-500/50 transition-all ui-text-main ui-border"
                    />
                  </div>
                </div>

              <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg ui-border", isOptimized ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-white/5 text-gray-500")}>
                    <RefreshCw size={18} className={isOptimized ? "animate-spin-slow" : ""} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold">Modo de Alta Performance</h3>
                    <p className="text-[9px] text-gray-500">Reduz animações e efeitos pesados para carregamento instantâneo.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOptimized(!isOptimized)}
                  className={cn(
                    "w-12 h-6 rounded-full relative transition-all duration-300",
                    isOptimized ? "bg-green-500" : "bg-gray-800"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full transition-all duration-300",
                    isOptimized ? "right-1 bg-white" : "left-1 bg-gray-400"
                  )} />
                </button>
              </div>
            </div>
          </div>

          {/* GitHub Extension */}
          <div className="p-6 md:p-8 ui-card border border-white/5 bg-white/[0.02]" id="github">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-gray-500/10 rounded-lg ui-border border-gray-500/20 text-gray-300">
                <Github size={20} />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Extensão GitHub (Alpha)</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block ml-1">
                  Carregar Repositório (Dono/Repo)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={repoPath}
                      onChange={(e) => setRepoPath(e.target.value)}
                      placeholder="ex: owner/my-lua-scripts"
                      className="w-full ui-bg-muted border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:border-white/30 transition-all ui-text-main ui-border"
                    />
                  </div>
                  <button 
                    onClick={() => handleTestRepo()}
                    disabled={githubLoading || !repoPath}
                    className="bg-white text-black px-6 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all disabled:opacity-50 flex items-center gap-2 border-transparent"
                  >
                    {githubLoading ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    CONECTAR
                  </button>
                </div>
                {githubError && <p className="mt-2 text-[10px] text-red-500 font-bold">{githubError}</p>}
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block ml-1">
                  Token de Acesso (ghp_...)
                </label>
                <div className="relative">
                  <KeyIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="Opcional para repos públicos"
                    className="w-full ui-bg-muted border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:border-white/30 transition-all ui-text-main ui-border"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                 <p className="text-[10px] text-blue-300 leading-relaxed font-medium">
                   Utilize esta extensão para carregar arquivos `.lua` ou scripts diretamente para o chat do Fluxion. Ao conectar, os arquivos do repositório ficarão disponíveis para referência rápida.
                 </p>
              </div>

              {/* Repo Explorer */}
              {repoFiles.length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-1">
                      Arquivos do Repositório: <span className="text-gray-400">/{currentPath}</span>
                    </label>
                    {currentPath && (
                      <button 
                        onClick={() => {
                          const parts = currentPath.split('/');
                          parts.pop();
                          setCurrentPath(parts.join('/'));
                        }}
                        className="text-[10px] text-purple-400 font-bold hover:underline"
                      >
                        Voltar
                      </button>
                    )}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto ui-bg-muted border border-white/5 rounded-xl divide-y divide-white/5 custom-scrollbar">
                    {repoFiles.map((file) => (
                      <div 
                        key={file.path}
                        className="flex items-center justify-between p-3 hover:bg-white/[0.02] transition-all group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {file.type === 'dir' ? (
                            <Folder size={14} className="text-blue-400 shrink-0" />
                          ) : (
                            <FileCode size={14} className="text-gray-500 shrink-0" />
                          )}
                          <span className="text-xs truncate">{file.name}</span>
                        </div>
                        {file.type === 'dir' ? (
                          <button 
                            onClick={() => navigateToPath(file.path)}
                            className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-all font-bold"
                          >
                            ABRIR
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleExportClick(file)}
                              className="opacity-0 group-hover:opacity-100 text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-2 py-1 rounded transition-all font-bold"
                            >
                              EXPORTAR
                            </button>
                            <button 
                              onClick={() => handleLoadFile(file)}
                              className="opacity-0 group-hover:opacity-100 text-[10px] bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 px-2 py-1 rounded transition-all font-bold"
                            >
                              IMPORTAR
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <footer className="mt-16 text-center border-t border-white/5 pt-10">
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] mb-2 leading-relaxed">
            Fluxion System Dashboard v2.5<br />
            Powered by Deep Reasoning Engine
          </p>
          <div className="flex justify-center gap-4 text-gray-500">
             <Github size={14} className="hover:text-white cursor-pointer transition-colors" />
             <Terminal size={14} className="hover:text-white cursor-pointer transition-colors" />
          </div>
        </footer>
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Export Modal */}
      <AnimatePresence>
        {exportModal.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-2">Exportar para GitHub</h2>
              <p className="text-xs text-gray-500 mb-6">
                Escolha qual o script local você deseja enviar para o arquivo <span className="text-white font-mono">{exportModal.githubFile?.name}</span> no repositório.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                    Selecione o Script Local
                  </label>
                  <select
                    value={selectedScriptId}
                    onChange={(e) => setSelectedScriptId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-blue-500/50 appearance-none text-white overflow-hidden"
                  >
                    <option value="" className="bg-[#0a0a0a]">
                      {scriptsLoading ? 'Carregando scripts...' : 'Selecione um script...'}
                    </option>
                    {savedScripts.map(script => (
                      <option key={script.id} value={script.id} className="bg-[#0a0a0a]">
                        {script.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!scriptsLoading && savedScripts.length === 0 && (
                  <p className="text-[10px] text-yellow-500 italic">Você não possui scripts salvos no {user ? 'nuvem' : 'Fluxion'} para exportar.</p>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setExportModal({ isOpen: false, githubFile: null })}
                    className="flex-1 px-4 py-3 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/5 transition-all"
                  >
                    CANCELAR
                  </button>
                  <button
                    onClick={executeExport}
                    disabled={!selectedScriptId || githubLoading}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 rounded-xl text-xs font-bold transition-all text-white flex items-center justify-center gap-2"
                  >
                    {githubLoading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    SOBRESCREVER
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
