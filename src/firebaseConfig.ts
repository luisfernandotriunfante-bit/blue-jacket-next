import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getDatabase, type Database } from 'firebase/database'

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

export function isFirebaseConfigured(): boolean {
  return !!firebaseConfig.databaseURL && !!firebaseConfig.apiKey
}

export function getDb(): Database | null {
  if (!isFirebaseConfigured()) return null
  if (!app) app = initializeApp(firebaseConfig)
  if (!db) db = getDatabase(app)
  return db
}
