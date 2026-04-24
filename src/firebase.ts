import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  setPersistence, 
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Ensure local persistence
const persistencePromise = setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error("Persistence error:", err);
  return null;
});

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = async () => {
  try {
    await persistencePromise;
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    console.error("Google sign in error:", error);
    handleAuthError(error);
    throw error;
  }
};

export const signUpWithEmail = async (email: string, pass: string, username: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(result.user, { displayName: username });
    await sendEmailVerification(result.user);
    return result;
  } catch (error: any) {
    console.error("Signup error:", error);
    handleAuthError(error);
    throw error;
  }
};

export const logInWithEmail = async (email: string, pass: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result;
  } catch (error: any) {
    console.error("Login error:", error);
    handleAuthError(error);
    throw error;
  }
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    handleAuthError(error);
    throw error;
  }
};

const handleAuthError = (error: any) => {
  const isIframe = window.self !== window.top;
  
  if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
    return;
  } else if (error.code === 'auth/popup-blocked') {
    alert('🔒 BLOQUEIO DE POPUP DETECTADO!');
  } else if (error.code === 'auth/email-already-in-use') {
    alert('Este e-mail já está sendo usado.');
  } else if (error.code === 'auth/weak-password') {
    alert('A senha é muito fraca.');
  } else if (error.code === 'auth/invalid-credential') {
    const msg = '🚫 ERRO DE CREDENCIAL:\n\n' +
      '1. Se for E-mail/Senha: Verifique se você já se CADASTROU primeiro (não adianta tentar entrar sem criar a conta).\n' +
      '2. Se for Google: O Google pode estar bloqueando o login dentro deste visualizador.\n\n' +
      'Deseja abrir em uma NOVA ABA para garantir que o login funcione?';
    
    if (isIframe) {
      if (confirm(msg)) {
        window.open(window.location.href, '_blank');
      }
    } else {
      alert('🚫 Credencial Inválida. Verifique seus dados ou se o provedor está ativo no Firebase.');
    }
  } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
    alert('E-mail ou senha incorretos.');
  } else if (error.code === 'auth/operation-not-allowed') {
    alert('🚫 ERRO DE CONFIGURAÇÃO:\nO método de login (E-mail ou Google) não está totalmente ativo.\n\nIMPORTANTE:\n1. No Firebase Console, clique no botão azul "SALVAR" no final da página após ativar o provedor.\n2. Verifique se o domínio "' + window.location.hostname + '" está na lista de "Domínios Autorizados" em: Autenticação > Configurações > Domínios.');
  } else if (isIframe && (error.message?.includes('cross-origin') || error.code === 'auth/internal-error' || error.code === 'auth/network-request-failed')) {
    const confirmOpen = confirm('⚠️ RESTRIÇÃO DE SEGURANÇA (IFRAME)\nO navegador impediu o login por estar dentro de um iframe.\n\nDeseja abrir o app em uma nova aba para logar com segurança?');
    if (confirmOpen) window.open(window.location.href, '_blank');
  } else {
    alert('Erro na autenticação: ' + error.message + ' (' + error.code + ')');
  }
};

export const signOut = () => auth.signOut();
