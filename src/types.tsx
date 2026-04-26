import React from 'react';
import { Timestamp } from 'firebase/firestore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export enum ChatMode {
  NORMAL = 'normal',
  BLOCKS = 'blocks',
  HEAVY = 'heavy',
  CHAT = 'chat'
}

export interface Chat {
  id: string;
  title: string;
  userId: string;
  mode?: ChatMode;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastActive: Timestamp;
  isOnline: boolean;
  lastIp?: string;
  isBanned?: boolean;
  blockedUntil?: Timestamp;
}

export interface BannedIP {
  id: string;
  ip: string;
  reason?: string;
  bannedAt: Timestamp;
  bannedBy: string;
}

export interface AppConfig {
  id: string;
  geminiApiKeys: string[];
  groqApiKey?: string;
  deepseekApiKey?: string;
  selectedApiKeyIndex?: number;
  autoApiKeySelection?: boolean;
  maintenanceMode?: boolean;
  updatedAt: Timestamp;
}

export interface UserStats {
  userId: string;
  dailyExportCount: number;
  lastExportDate: string; // YYYY-MM-DD
  nextExportAllowedAt: Timestamp;
  lastMessagesCount: number;
}

export interface SecurityAlert {
  id: string;
  userId: string;
  userEmail: string;
  chatId?: string;
  type: 'exploit' | 'moderation' | 'suspicious';
  content: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: Timestamp;
  status: 'pending' | 'reviewed';
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: Timestamp;
  createdBy: string;
  isActive: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  userId: string;
  role: 'user' | 'model';
  content: string;
  images?: string[];
  createdAt: Timestamp;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, currentUser?: any) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  const errorLower = errInfo.error.toLowerCase();
  const isQuotaError = errorLower.includes('quota') || errorLower.includes('exhausted') || errorLower.includes('limit exceeded');
  const isAuthError = errorLower.includes('permission') || errorLower.includes('insufficient');
  const isNetworkError = errorLower.includes('offline') || errorLower.includes('network') || errorLower.includes('connection') || errorLower.includes('reach cloud firestore');

  // Solo loguear errores reales, no de red o cuota (para no saturar dev console)
  if (!isQuotaError && !isNetworkError) {
    console.error('Firestore Error:', JSON.stringify(errInfo));
  }

  // Toasts informativos
  if (isQuotaError) {
    if (!(window as any)._quotaToastSent) {
      (window as any)._quotaToastSent = true;
      toast.error(
        <div className="flex flex-col gap-2">
          <p className="font-black text-[10px] uppercase">LIMITE DIÁRIO ALCANÇADO!</p>
          <p className="text-[9px] opacity-70">O sistema atingiu a cota gratuita. Tente novamente em instantes.</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] font-bold">Algum erro? Reporte em:</span>
            <a 
              href="https://discord.gg/YvRBUyhpZ" 
              target="_blank" 
              rel="noreferrer"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-[8px] font-black uppercase transition-all"
            >
              Discord
            </a>
          </div>
        </div>, 
        { duration: 10000 }
      );
      window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
    }
    return; // Don't throw for quota
  }

  if (isAuthError) {
    toast.error(
      <div className="flex flex-col gap-2">
        <p className="font-black text-[10px] uppercase">ERRO DE PERMISSÃO</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] font-bold">Algum erro? Reporte em:</span>
          <a 
            href="https://discord.gg/YvRBUyhpZ" 
            target="_blank" 
            rel="noreferrer"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-[8px] font-black uppercase transition-all"
          >
            Discord
          </a>
        </div>
      </div>,
      { duration: 5000 }
    );
  }

  if (isNetworkError) {
    console.warn("Firestore connection issue (suppressed):", operationType, path);
    return; // Don't throw for network
  }

  // Any other error
  if (!isQuotaError && !isAuthError && !isNetworkError) {
    toast.error(
      <div className="flex flex-col gap-2">
        <p className="font-black text-[10px] uppercase text-red-400">ERRO DE SISTEMA</p>
        <p className="text-[9px] opacity-70 font-mono truncate">{errInfo.error}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] font-bold">Reporte Staff:</span>
          <a 
            href="https://discord.gg/YvRBUyhpZ" 
            target="_blank" 
            rel="noreferrer"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-[8px] font-black uppercase transition-all"
          >
            Discord
          </a>
        </div>
      </div>,
      { duration: 6000 }
    );
  }

  // Throw only for critical write errors to trigger catch blocks
  if (operationType !== OperationType.LIST && operationType !== OperationType.GET) {
    throw new Error(JSON.stringify(errInfo));
  }
}
