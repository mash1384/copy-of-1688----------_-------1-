import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

// Enhanced user context validation utilities
export interface UserContextValidationResult {
  valid: boolean
  user?: User
  error?: {
    code: string
    message: string
    recoverable: boolean
  }
}

// User session refresh capabilities
export interface SessionRefreshResult {
  success: boolean
  user?: User
  error?: {
    code: string
    message: string
    originalError?: any
  }
}

/**
 * Validates user context with comprehensive checks
 * @param user - User object to validate
 * @param operation - Operation name for logging
 * @returns Validation result with detailed error information
 */
export const validateUserContext = (user: any, operation: string): UserContextValidationResult => {
  if (!user) {
    console.error(`❌ User context validation failed for ${operation}: No user provided`)
    return {
      valid: false,
      error: {
        code: 'NO_USER_CONTEXT',
        message: '사용자 컨텍스트가 없습니다. 다시 로그인해주세요.',
        recoverable: true
      }
    }
  }

  if (!user.id) {
    console.error(`❌ User context validation failed for ${operation}: No user ID`)
    return {
      valid: false,
      error: {
        code: 'NO_USER_ID',
        message: '사용자 ID가 없습니다. 다시 로그인해주세요.',
        recoverable: true
      }
    }
  }

  if (typeof user.id !== 'string' || user.id.length === 0) {
    console.error(`❌ User context validation failed for ${operation}: Invalid user ID format`)
    return {
      valid: false,
      error: {
        code: 'INVALID_USER_ID',
        message: '사용자 ID 형식이 올바르지 않습니다.',
        recoverable: true
      }
    }
  }

  // Additional validation for user email and metadata
  if (!user.email) {
    console.warn(`⚠️ User context warning for ${operation}: No email provided`)
  }

  return { valid: true, user }
}

/**
 * Attempts to refresh the user session
 * @returns Session refresh result
 */
export const refreshUserSession = async (): Promise<SessionRefreshResult> => {
  try {
    console.log('🔄 Attempting to refresh user session...')
    
    const { data, error } = await supabase.auth.refreshSession()
    
    if (error) {
      console.error('❌ Session refresh failed:', error)
      return {
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: '세션 갱신에 실패했습니다. 다시 로그인해주세요.',
          originalError: error
        }
      }
    }

    if (!data.session || !data.session.user) {
      console.error('❌ Session refresh returned no session')
      return {
        success: false,
        error: {
          code: 'NO_SESSION_AFTER_REFRESH',
          message: '세션 갱신 후 세션을 찾을 수 없습니다. 다시 로그인해주세요.',
          originalError: null
        }
      }
    }

    console.log('✅ Session refreshed successfully')
    return {
      success: true,
      user: data.session.user
    }
  } catch (error) {
    console.error('❌ Session refresh exception:', error)
    return {
      success: false,
      error: {
        code: 'REFRESH_EXCEPTION',
        message: '세션 갱신 중 오류가 발생했습니다.',
        originalError: error
      }
    }
  }
}

/**
 * Gets current user with session validation and optional refresh
 * @param allowRefresh - Whether to attempt session refresh if expired
 * @returns User context validation result
 */
export const getCurrentUserWithValidation = async (allowRefresh: boolean = true): Promise<UserContextValidationResult> => {
  try {
    // First, try to get the current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('❌ Session validation failed:', sessionError)
      return {
        valid: false,
        error: {
          code: 'SESSION_ERROR',
          message: '세션 확인에 실패했습니다. 다시 로그인해주세요.',
          recoverable: true
        }
      }
    }

    // Check if session exists
    if (!sessionData.session) {
      return {
        valid: false,
        error: {
          code: 'NO_SESSION',
          message: '로그인이 필요합니다.',
          recoverable: true
        }
      }
    }

    // Check if session is expired
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = sessionData.session.expires_at || 0
    
    if (expiresAt <= now) {
      console.warn('⚠️ Session expired')
      
      if (allowRefresh) {
        const refreshResult = await refreshUserSession()
        
        if (!refreshResult.success) {
          return {
            valid: false,
            error: {
              code: 'SESSION_EXPIRED',
              message: '세션이 만료되었습니다. 다시 로그인해주세요.',
              recoverable: true
            }
          }
        }
        
        return validateUserContext(refreshResult.user, 'getCurrentUserWithValidation')
      } else {
        return {
          valid: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: '세션이 만료되었습니다. 다시 로그인해주세요.',
            recoverable: true
          }
        }
      }
    }

    // Validate the user from the session
    return validateUserContext(sessionData.session.user, 'getCurrentUserWithValidation')
    
  } catch (error) {
    console.error('❌ User validation exception:', error)
    return {
      valid: false,
      error: {
        code: 'VALIDATION_EXCEPTION',
        message: '사용자 검증 중 오류가 발생했습니다.',
        recoverable: true
      }
    }
  }
}

