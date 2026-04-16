import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileCode, AlertTriangle, Save } from 'lucide-react';
import { cn } from '../types';

interface SaveScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, overwrite: boolean) => void;
  existingScripts: { name: string }[];
  defaultName?: string;
}

export default function SaveScriptModal({ 
  isOpen, 
  onClose, 
  onSave, 
  existingScripts,
  defaultName = ''
}: SaveScriptModalProps) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState('');
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName || 'RobloxScript');
      setError('');
      setShowOverwriteWarning(false);
    }
  }, [isOpen, defaultName]);

  const handleSave = () => {
    if (!name.trim()) {
      setError('O nome do arquivo não pode estar vazio.');
      return;
    }

    const exists = existingScripts.some(s => s.name.toLowerCase() === name.trim().toLowerCase());
    
    if (exists && !showOverwriteWarning) {
      setShowOverwriteWarning(true);
      return;
    }

    onSave(name.trim(), showOverwriteWarning);
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl text-white">
                  <FileCode size={20} />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Salvar Script</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
                  Nome do Arquivo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                    setShowOverwriteWarning(false);
                  }}
                  placeholder="Ex: SistemaDeMoedas"
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all text-white",
                    error ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-white/30"
                  )}
                  autoFocus
                />
                {error && <p className="text-red-500 text-[10px] mt-1 font-medium">{error}</p>}
              </div>

              <AnimatePresence>
                {showOverwriteWarning && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-3 items-start"
                  >
                    <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-yellow-500">Arquivo já existe!</p>
                      <p className="text-[10px] text-yellow-500/80">Deseja sobrescrever o script existente com este novo conteúdo?</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleSave}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2",
                    showOverwriteWarning 
                      ? "bg-yellow-500 hover:bg-yellow-600 text-black" 
                      : "bg-white hover:bg-gray-200 text-black"
                  )}
                >
                  <Save size={14} />
                  {showOverwriteWarning ? 'SOBRESCREVER' : 'SALVAR'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
