import * as React from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { 
  supabase,
  signInWithGoogle, 
  signOut,
  createOrUpdateUser
} from '../lib/supabase';

// Enhanced error types for better error handling
export interface AuthErrorDetails {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: AuthErrorDetails | null;
  sessionExpired: boolean;
  retryCount: number;
}

interface AuthContextType {
  // Current state
  currentUser: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  authError: AuthErrorDetails | null;
  sessionExpired: boolean;
  
  // Authentication methods
  signInWithGoogle: () => Promise<User>;
  signOut: () => Promise<void>;
  
  // Enhanced methods
  refreshAuth: () => Promise<void>;
  clearError: () => void;
  validateUserContext: () => boolean;
  
  // Debug utilities
  getAuthDebugInfo: () => object;
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
  // Enhanced state management
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
    error: null,
    sessionExpired: false,
    retryCount: 0
  });

  // Constants for retry logic
  const MAX_RETRY_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 1000;

  // Helper function to create error details
  const createErrorDetails = useCallback((error: any, recoverable: boolean = true): AuthErrorDetails => {
    return {
      code: error?.code || error?.name || 'UNKNOWN_ERROR',
      message: error?.message || 'An unknown authentication error occurred',
      details: error,
      timestamp: new Date(),
      recoverable
    };
  }, []);

  // Enhanced error handling with retry logic
  const handleAuthError = useCallback((error: any, context: string) => {
    console.error(`Auth error in ${context}:`, error);
    
    const errorDetails = createErrorDetails(error);
    const isSessionExpired = error?.code === 'session_expired' || 
                            error?.message?.includes('session') ||
                            error?.message?.includes('expired');

    setAuthState(prev => ({
      ...prev,
      error: errorDetails,
      sessionExpired: isSessionExpired,
      loading: false
    }));

    return errorDetails;
  }, [createErrorDetails]);

  // Retry mechanism with exponential backoff
  const retryWithBackoff = useCallback(async (
    operation: () => Promise<any>, 
    maxAttempts: number = MAX_RETRY_ATTEMPTS
  ): Promise<any> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        // Reset retry count on success
        setAuthState(prev => ({ ...prev, retryCount: 0 }));
        return result;
      } catch (error) {
        console.warn(`Auth operation attempt ${attempt} failed:`, error);
        
        setAuthState(prev => ({ ...prev, retryCount: attempt }));
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // Exponential backoff delay
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }, []);

  // Enhanced session refresh
  const refreshAuth = useCallback(async (): Promise<void> => {
    console.log('Refreshing authentication session...');
    
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const result = await retryWithBackoff(async () => {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        return session;
      });

      setAuthState(prev => ({
        ...prev,
        user: result?.user || null,
        isAuthenticated: !!result?.user,
        loading: false,
        error: null,
        sessionExpired: false
      }));

      console.log('Auth refresh successful');
    } catch (error) {
      handleAuthError(error, 'refreshAuth');
    }
  }, [retryWithBackoff, handleAuthError]);

  // User context validation
  const validateUserContext = useCallback((): boolean => {
    const isValid = !!(authState.user?.id && authState.isAuthenticated && !authState.sessionExpired);
    
    if (!isValid) {
      console.warn('User context validation failed:', {
        hasUser: !!authState.user,
        hasUserId: !!authState.user?.id,
        isAuthenticated: authState.isAuthenticated,
        sessionExpired: authState.sessionExpired
      });
    }
    
    return isValid;
  }, [authState]);

  // Clear error state
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // Debug information getter
  const getAuthDebugInfo = useCallback(() => {
    return {
      user: {
        id: authState.user?.id,
        email: authState.user?.email,
        hasSession: !!authState.user
      },
      state: {
        loading: authState.loading,
        isAuthenticated: authState.isAuthenticated,
        sessionExpired: authState.sessionExpired,
        retryCount: authState.retryCount
      },
      error: authState.error ? {
        code: authState.error.code,
        message: authState.error.message,
        timestamp: authState.error.timestamp,
        recoverable: authState.error.recoverable
      } : null,
      supabaseClient: {
        url: supabase.supabaseUrl,
        connected: true
      }
    };
  }, [authState]);

  // Enhanced initialization with retry logic
  useEffect(() => {
    console.log('Enhanced AuthProvider initialization started');
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        console.log('Getting initial session...');
        
        const session = await retryWithBackoff(async () => {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          return session;
        });
        
        if (mounted) {
          setAuthState(prev => ({
            ...prev,
            user: session?.user || null,
            isAuthenticated: !!session?.user,
            loading: false,
            error: null
          }));
          console.log('Initial auth state set:', { hasUser: !!session?.user });
        }
      } catch (error) {
        if (mounted) {
          handleAuthError(error, 'initializeAuth');
        }
      }
    };

    // Enhanced auth state change handler
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', { event, hasSession: !!session });
        
        if (!mounted) return;

        try {
          // Handle different auth events
          switch (event) {
            case 'SIGNED_IN':
              setAuthState(prev => ({
                ...prev,
                user: session?.user || null,
                isAuthenticated: !!session?.user,
                loading: false,
                error: null,
                sessionExpired: false
              }));

              // Create or update user data with retry
              if (session?.user) {
                try {
                  await retryWithBackoff(async () => {
                    await createOrUpdateUser(session.user);
                  });
                  console.log('User data created/updated successfully');
                } catch (error) {
                  console.error('Failed to create/update user data:', error);
                  // Don't fail the auth process for user data issues
                }
              }
              break;

            case 'SIGNED_OUT':
              setAuthState(prev => ({
                ...prev,
                user: null,
                isAuthenticated: false,
                loading: false,
                error: null,
                sessionExpired: false
              }));
              break;

            case 'TOKEN_REFRESHED':
              setAuthState(prev => ({
                ...prev,
                user: session?.user || null,
                isAuthenticated: !!session?.user,
                error: null,
                sessionExpired: false
              }));
              break;

            default:
              setAuthState(prev => ({
                ...prev,
                user: session?.user || null,
                isAuthenticated: !!session?.user,
                loading: false
              }));
          }
        } catch (error) {
          handleAuthError(error, `onAuthStateChange-${event}`);
        }
      }
    );

    initializeAuth();

    return () => {
      console.log('Enhanced AuthProvider cleanup');
      mounted = false;
      subscription.unsubscribe();
    };
  }, [retryWithBackoff, handleAuthError]);

  // Enhanced sign in with comprehensive error handling
  const handleSignInWithGoogle = useCallback(async (): Promise<User> => {
    try {
      clearError();
      setAuthState(prev => ({ ...prev, loading: true }));

      const result = await retryWithBackoff(async () => {
        const authResult = await signInWithGoogle();
        if (authResult.error) throw authResult.error;
        return authResult;
      });

      // Return current user (will be updated by onAuthStateChange)
      if (!authState.user) {
        throw new Error('Sign in completed but user not available');
      }
      
      return authState.user;
    } catch (error) {
      handleAuthError(error, 'signInWithGoogle');
      throw error;
    }
  }, [authState.user, clearError, retryWithBackoff, handleAuthError]);

  // Enhanced sign out with error handling
  const handleSignOut = useCallback(async (): Promise<void> => {
    try {
      clearError();
      setAuthState(prev => ({ ...prev, loading: true }));

      await retryWithBackoff(async () => {
        await signOut();
      });

      console.log('Sign out successful');
    } catch (error) {
      handleAuthError(error, 'signOut');
      throw error;
    }
  }, [clearError, retryWithBackoff, handleAuthError]);

  const value: AuthContextType = {
    // Current state
    currentUser: authState.user,
    loading: authState.loading,
    isAuthenticated: authState.isAuthenticated,
    authError: authState.error,
    sessionExpired: authState.sessionExpired,
    
    // Authentication methods
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
    
    // Enhanced methods
    refreshAuth,
    clearError,
    validateUserContext,
    
    // Debug utilities
    getAuthDebugInfo,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};