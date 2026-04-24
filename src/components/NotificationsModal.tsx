import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Info } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { Announcement } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export default function NotificationsModal({ isOpen, onClose, user }: NotificationsModalProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!isOpen || !user) return;

    // Fetch active announcements
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      setAnnouncements(msgs);
    });

    return () => unsubscribe();
  }, [isOpen, user]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                    <Bell size={18} />
                  </div>
                  <h2 className="text-sm font-bold text-white">Comunicados Oficiais</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {announcements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-50">
                    <Info size={32} className="mb-3 text-gray-400" />
                    <p className="text-sm font-medium">Nenhum comunicado no momento.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((announcement) => (
                      <div key={announcement.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-sm font-bold text-white">{announcement.title}</h3>
                          <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                            {announcement.createdAt?.toDate().toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">
                          {announcement.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
