import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Ensure local persistence to help with iframe state issues
const persistencePromise = setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error("Persistence error:", err);
  return null;
});

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signIn = async () => {
  try {
    // Wait for persistence to be established first if available
    await persistencePromise;
    
    console.log("Iniciando signInWithPopup...");
    const result = await signInWithPopup(auth, googleProvider);
    console.log("Login bem sucedido:", result.user.email);
    return result;
  } catch (error: any) {
    console.error("Sign in error:", error);
    
    // Check for iframe specific issues
    const isIframe = window.self !== window.top;
    
    if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
      return;
    } else if (error.code === 'auth/popup-blocked') {
      alert('🔒 BLOQUEIO DE POPUP DETECTADO!\n\nSeu navegador bloqueou a janela de login.\n\nSOLUÇÃO: Clique no ícone de "janela bloqueada" na barra de endereços e escolha "Sempre permitir", ou abra o Fluxion em uma nova aba para logar.');
    } else if (error.message?.includes('missing initial state') || error.code === 'auth/internal-error' || error.code === 'auth/network-request-failed' || error.message?.includes('cross-origin')) {
      if (isIframe) {
        const confirmOpen = confirm('⚠️ RESTRIÇÃO DE SEGURANÇA (IFRAME)\n\nNavegadores modernos (como Chrome/Safari) bloqueiam autenticação em iframes por segurança.\n\nDeseja abrir em uma nova aba para fazer login com sucesso agora?');
        if (confirmOpen) {
          window.open(window.location.href, '_blank');
        }
      } else {
        alert('Erro de conexão no login. Tente novamente ou verifique sua internet.');
      }
    } else {
      alert('Erro ao entrar com Google: ' + error.message);
    }
    throw error;
  }
};
export const signOut = () => auth.signOut();
