import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Github, X, Search, FileCode, Check, Loader2, Link as LinkIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { fetchRepoContents, fetchFileContent, GitHubFile } from '../services/githubService';
import { cn } from '../types';

interface GithubImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (name: string, content: string) => void;
}

export default function GithubImportModal({ isOpen, onClose, onImport }: GithubImportModalProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contents, setContents] = useState<GitHubFile[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [repoInfo, setRepoInfo] = useState<{owner: string, repo: string} | null>(null);

  const fetchContents = async (repoPath: string, path: string = '') => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('github_token') || undefined;
    try {
      const data = await fetchRepoContents(repoPath, token, path);
      setContents(data);
      setCurrentPath(path);
      const [owner, repo] = repoPath.replace('https://github.com/', '').replace('.git', '').split('/');
      setRepoInfo({ owner, repo });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar conteúdo do repositório');
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!repoUrl) return;
    fetchContents(repoUrl, '');
  };

  const handleFileClick = async (item: GitHubFile) => {
    if (item.type === 'dir') {
      if (repoUrl) {
        fetchContents(repoUrl, item.path);
      }
    } else {
      setLoading(true);
      const token = localStorage.getItem('github_token') || undefined;
      try {
        const { content } = await fetchFileContent(repoUrl, item.path, token);
        onImport(item.name, content);
        onClose();
      } catch (err) {
        setError('Erro ao baixar conteúdo do arquivo');
      } finally {
        setLoading(false);
      }
    }
  };

  const goBack = () => {
    if (!currentPath || !repoUrl) return;
    const parts = currentPath.split('/');
    parts.pop();
    fetchContents(repoUrl, parts.join('/'));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-md transition-all duration-300">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-xl ui-bg-secondary border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden ui-border"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg ui-border">
                  <Github size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold ui-text-main">GitHub Import</h2>
                  <p className="text-[10px] ui-text-muted">Carregue scripts diretamente de repositórios</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 ui-text-muted hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="owner/repo ou URL do GitHub"
                    className="w-full ui-bg-muted border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-xs focus:outline-none focus:border-[var(--accent-primary)] transition-all ui-text-main ui-border"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={loading || !repoUrl}
                  className="px-4 bg-[var(--accent-primary)] text-[var(--bg-primary)] rounded-xl font-bold text-xs hover:opacity-90 transition-all disabled:opacity-30 ui-border"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400 font-medium">
                  {error}
                </div>
              )}

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                {currentPath && (
                  <button
                    onClick={goBack}
                    className="w-full p-2 text-left text-[10px] ui-text-muted hover:ui-text-main flex items-center gap-2"
                  >
                    .. (Voltar)
                  </button>
                )}
                
                {contents.length > 0 ? (
                  contents.map((item) => (
                    <button
                      key={item.sha}
                      onClick={() => handleFileClick(item)}
                      className="w-full flex items-center justify-between p-3 ui-bg-muted hover:bg-white/5 rounded-xl transition-all group ui-border !border-transparent hover:!border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-1.5 rounded-lg",
                          item.type === 'dir' ? "bg-blue-500/10 text-blue-400" : "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                        )}>
                          {item.type === 'dir' ? <Github size={14} /> : <FileCode size={14} />}
                        </div>
                        <div className="text-left">
                          <div className="text-[11px] font-bold ui-text-main truncate max-w-[200px]">{item.name}</div>
                          <div className="text-[9px] ui-text-muted">{item.type === 'dir' ? 'Folder' : `${(item.size / 1024).toFixed(1)} KB`}</div>
                        </div>
                      </div>
                      <ChevronDown size={14} className={cn("text-gray-600 group-hover:text-white transition-all", item.type === 'dir' ? "-rotate-90" : "opacity-0")} />
                    </button>
                  ))
                ) : !loading && repoInfo && (
                  <div className="text-center py-10">
                    <p className="text-xs ui-text-muted font-bold uppercase tracking-widest">Nenhum arquivo encontrado</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-black/20">
              <p className="text-[9px] ui-text-muted leading-tight">
                Dica: Você pode colar o link direto de um arquivo no GitHub. 
                Para repositórios privados, configure seu Token nas Configurações.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