/**
 * Fallback mechanism for missing user context
 * @param operation - Operation name for logging
 * @returns User context validation result
 */
export const handleMissingUserContext = async (operation: string): Promise<UserContextValidationResult> => {
  console.warn(`⚠️ Missing user context for ${operation}, attempting to recover...`)
  
  try {
    const result = await getCurrentUserWithValidation(true)
    
    if (result.valid) {
      console.log(`✅ Successfully recovered user context for ${operation}`)
    } else {
      console.error(`❌ Failed to recover user context for ${operation}:`, result.error)
    }
    
    return result
  } catch (error) {
    console.error(`❌ Exception while recovering user context for ${operation}:`, error)
    return {
      valid: false,
      error: {
        code: 'CONTEXT_RECOVERY_FAILED',
        message: '사용자 컨텍스트 복구에 실패했습니다. 다시 로그인해주세요.',
        recoverable: true
      }
    }
  }
}

/**
 * Ensures user ID is passed to database functions
 * @param userId - Optional user ID
 * @param operation - Operation name for logging
 * @returns User ID or throws error
 */
export const ensureUserIdForOperation = async (userId?: string, operation: string = 'database operation'): Promise<string> => {
  if (userId) {
    // Validate the provided user ID
    const validation = validateUserContext({ id: userId }, operation)
    if (!validation.valid) {
      throw new Error(validation.error?.message || '제공된 사용자 ID가 유효하지 않습니다.')
    }
    return userId
  }

  // Get user ID from current session
  const userResult = await getCurrentUserWithValidation(true)
  if (!userResult.valid || !userResult.user) {
    throw new Error(userResult.error?.message || '사용자 컨텍스트를 가져올 수 없습니다.')
  }

  return userResult.user.id
}

/**
 * Validates user ownership of a resource
 * @param resourceUserId - User ID associated with the resource
 * @param currentUserId - Current user ID
 * @param resourceType - Type of resource for error messages
 * @returns Validation result
 */
export const validateUserOwnership = (
  resourceUserId: string, 
  currentUserId: string, 
  resourceType: string = 'resource'
): { valid: boolean; error?: string } => {
  if (!resourceUserId || !currentUserId) {
    return {
      valid: false,
      error: `${resourceType} 소유권 확인에 필요한 정보가 부족합니다.`
    }
  }

  if (resourceUserId !== currentUserId) {
    return {
      valid: false,
      error: `이 ${resourceType}에 대한 접근 권한이 없습니다.`
    }
  }

  return { valid: true }
}

/**
 * Creates a safe database operation wrapper with user context validation
 * @param operation - Database operation function
 * @param operationName - Operation name for logging
 * @param requireAuth - Whether authentication is required
 * @returns Enhanced operation with user context validation
 */
export const withUserContextValidation = <T>(
  operation: (userId: string) => Promise<T>,
  operationName: string,
  requireAuth: boolean = true
) => {
  return async (userId?: string): Promise<T> => {
    if (!requireAuth && !userId) {
      // If auth is not required and no userId provided, execute without validation
      return operation('')
    }

    const validatedUserId = await ensureUserIdForOperation(userId, operationName)
    return operation(validatedUserId)
  }
}