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
  CodeXml
} from 'lucide-react';
import { cn } from '../types';
import CodeCombinerModal from './CodeCombinerModal';

import { ThinkingLevel } from "@google/genai";

interface ChatInputProps {
  onSend: (text: string, images?: string[], thinkingLevel?: ThinkingLevel, isBlockMode?: boolean) => void;
  isGenerating: boolean;
  initialValue?: string;
  savedScripts?: {id: string, name: string, content: string}[];
  isBlockMode: boolean;
  setIsBlockMode: (val: boolean) => void;
}

const ChatInput = React.memo(({ 
  onSend, 
  isGenerating,
  initialValue = '',
  savedScripts = [],
  isBlockMode,
  setIsBlockMode
}: ChatInputProps) => {
  const [input, setInput] = useState(initialValue);
  const [images, setImages] = useState<string[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [combinerModalOpen, setCombinerModalOpen] = useState(false);
  const [combinerBlocks, setCombinerBlocks] = useState(2);
  const [aiMode, setAiMode] = useState<{id: ThinkingLevel, label: string, icon: any}>({
    id: ThinkingLevel.HIGH,
    label: 'Avançado (High)',
    icon: Brain
  });
  const [filteredScripts, setFilteredScripts] = useState<{id: string, name: string, content: string}[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<{id: string, name: string, desc: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  const aiModes = [
    { id: ThinkingLevel.LOW, label: 'Rápido (Off)', icon: Info },
    { id: ThinkingLevel.LOW, label: 'Básico (Low)', icon: BookOpen },
    { id: ThinkingLevel.MEDIUM, label: 'Médio (Medium)', icon: Search },
    { id: ThinkingLevel.HIGH, label: 'Avançado (High)', icon: Brain },
  ];

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setShowModeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && images.length === 0) || isGenerating) return;
    
    const blockMatch = input.match(/!block\s+(\d+)/i);
    if (blockMatch) {
      setCombinerBlocks(parseInt(blockMatch[1]));
    }

    onSend(input, images, aiMode.id, isBlockMode);
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
          <div className="flex flex-wrap gap-1.5 mb-2 p-1.5 bg-white/5 backdrop-blur-md rounded-lg border border-white/10">
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
              className="p-2.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all"
            >
              <Plus size={16} />
            </button>
            
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: -5 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute bottom-full left-0 mb-2 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50"
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold text-gray-300 hover:bg-white/10 hover:text-white transition-all border-b border-white/5"
                  >
                    <ImageIcon size={14} />
                    UPLOAD IMAGENS
                  </button>
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold text-gray-300 hover:bg-white/10 hover:text-white transition-all"
                  >
                    <FileCode size={14} />
                    UPLOAD ARQUIVOS
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 relative">
            {/* AI Mode Selector */}
            <div className="absolute left-3 top-[-32px] z-20 flex gap-2" ref={modeMenuRef}>
              <button
                type="button"
                onClick={() => setCombinerModalOpen(true)}
                className="flex items-center gap-1.5 px-2 py-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                title="Combinador de Blocos"
              >
                <CodeXml size={10} />
              </button>

              <button
                type="button"
                onClick={() => setShowModeMenu(!showModeMenu)}
                className="flex items-center gap-1.5 px-2 py-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg text-[9px] font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-all uppercase tracking-wider"
              >
                <aiMode.icon size={10} className="text-white/70" />
                {aiMode.label}
                <ChevronDown size={10} className={cn("transition-transform", showModeMenu && "rotate-180")} />
              </button>

              <button
                type="button"
                onClick={() => setIsBlockMode(!isBlockMode)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg text-[9px] font-bold transition-all uppercase tracking-wider",
                  isBlockMode ? "text-blue-400 border-blue-400/30" : "text-gray-400 hover:text-white"
                )}
              >
                <Blocks size={10} />
                {isBlockMode ? 'Modo Blocos: ON' : 'Modo Blocos: OFF'}
              </button>

              <AnimatePresence>
                {showModeMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: -5 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute bottom-full left-0 mb-2 w-48 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl"
                  >
                    {aiModes.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          setAiMode(mode);
                          setShowModeMenu(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold transition-all border-b border-white/5 last:border-0",
                          aiMode.id === mode.id ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <mode.icon size={12} />
                        {mode.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {showCommandMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: -5 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full left-0 w-full mb-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar"
                >
                  <div className="px-3 py-2 bg-white/5 border-b border-white/5 text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                    Comandos do Sistema
                  </div>
                  {filteredCommands.map(cmd => (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={() => insertCommand(cmd.name)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/10 transition-all border-b border-white/5 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-white">{cmd.name}</div>
                        <div className="text-[9px] text-gray-400 truncate">{cmd.desc}</div>
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
                  className="absolute bottom-full left-0 w-full mb-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar"
                >
                  <div className="px-3 py-2 bg-white/5 border-b border-white/5 text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                    Scripts Salvos
                  </div>
                  {filteredScripts.map(script => (
                    <button
                      key={script.id}
                      type="button"
                      onClick={() => insertScript(script)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all border-b border-white/5 last:border-0"
                    >
                      <FileCode size={12} className="text-white/50" />
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
              className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:border-white/30 transition-all resize-none custom-scrollbar text-xs md:text-sm"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            type="submit"
            disabled={(!input.trim() && images.length === 0) || isGenerating}
            className="absolute right-2 bottom-2 p-2 bg-white text-black rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-lg shadow-white/10"
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

      <CodeCombinerModal 
        isOpen={combinerModalOpen}
        onClose={() => setCombinerModalOpen(false)}
        initialBlocks={combinerBlocks}
      />
    </div>
  );
});

export default ChatInput;
