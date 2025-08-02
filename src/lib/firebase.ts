
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: 'ripple-video-calling',
  appId: '1:86590389569:web:f47a036c72d3f34ed1f5c0',
  storageBucket: 'ripple-video-calling.firebasestorage.app',
  apiKey: 'AIzaSyB-VZ4LPHQO9lZMR01E1ggU6Pc_UfNXyhM',
  authDomain: 'ripple-video-calling.firebaseapp.com',
  messagingSenderId: '86590389569',
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
