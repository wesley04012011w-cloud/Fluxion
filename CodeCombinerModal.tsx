import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, Plus, Minus, CodeXml } from 'lucide-react';
import { cn } from '../types';

interface CodeCombinerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBlocks: number;
}

export default function CodeCombinerModal({ isOpen, onClose, initialBlocks }: CodeCombinerModalProps) {
  const [blocksCount, setBlocksCount] = useState(initialBlocks > 0 ? initialBlocks : 2);
  const [blockContents, setBlockContents] = useState<string[]>(Array(initialBlocks > 0 ? initialBlocks : 2).fill(''));
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const newCount = initialBlocks > 0 ? initialBlocks : 2;
      setBlocksCount(newCount);
      setBlockContents(Array(newCount).fill(''));
      setIsCopied(false);
    }
  }, [isOpen, initialBlocks]);

  const handleContentChange = (index: number, content: string) => {
    const newContents = [...blockContents];
    newContents[index] = content;
    setBlockContents(newContents);
  };

  const handleAddBlock = () => {
    setBlocksCount(prev => prev + 1);
    setBlockContents(prev => [...prev, '']);
  };

  const handleRemoveBlock = () => {
    if (blocksCount > 1) {
      setBlocksCount(prev => prev - 1);
      setBlockContents(prev => prev.slice(0, -1));
    }
  };

  const handleCopy = () => {
    const combined = blockContents.join('\n\n');
    navigator.clipboard.writeText(combined);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-4xl relative z-10 shadow-2xl flex flex-col max-h-[90vh]"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CodeXml className="text-white" />
            Combinador de Blocos
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Cole as partes do seu script abaixo para combiná-las em um único código.
          </p>
        </div>

        <div className="flex items-center justify-between mb-4 bg-black/40 p-3 rounded-xl border border-white/5">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-400">Quantidade de Blocos:</span>
            <div className="flex items-center gap-2 bg-black border border-white/10 rounded-lg p-1">
              <button 
                onClick={handleRemoveBlock}
                disabled={blocksCount <= 1}
                className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white disabled:opacity-30"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-bold">{blocksCount}</span>
              <button 
                onClick={handleAddBlock}
                className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <button 
            onClick={handleCopy}
            disabled={blockContents.every(c => !c.trim())}
            className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-200 transition-all disabled:opacity-50 disabled:hover:bg-white"
          >
            {isCopied ? <Check size={16} /> : <Copy size={16} />}
            {isCopied ? 'Copiado!' : 'Copiar Código Completo'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
          {Array.from({ length: blocksCount }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
                <span>Bloco {i + 1}</span>
                <span className="text-[10px] opacity-50">{blockContents[i]?.length || 0} chars</span>
              </label>
              <textarea
                value={blockContents[i] || ''}
                onChange={(e) => handleContentChange(i, e.target.value)}
                placeholder={`Cole o código do Bloco ${i + 1} aqui...`}
                className="w-full h-32 bg-black border border-white/10 rounded-xl p-3 text-xs font-mono text-gray-300 focus:outline-none focus:border-white/30 transition-all resize-none custom-scrollbar"
                spellCheck={false}
              />
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
