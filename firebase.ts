import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';

// Firebase 설정
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google 로그인 프로바이더
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// 구글 로그인 함수
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google 로그인 오류:', error);
    throw error;
  }
};

// 로그아웃 함수
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('로그아웃 오류:', error);
    throw error;
  }
};



// 사용자 데이터 타입 정의
export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  provider: string;
  createdAt: any;
  lastLoginAt: any;
}

// 사용자 데이터 생성/업데이트 (소셜 로그인 시 자동 처리)
export const createOrUpdateUser = async (user: User) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const isNewUser = !userDoc.exists();

    const userData: UserData = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      provider: user.providerData[0]?.providerId || 'google.com',
      createdAt: isNewUser ? serverTimestamp() : userDoc.data()?.createdAt,
      lastLoginAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', user.uid), userData, { merge: true });
    return isNewUser;
  } catch (error) {
    console.error('사용자 데이터 저장 오류:', error);
    throw error;
  }
};

// 사용자 데이터 조회
export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    }
    return null;
  } catch (error) {
    console.error('사용자 데이터 조회 오류:', error);
    return null;
  }
};

// 인증 상태 변경 감지
export const onAuthStateChangedListener = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export default app;