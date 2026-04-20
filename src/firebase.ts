import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

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
      return;
    } else if (error.code === 'auth/popup-blocked') {
      alert('🔒 BLOQUEIO DE POPUP DETECTADO!\n\nSeu navegador bloqueou a janela de login por estarmos dentro de um iframe.\n\nSOLUÇÃO: Clique no ícone de "janela bloqueada" na barra de endereços e escolha "Sempre permitir", ou abra o Fluxion em uma nova aba para logar.');
    } else if (error.message?.includes('missing initial state') || error.code === 'auth/internal-error') {
      alert('⚠️ ERRO DE ESTADO (IFRAME)\n\nO login falhou devido às restrições de segurança do iframe.\n\nSOLUÇÃO: Clique no link "Abra em uma nova aba" no menu lateral para fazer login com sucesso.');
    } else {
      alert('Erro ao entrar com Google: ' + error.message);
    }
    throw error;
  }
};
export const signOut = () => auth.signOut();
