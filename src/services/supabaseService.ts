import { supabase } from '../lib/supabase';
import { Timestamp } from 'firebase/firestore'; // We still use this for types if needed, but we should prefer standard JS dates in Supabase

export const supabaseService = {
  // Helper to check if supabase is ready
  isReady() {
    return !!supabase;
  },

  // Users
  async getUserProfile(uid: string) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateUserProfile(uid: string, updates: any) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('users')
      .upsert({ uid, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Chats
  async getChats(userId: string) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createChat(chat: any) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: chat.userId,
        title: chat.title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Messages
  async getMessages(chatId: string) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async addMessage(message: any) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: message.chatId,
        role: message.role,
        content: message.content,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    // Update chat timestamp
    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', message.chatId);

    if (error) throw error;
    return data;
  },

  // Scripts
  async getScripts(userId: string) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async saveScript(script: any) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('scripts')
      .upsert({
        user_id: script.userId,
        name: script.name,
        content: script.content,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Config
  async getConfig() {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('config')
      .select('*')
      .eq('id', 'main')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // IP Bans
  async isIpBanned(ip: string) {
    if (!supabase) return false;
    const { data, error } = await supabase
      .from('banned_ips')
      .select('*')
      .eq('ip', ip)
      .single();
    if (error && error.code !== 'PGRST116') return false;
    return !!data;
  },

  async logAccess(uid: string, ip: string, email: string) {
    if (!supabase) return;
    const { error } = await supabase
      .from('access_logs')
      .insert({
        uid,
        ip,
        email,
        timestamp: new Date().toISOString()
      });
    if (error) console.warn("Log access error:", error);
  }
};
