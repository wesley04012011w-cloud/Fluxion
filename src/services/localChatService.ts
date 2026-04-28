import { Chat, Message } from '../types';

const DB_NAME = 'FluxionLocalDB';
const DB_VERSION = 1;
const CHATS_STORE = 'chats';
const MESSAGES_STORE = 'messages';

class LocalDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(CHATS_STORE)) {
          db.createObjectStore(CHATS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          db.createObjectStore(MESSAGES_STORE, { keyPath: 'chatId' });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve(this.db!);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    const db = await this.init();
    return new Promise((resolve) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.init();
    return new Promise((resolve) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  async put(storeName: string, value: any): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

const localDB = new LocalDB();

export const localChatService = {
  async getChats(): Promise<Chat[]> {
    const chats = await localDB.getAll<Chat>(CHATS_STORE);
    return chats.sort((a, b) => {
      const timeA = (a.updatedAt as any)?.seconds || 0;
      const timeB = (b.updatedAt as any)?.seconds || 0;
      return timeB - timeA;
    });
  },

  async saveChat(chat: Chat) {
    // Marcar como pendente de sincronização se for novo ou atualizado
    (chat as any).needsSync = true;
    await localDB.put(CHATS_STORE, chat);
  },

  async markChatSynced(chatId: string) {
    const chat = await localDB.get<Chat>(CHATS_STORE, chatId);
    if (chat) {
      (chat as any).needsSync = false;
      await localDB.put(CHATS_STORE, chat);
    }
  },

  async getUnsyncedChats(): Promise<Chat[]> {
    const all = await localDB.getAll<Chat>(CHATS_STORE);
    return all.filter(c => (c as any).needsSync);
  },

  async deleteChat(chatId: string) {
    await localDB.delete(CHATS_STORE, chatId);
    await localDB.delete(MESSAGES_STORE, chatId);
  },

  async getMessages(chatId: string): Promise<Message[]> {
    const data = await localDB.get<{ chatId: string, messages: Message[] }>(MESSAGES_STORE, chatId);
    return data ? data.messages : [];
  },

  async saveMessages(chatId: string, messages: Message[]) {
    // Marcar que este set de mensagens precisa ser sincronizado
    await localDB.put(MESSAGES_STORE, { chatId, messages, needsSync: true });
    
    // Update metadata locally
    const chat = await localDB.get<Chat>(CHATS_STORE, chatId);
    if (chat) {
      chat.updatedAt = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any;
      (chat as any).needsSync = true;
      await localDB.put(CHATS_STORE, chat);
    }
  },

  async markMessagesSynced(chatId: string) {
    const data = await localDB.get<{ chatId: string, messages: Message[], needsSync: boolean }>(MESSAGES_STORE, chatId);
    if (data) {
      data.needsSync = false;
      await localDB.put(MESSAGES_STORE, data);
    }
  },

  async getUnsyncedMessages(): Promise<{ chatId: string, messages: Message[] }[]> {
    const all = await localDB.getAll<{ chatId: string, messages: Message[], needsSync: boolean }>(MESSAGES_STORE);
    return all.filter(m => m.needsSync);
  },

  async addMessage(chatId: string, message: Message) {
    const messages = await localChatService.getMessages(chatId);
    messages.push(message);
    await localChatService.saveMessages(chatId, messages);
  },

  async syncWithSupabase(remoteChats: any[]) {
    const local = await this.getChats();
    const localIds = new Set(local.map(c => c.id));
    
    for (const remote of remoteChats) {
      if (!localIds.has(remote.id)) {
        await this.saveChat({
          id: remote.id,
          title: remote.title || 'Chat s/ título',
          userId: remote.user_id,
          createdAt: { seconds: Math.floor(new Date(remote.created_at).getTime() / 1000), nanoseconds: 0 } as any,
          updatedAt: { seconds: Math.floor(new Date(remote.updated_at).getTime() / 1000), nanoseconds: 0 } as any,
        } as Chat);
      }
    }
    return await this.getChats();
  }
};
