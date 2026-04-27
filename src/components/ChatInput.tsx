import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Send, 
  Image as ImageIcon, 
  X, 
  FileCode, 
  Brain, 
  Search, 
  BookOpen, 
  Info, 
  ChevronDown,
  Blocks,
  Github
} from 'lucide-react';
import { cn } from '../types';
import GithubImportModal from './GithubImportModal';
import { creditService } from '../services/creditService';
import { AppUser } from '../types';

import { ThinkingLevel } from "@google/genai";

interface ChatInputProps {
  onSend: (text: string, images?: string[], thinkingLevel?: ThinkingLevel, isBlockMode?: boolean) => void;
  isGenerating: boolean;
  initialValue?: string;
  savedScripts?: {id: string, name: string, content: string}[];
  isBlockMode: boolean;
  setIsBlockMode: (val: boolean) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  appUser: AppUser | null;
}

const ChatInput = React.memo(({ 
  onSend, 
  isGenerating,
  initialValue = '',
  savedScripts = [],
  isBlockMode,
  setIsBlockMode,
  selectedModel,
  onModelChange,
  appUser
}: ChatInputProps) => {
  const [input, setInput] = useState(initialValue);
  const [images, setImages] = useState<string[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [filteredScripts, setFilteredScripts] = useState<{id: string, name: string, content: string}[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<{id: string, name: string, desc: string}[]>([]);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  
  const systemCommands = [
    { id: 'cmd1', name: '!block', desc: 'Divide o script em blocos (ex: !block 4)' },
    { id: 'cmd2', name: '!next', desc: 'Gera o próximo bloco' },
    { id: 'cmd8', name: '!reload', desc: 'Audita, corrige e reinicia blocos' },
    { id: 'cmd3', name: '/start', desc: 'Inicia um novo script do zero' },
    { id: 'cmd4', name: '/next', desc: 'Continua a geração normal' },
    { id: 'cmd5', name: '/repeat', desc: 'Repete o último bloco' },
    { id: 'cmd6', name: '/stop', desc: 'Para a geração imediatamente' },
    { id: 'cmd7', name: '/scripts', desc: 'Gera script baseado em sistema' },
  ];
  
  // Close model menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const models = [
    {
      group: 'Gemini',
      options: [
        { id: 'auto', name: 'Automático (Fallback)' },
        { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite (Free)' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Estável)' },
        { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Heavy)' },
        { id: 'gemini-3-flash-preview', name: '3.0 Flash (Veloz)' },
      ]
    },
    {
      group: 'DeepSeek',
      options: [
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat (V3)' },
        { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek Chat (Free)' },
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
        { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)' },
      ]
    },
    {
      group: 'OpenRouter',
      options: [
        { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
        { id: 'openai/o3-mini', name: 'o3-mini (OpenRouter)' },
        { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B (Free)' },
      ]
    }
  ];

  useEffect(() => {
    if (initialValue) setInput(initialValue);
  }, [initialValue]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 10) {
      alert('Máximo de 10 imagens permitido.');
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_DIM = 800;
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setImages(prev => [...prev, compressedBase64]);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
    setIsMenuOpen(false);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setInput(prev => prev + `\n\n--- Arquivo: ${file.name} ---\n${content}\n--- Fim do Arquivo ---\n`);
      };
      reader.readAsText(file);
    });
    setIsMenuOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    const words = value.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('!')) {
      const queryText = lastWord.slice(1).toLowerCase();
      const filtered = systemCommands.filter(c => 
        c.name.toLowerCase().includes(queryText) || 
        c.desc.toLowerCase().includes(queryText)
      );
      setFilteredCommands(filtered);
      setShowCommandMenu(filtered.length > 0);
      setShowSlashMenu(false);
    } else if (lastWord.startsWith('/')) {
      const queryText = lastWord.slice(1).toLowerCase();
      const filtered = savedScripts.filter(s => s.name.toLowerCase().includes(queryText));
      setFilteredScripts(filtered);
      setShowSlashMenu(filtered.length > 0);
      setShowCommandMenu(false);
    } else {
      setShowSlashMenu(false);
      setShowCommandMenu(false);
    }
  };

  const insertCommand = (cmd: string) => {
    const words = input.split(/\s/);
    words.pop(); // Remove the !command
    const newValue = words.join(' ') + (words.length > 0 ? ' ' : '') + cmd + ' ';
    setInput(newValue);
    setShowCommandMenu(false);
  };

  const insertScript = (script: {name: string, content: string}) => {
    const words = input.split(/\s/);
    words.pop(); // Remove the /command
    const newValue = words.join(' ') + (words.length > 0 ? ' ' : '') + `\n\n--- Script: ${script.name} ---\n${script.content}\n--- Fim do Script ---\n`;
    setInput(newValue);
    setShowSlashMenu(false);
  };

  const handleGithubImport = (name: string, content: string) => {
    setInput(prev => prev + (prev ? '\n\n' : '') + `--- GitHub: ${name} ---\n${content}\n--- Fim do Script ---\n`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && images.length === 0) || isGenerating) return;
    
    onSend(input, images, ThinkingLevel.HIGH, isBlockMode);
    setInput('');
    setImages([]);
  };

  return (
    <div className="p-3 md:p-4 bg-transparent relative z-10">
      <form 
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto relative group"
      >
        {images.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 p-1.5 ui-bg-muted backdrop-blur-md rounded-lg border border-white/10">
            {images.map((img, i) => (
            <div key={`preview-${i}`} className="relative group/img">
                <img src={img} className="w-12 h-12 object-cover rounded border border-white/20" alt="Preview" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative flex items-end gap-1.5">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2.5 ui-bg-muted border border-white/10 rounded-xl ui-text-muted hover:text-[var(--accent-primary)] transition-all ui-border"
            >
              <Plus size={16} />
            </button>
            
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: -5 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute bottom-full left-0 mb-2 w-48 ui-bg-secondary/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 ui-border"
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold ui-text-muted hover:bg-white/10 hover:text-white transition-all border-b border-white/5"
                  >
                    <ImageIcon size={14} />
                    UPLOAD IMAGENS
                  </button>
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold ui-text-muted hover:bg-white/10 hover:text-white transition-all border-b border-white/5"
                  >
                    <FileCode size={14} />
                    UPLOAD ARQUIVOS
                  </button>
                  <button
                    type="button"
                    onClick={() => setGithubModalOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold ui-text-muted hover:bg-white/10 hover:text-white transition-all"
                  >
                    <Github size={14} />
                    IMPORTAR GITHUB
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 relative">
            {/* Block Mode Selector */}
            <div className="absolute left-0 top-[-44px] z-20 flex gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsBlockMode(!isBlockMode)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 ui-bg-muted backdrop-blur-xl border rounded-lg text-[9px] font-bold transition-all uppercase tracking-wider shadow-xl ui-border",
                  isBlockMode ? "text-[var(--accent-primary)] border-[var(--accent-primary)]/30" : "border-white/10 ui-text-muted hover:text-white"
                )}
              >
                <Blocks size={10} />
                {isBlockMode ? 'Modo Blocos: ON' : 'Modo Blocos: OFF'}
              </button>
            </div>

            <AnimatePresence>
              {showCommandMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: -5 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full left-0 w-full mb-2 ui-bg-secondary/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar ui-border"
                >
                  <div className="px-3 py-2 bg-black/40 border-b border-white/5 text-[8px] font-bold ui-text-muted uppercase tracking-widest">
                    Comandos do Sistema
                  </div>
                  {filteredCommands.map(cmd => (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={() => insertCommand(cmd.name)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-black/60 transition-all border-b border-white/5 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold ui-text-main">{cmd.name}</div>
                        <div className="text-[9px] ui-text-muted truncate">{cmd.desc}</div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showSlashMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: -5 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full left-0 w-full mb-2 ui-bg-secondary/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar ui-border"
                >
                  <div className="px-3 py-2 bg-black/40 border-b border-white/5 text-[8px] font-bold ui-text-muted uppercase tracking-widest">
                    Scripts Salvos
                  </div>
                  {filteredScripts.map(script => (
                    <button
                      key={script.id}
                      type="button"
                      onClick={() => insertScript(script)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-medium ui-text-muted hover:bg-black/60 hover:text-white transition-all border-b border-white/5 last:border-0"
                    >
                      <FileCode size={12} className="opacity-50" />
                      <span className="truncate">{script.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Descreva seu script... (use / para scripts salvos)"
              rows={1}
              className="w-full ui-bg-muted backdrop-blur-md border border-white/10 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:border-[var(--accent-primary)] transition-all resize-none custom-scrollbar text-xs md:text-sm ui-text-main ui-border"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            type="submit"
            disabled={(!input.trim() && images.length === 0) || isGenerating}
            className="absolute right-2 bottom-2 p-2 bg-[var(--accent-primary)] text-[var(--bg-primary)] rounded-lg hover:opacity-90 disabled:opacity-30 transition-all shadow-lg shadow-black/20 ui-border !border-transparent"
          >
            <Send size={16} />
          </button>
        </div>
      </form>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        accept="image/*" 
        multiple 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={docInputRef} 
        onChange={handleFileUpload} 
        accept=".lua,.txt,.json,.js,.ts" 
        multiple 
        className="hidden" 
      />

      <GithubImportModal 
        isOpen={githubModalOpen}
        onClose={() => setGithubModalOpen(false)}
        onImport={handleGithubImport}
      />
    </div>
  );
});

export default ChatInput;
