import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { 
  supabase,
  signInWithGoogle, 
  signOut,
  createOrUpdateUser
} from '../lib/supabase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider useEffect 시작');
    let mounted = true;
    
    // 초기화 함수
    const initializeAuth = async () => {
      try {
        console.log('getSession 호출 시작');
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('getSession 결과:', { session: !!session, error });
        
        if (error) {
          console.error('getSession 오류:', error);
        }
        
        if (mounted) {
          setCurrentUser(session?.user ?? null);
          setLoading(false);
          console.log('초기 로딩 완료, loading을 false로 설정');
        }
      } catch (error) {
        console.error('getSession 예외:', error);
        if (mounted) {
          setCurrentUser(null);
          setLoading(false);
          console.log('오류 발생으로 로딩 해제, 로그인 화면 표시');
        }
      }
    };

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth 상태 변경:', JSON.stringify({ event, session: !!session }));
        
        if (mounted) {
          setCurrentUser(session?.user ?? null);
          
          // 먼저 로딩 상태를 해제
          setLoading(false);
          console.log('Auth 상태 변경 후 loading을 false로 설정');
          
          // 로그인 시 사용자 데이터 생성/업데이트 (백그라운드에서 실행)
          if (event === 'SIGNED_IN' && session?.user) {
            try {
              await createOrUpdateUser(session.user);
              console.log('사용자 데이터 생성/업데이트 완료');
            } catch (error) {
              console.error('사용자 데이터 생성/업데이트 실패:', error);
            }
          }
        }
      }
    );

    // 초기화 실행
    initializeAuth();

    return () => {
      console.log('AuthProvider cleanup');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignInWithGoogle = async () => {
    const result = await signInWithGoogle();
    if (result.error) throw result.error;
    
    // 사용자 정보는 onAuthStateChange에서 처리됨
    return currentUser!;
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};