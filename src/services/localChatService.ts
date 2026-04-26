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
    await localDB.put(CHATS_STORE, chat);
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
    await localDB.put(MESSAGES_STORE, { chatId, messages });
    
    // Update metadata locally to keep UI consistent
    const chat = await localDB.get<Chat>(CHATS_STORE, chatId);
    if (chat) {
      chat.updatedAt = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any;
      await localDB.put(CHATS_STORE, chat);
    }
  },

  async addMessage(chatId: string, message: Message) {
    const messages = await localChatService.getMessages(chatId);
    messages.push(message);
    await localChatService.saveMessages(chatId, messages);
  }
};
