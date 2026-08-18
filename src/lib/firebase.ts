import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  Firestore,
  Unsubscribe 
} from "firebase/firestore";

export const firebaseConfig = {
  projectId: "gen-lang-client-0383119283",
  appId: "1:720741657034:web:beb0b9c5333f07ce1ac733",
  apiKey: "AIzaSyAEG04rwHQpuVzyysoWtWesl0yEfg3_TmY",
  authDomain: "gen-lang-client-0383119283.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-16938f66-fc4f-4bd3-ab8d-07f08e825e33",
  storageBucket: "gen-lang-client-0383119283.firebasestorage.app",
  messagingSenderId: "720741657034",
  measurementId: ""
};

let dbInstance: Firestore | null = null;

export function getFirestoreDb(): Firestore | null {
  if (dbInstance) return dbInstance;
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    return dbInstance;
  } catch (err) {
    console.warn("[Firebase Client] Failed to initialize Firestore:", err);
    return null;
  }
}

export const FIRESTORE_DOC_PATH = "projects/global_data";

export async function fetchRemoteProjectData(): Promise<any | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  try {
    const docRef = doc(db, FIRESTORE_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn("[Firebase Client] fetchRemoteProjectData failed:", err);
  }
  return null;
}

export async function persistRemoteProjectData(data: any): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;
  try {
    const docRef = doc(db, FIRESTORE_DOC_PATH);
    await setDoc(docRef, data);
    console.log("[Firebase Client] Successfully synced project data to Cloud Firestore.");
    return true;
  } catch (err) {
    console.error("[Firebase Client] persistRemoteProjectData failed:", err);
    return false;
  }
}

export function subscribeRemoteProjectData(
  onData: (data: any) => void,
  onError?: (err: any) => void
): Unsubscribe | null {
  const db = getFirestoreDb();
  if (!db) return null;
  try {
    const docRef = doc(db, FIRESTORE_DOC_PATH);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data) {
            onData(data);
          }
        }
      },
      (error) => {
        console.warn("[Firebase Client] onSnapshot listener encountered an error:", error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn("[Firebase Client] Failed to subscribe to Firestore document:", err);
    return null;
  }
}
