import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const KEY_COOLDOWN_MS = 10 * 60 * 1000;
const exhaustedKeysUntil = new Map<string, number>();

const normalizeKey = (key?: string) => key?.trim() ?? '';

const dedupeKeys = (keys: string[]) => Array.from(new Set(keys.map(normalizeKey).filter(Boolean)));

const shuffleKeys = (keys: string[]) => [...keys].sort(() => Math.random() - 0.5);

const isCoolingDown = (key: string) => {
  const until = exhaustedKeysUntil.get(key);
  if (!until) return false;
  if (until <= Date.now()) {
    exhaustedKeysUntil.delete(key);
    return false;
  }
  return true;
};

export const isQuotaError = (err: any): boolean => {
  const msg = (err?.message || String(err || '')).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('resource exhausted') ||
    msg.includes('exceeded') ||
    msg.includes('api key not valid') ||
    msg.includes('invalid api key') ||
    msg.includes('permission_denied') ||
    msg.includes('403')
  );
};

export const markKeyAsCoolingDown = (key: string) => {
  exhaustedKeysUntil.set(key, Date.now() + KEY_COOLDOWN_MS);
};

export const maskKey = (key: string) => `${key.slice(0, 6)}...${key.slice(-4)}`;

export const getCandidateKeys = async (customApiKey?: string) => {
  const keysToTry: string[] = [];
  const normalizedCustomKey = normalizeKey(customApiKey);

  if (normalizedCustomKey) {
    keysToTry.push(normalizedCustomKey);
  }

  try {
    const configDoc = await getDoc(doc(db, 'config', 'main'));
    if (configDoc.exists()) {
      const keys: string[] = configDoc.data().geminiApiKeys || [];
      keysToTry.push(...shuffleKeys(keys));
    }
  } catch (error) {
    console.error('Error fetching keys from Firestore:', error);
  }

  const envKey = normalizeKey(process.env.GEMINI_API_KEY);
  if (envKey) {
    keysToTry.push(envKey);
  }

  const uniqueKeys = dedupeKeys(keysToTry);
  const availableKeys = uniqueKeys.filter((key) => !isCoolingDown(key));

  return availableKeys.length > 0 ? availableKeys : uniqueKeys;
};