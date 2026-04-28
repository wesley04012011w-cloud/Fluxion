import React from 'react';
import { Lock, Disc as Discord, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

const ClosedPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 font-sans text-white selection:bg-indigo-500/30 text-center">
      <div className="max-w-md w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative"
        >
          {/* Background Glow */}
          <div className="absolute -inset-10 bg-indigo-500/10 blur-3xl rounded-full" />
          
          <div className="relative space-y-8">
            <div className="flex justify-center">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm shadow-2xl">
                <Lock className="w-12 h-12 text-indigo-400" />
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                Projeto Encerrado
              </h1>
              <p className="text-zinc-400 text-lg leading-relaxed">
                Projeto fechado por tempo indeterminado. Um novo app será lançado, por favor fique no aguardo.
              </p>
            </div>

            <div className="pt-4">
              <a 
                href="https://discord.gg/tcQUNYx2m" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 font-medium shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] active:scale-95"
              >
                <Discord className="w-5 h-5" />
                <span>Entrar no Discord</span>
                <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>

            <div className="pt-12 text-xs font-mono text-zinc-600 uppercase tracking-[0.2em]">
              Novidades em breve • 2024
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ClosedPage;
