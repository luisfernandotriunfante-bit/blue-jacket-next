import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getDatabase, type Database } from 'firebase/database'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN ?? '',
  databaseURL: import.meta.env.VITE_FB_DATABASE_URL ?? '',
  projectId: import.meta.env.VITE_FB_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FB_APP_ID ?? '',
}

let app: FirebaseApp | null = null
let db: Database | null = null
let storage: FirebaseStorage | null = null

export function isFirebaseConfigured(): boolean {
  return !!firebaseConfig.databaseURL && !!firebaseConfig.apiKey
}

export function getDb(): Database | null {
  if (!isFirebaseConfigured()) return null
  if (!app) app = initializeApp(firebaseConfig)
  if (!db) db = getDatabase(app)
  return db
}

// O Storage usa um bucket proprio (VITE_FB_STORAGE_BUCKET), por isso tem uma
// checagem de configuracao separada da do Realtime Database: um projeto pode
// ter o banco configurado sem ter o bucket pronto, ou vice-versa.
export function isStorageConfigured(): boolean {
  return isFirebaseConfigured() && !!firebaseConfig.storageBucket
}

export function getStorageInstance(): FirebaseStorage | null {
  if (!isStorageConfigured()) return null
  if (!app) app = initializeApp(firebaseConfig)
  if (!storage) storage = getStorage(app)
  return storage
}
