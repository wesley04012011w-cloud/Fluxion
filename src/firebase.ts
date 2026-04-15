import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app;
let auth;
let db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (error) {
  console.error("Erro crítico ao inicializar Firebase:", error);
}

export { auth, db };
export const googleProvider = new GoogleAuthProvider();

export const signIn = () => {
  if (!auth) {
    alert("Erro: Firebase não inicializado corretamente.");
    return Promise.reject("Firebase not initialized");
  }
  return signInWithPopup(auth, googleProvider);
};
export const signOut = () => auth?.signOut();

// Test connection
async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Conexão com Firestore estabelecida com sucesso.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Erro de conexão: O cliente está offline ou a configuração do Firebase está incorreta.");
    }
  }
}
testConnection();
