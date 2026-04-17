import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { 
  User as UserIcon, 
  Bot, 
  Download, 
  Save, 
  Terminal,
  Info,
  BookOpen,
  Brain,
  Search
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Message, cn } from '../types';

const MessageItem = React.memo(({ 
  msg, 
  onSaveScript, 
  onDownloadScript 
}: { 
  msg: Message, 
  onSaveScript: (name: string, content: string) => void,
  onDownloadScript: (name: string, content: string) => void
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-2 md:gap-3",
        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div className={cn(
        "w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg",
        msg.role === 'user' ? "bg-white text-black" : "bg-white/20 text-white"
      )}>
        {msg.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
      </div>
      <div className={cn(
        "max-w-[92%] md:max-w-[85%] rounded-xl p-3 text-xs md:text-sm leading-relaxed break-words shadow-sm backdrop-blur-md",
        msg.role === 'user' 
          ? "bg-white/5 border border-white/20 text-white" 
          : "bg-black/40 border border-white/5 text-gray-200"
      )}>
        {msg.images && msg.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {msg.images.map((img, i) => (
              <img 
                key={`img-${msg.id}-${i}`} 
                src={img} 
                alt="Upload" 
                className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg border border-white/10"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
        )}
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const codeContent = String(children).replace(/\n$/, '');
              
              return !inline && match ? (
                <div className="relative group my-3 w-full overflow-hidden rounded-lg border border-white/10 bg-black">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
                    <span className="text-[9px] font-mono text-gray-500 uppercase">{match[1]}</span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => onSaveScript('RobloxScript', codeContent)}
                        className="p-1 hover:bg-white/10 rounded text-[9px] font-bold text-white transition-all flex items-center gap-1"
                        title="Salvar no App"
                      >
                        <Save size={10} /> SAVE
                      </button>
                      <button 
                        onClick={() => onDownloadScript('RobloxScript', codeContent)}
                        className="p-1 hover:bg-white/10 rounded text-[9px] font-bold text-white transition-all flex items-center gap-1"
                        title="Baixar Arquivo"
                      >
                        <Download size={10} /> DL
                      </button>
                      <button 
                        onClick={() => navigator.clipboard.writeText(codeContent)}
                        className="p-1 hover:bg-white/10 rounded text-[9px] font-bold text-white transition-all"
                      >
                        COPY
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                    <pre className={cn("p-3 m-0", className)}>
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  </div>
                </div>
              ) : (
                <code className={cn("bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-xs", className)} {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {msg.content}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
});

interface MessageListProps {
  messages: Message[];
  isGenerating: boolean;
  streamingText: string;
  onSuggestionClick: (text: string) => void;
  onSaveScript: (name: string, content: string) => void;
  onDownloadScript: (name: string, content: string) => void;
  isHeavyMode?: boolean;
}

const LoadingIndicator = ({ isHeavyMode }: { isHeavyMode?: boolean }) => {
  const [stage, setStage] = React.useState(0);
  const stages = [
    { text: "Pensando...", icon: <Brain size={14} className="text-purple-400" /> },
    { text: "Organizando módulos...", icon: <BookOpen size={14} className="text-blue-400" /> },
    { text: "Construindo blocos...", icon: <Terminal size={14} className="text-green-400" /> },
    { text: "Finalizando sistema...", icon: <Bot size={14} className="text-yellow-400" /> }
  ];

  React.useEffect(() => {
    if (!isHeavyMode) return;
    const interval = setInterval(() => {
      setStage(prev => (prev + 1) % stages.length);
    }, 2500); // Change stage every 2.5 seconds
    return () => clearInterval(interval);
  }, [isHeavyMode]);

  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-white/20 text-white flex items-center justify-center animate-pulse">
        {isHeavyMode ? stages[stage].icon : <Bot size={14} />}
      </div>
      <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3 flex items-center justify-center min-w-[60px]">
        {isHeavyMode ? (
           <motion.div
             key={stage}
             initial={{ opacity: 0, y: 5 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -5 }}
             className="text-xs font-mono text-gray-300 flex items-center gap-2"
           >
             {stages[stage].text}
           </motion.div>
        ) : (
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}
      </div>
    </div>
  );
};

const MessageList = React.memo(({ 
  messages, 
  isGenerating, 
  streamingText, 
  onSuggestionClick,
  onSaveScript,
  onDownloadScript,
  isHeavyMode
}: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  if (messages.length === 0 && !isGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-3 max-w-xl mx-auto px-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-4 bg-white/10 rounded-full mb-2"
        >
          <img 
            src="/logo.png" 
            alt="Fluxion" 
            className="w-12 h-12 object-cover rounded-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="text-2xl font-black text-white">F</div>';
            }}
          />
        </motion.div>
        <h3 className="text-lg md:text-xl font-bold">O que vamos programar hoje?</h3>
        <p className="text-gray-500 text-xs md:text-sm">
          Fluxion: A inteligência definitiva para desenvolvedores Roblox.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full mt-6">
          {[
            "Sistema de DataStore Pro",
            "Script de Moedas/Líder",
            "Como usar Task library?",
            "Explique ModuleScripts"
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSuggestionClick(suggestion)}
              className="p-3 rounded-xl bg-[#0a0a0a] border border-white/5 hover:border-white/50 hover:bg-white/5 transition-all text-left text-xs font-medium"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 pb-4 will-change-transform">
      {messages.map((msg) => (
        <MessageItem 
          key={msg.id} 
          msg={msg} 
          onSaveScript={onSaveScript}
          onDownloadScript={onDownloadScript}
        />
      ))}
      
      {isGenerating && streamingText && (
        <MessageItem 
          msg={{ 
            id: 'streaming', 
            role: 'model', 
            content: streamingText, 
            createdAt: Timestamp.now()
          }} 
          onSaveScript={onSaveScript}
          onDownloadScript={onDownloadScript}
        />
      )}

      {isGenerating && !streamingText && (
        <LoadingIndicator isHeavyMode={isHeavyMode} />
      )}
      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
});

export default MessageList;
