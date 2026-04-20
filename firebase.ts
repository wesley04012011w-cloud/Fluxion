import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Ensure local persistence to help with iframe state issues
setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence error:", err));

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signIn = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error("Sign in error:", error);
    if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
      // Ignora o erro se o usuário fechou ou cancelou o popup
      return;
    } else if (error.code === 'auth/popup-blocked') {
      alert('O popup de login foi bloqueado pelo navegador. Por favor, permita popups para este site.');
    } else if (error.message?.includes('missing initial state') || error.code === 'auth/internal-error') {
      alert('Erro de autenticação no iframe. Por favor, tente abrir o app em uma nova aba para fazer login.');
    } else {
      alert('Erro ao entrar com Google: ' + error.message);
    }
    throw error;
  }
};
export const signOut = () => auth.signOut();
