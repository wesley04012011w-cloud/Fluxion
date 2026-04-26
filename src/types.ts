import { Timestamp } from 'firebase/firestore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  }
  // No emitir error fatal para problemas de conexão temporários ou quota excedida
  const errorLower = errInfo.error.toLowerCase();
  const isQuietError = 
    errorLower.includes('reach cloud firestore backend') || 
    errorLower.includes('quota') ||
    errorLower.includes('exhausted') ||
    errorLower.includes('limit exceeded') ||
    errorLower.includes('network') ||
    errorLower.includes('offline') ||
    errorLower.includes('connection');

  if (!isQuietError) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  } else {
    // Solo loguear una vez o en modo warn para no saturar
    if (errInfo.error.includes('Quota limit exceeded') || errInfo.error.toLowerCase().includes('quota')) {
      if (!(window as any)._quotaExceededSent) {
        (window as any)._quotaExceededSent = true;
        console.warn('⚠️ FIRESTORE QUOTA EXCEEDED - The app will be restricted until tomorrow.');
        window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
      }
    } else {
      console.warn('⚠️ Firestore connection/network issue (quieted):', errInfo.operationType, errInfo.path);
    }
    return;
  }

  if (operationType !== OperationType.LIST) {
    throw new Error(JSON.stringify(errInfo));
  }
}
