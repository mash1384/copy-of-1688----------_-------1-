import { supabase } from './supabase'
import { Product, ProductOption, Sale, Purchase, AppSettings, SalesChannel } from '../types'
import { 
  getCurrentUserWithValidation,
  ensureUserIdForOperation,
  validateUserOwnership,
  withUserContextValidation,
  type UserContextValidationResult 
} from './user-context-validation'

// 유틸리티 함수
const generateId = () => crypto.randomUUID()

// Enhanced error handling types
interface DatabaseError {
  code: string
  message: string
  details?: any
  hint?: string
  originalError?: any
}

interface DatabaseResult<T> {
  data?: T
  error?: DatabaseError
  success: boolean
}

// Error categories for better handling
enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  PERMISSION = 'PERMISSION',
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN'
}

// Enhanced error handling utility
const handleDatabaseError = (error: any, operation: string): DatabaseError => {
  console.error(`❌ Database error in ${operation}:`, error)

  let category = ErrorCategory.UNKNOWN
  let userMessage = '데이터베이스 작업 중 오류가 발생했습니다.'

  if (error?.code) {
    switch (error.code) {
      case 'PGRST116':
      case '42501':
        category = ErrorCategory.PERMISSION
        userMessage = '데이터 접근 권한이 없습니다. 로그인 상태를 확인해주세요.'
        break
      case 'PGRST301':
        category = ErrorCategory.AUTHENTICATION
        userMessage = '인증이 필요합니다. 다시 로그인해주세요.'
        break
      case '23505':
        category = ErrorCategory.VALIDATION
        userMessage = '중복된 데이터입니다.'
        break
      case '23503':
        category = ErrorCategory.VALIDATION
        userMessage = '참조된 데이터가 존재하지 않습니다.'
        break
      case 'ENOTFOUND':
      case 'ECONNREFUSED':
        category = ErrorCategory.NETWORK
        userMessage = '네트워크 연결을 확인해주세요.'
        break
    }
  }

  return {
    code: error?.code || 'UNKNOWN',
    message: userMessage,
    details: error?.details,
    hint: error?.hint,
    originalError: error
  }
}

// Enhanced authentication validation with session refresh capabilities
const validateAuthentication = async (allowRefresh: boolean = true): Promise<{ user: any; error?: DatabaseError }> => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('❌ Session validation failed:', sessionError)
      return {
        user: null,
        error: {
          code: 'SESSION_ERROR',
          message: '세션 확인에 실패했습니다. 다시 로그인해주세요.',
          originalError: sessionError
        }
      }
    }

    if (!sessionData.session) {
      return {
        user: null,
        error: {
          code: 'NO_SESSION',
          message: '로그인이 필요합니다.',
          originalError: null
        }
      }
    }

    const now = Math.floor(Date.now() / 1000)
    const expiresAt = sessionData.session.expires_at || 0

    if (expiresAt <= now) {
      console.warn('⚠️ Session expired, attempting refresh...')

      if (allowRefresh) {
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

          if (refreshError || !refreshData.session) {
            console.error('❌ Session refresh failed:', refreshError)
            return {
              user: null,
              error: {
                code: 'SESSION_EXPIRED',
                message: '세션이 만료되었습니다. 다시 로그인해주세요.',
                originalError: refreshError
              }
            }
          }

          console.log('✅ Session refreshed successfully')
          return { user: refreshData.session.user }
        } catch (refreshException) {
          console.error('❌ Session refresh exception:', refreshException)
          return {
            user: null,
            error: {
              code: 'REFRESH_FAILED',
              message: '세션 갱신에 실패했습니다. 다시 로그인해주세요.',
              originalError: refreshException
            }
          }
        }
      } else {
        return {
          user: null,
          error: {
            code: 'SESSION_EXPIRED',
            message: '세션이 만료되었습니다. 다시 로그인해주세요.',
            originalError: null
          }
        }
      }
    }

    if (!sessionData.session.user || !sessionData.session.user.id) {
      return {
        user: null,
        error: {
          code: 'INVALID_USER',
          message: '사용자 정보가 유효하지 않습니다.',
          originalError: null
        }
      }
    }

    return { user: sessionData.session.user }
  } catch (error) {
    console.error('❌ Authentication validation exception:', error)
    return {
      user: null,
      error: {
        code: 'AUTH_EXCEPTION',
        message: '인증 확인 중 오류가 발생했습니다.',
        originalError: error
      }
    }
  }
}

// Enhanced user context validation with detailed checks
const validateUserContext = (user: any, operation: string): { valid: boolean; error?: DatabaseError } => {
  if (!user) {
    console.error(`❌ User context validation failed for ${operation}: No user provided`)
    return {
      valid: false,
      error: {
        code: 'NO_USER_CONTEXT',
        message: '사용자 컨텍스트가 없습니다. 다시 로그인해주세요.',
        originalError: null
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
        originalError: null
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
        originalError: null
      }
    }
  }

  return { valid: true }
}

// Fallback mechanism for missing user context
const handleMissingUserContext = async (operation: string): Promise<{ user: any; error?: DatabaseError }> => {
  console.warn(`⚠️ Missing user context for ${operation}, attempting to recover...`)

  try {
    const authResult = await validateAuthentication(true)

    if (authResult.error) {
      console.error(`❌ Failed to recover user context for ${operation}:`, authResult.error)
      return authResult
    }

    console.log(`✅ Successfully recovered user context for ${operation}`)
    return authResult
  } catch (error) {
    console.error(`❌ Exception while recovering user context for ${operation}:`, error)
    return {
      user: null,
      error: {
        code: 'CONTEXT_RECOVERY_FAILED',
        message: '사용자 컨텍스트 복구에 실패했습니다. 다시 로그인해주세요.',
        originalError: error
      }
    }
  }
}

// Retry logic utility
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if ((error as any)?.code === 'PGRST116' || (error as any)?.code === 'PGRST301' || (error as any)?.code === '42501') {
        throw error
      }

      if (attempt === maxRetries) {
        throw error
      }

      console.warn(`⚠️ Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, error)
      await new Promise(resolve => setTimeout(resolve, delay))
      delay *= 2
    }
  }

  throw lastError
}

// Safe database operation wrapper
const safeDbOperation = async <T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  operationName: string,
  requireAuth: boolean = true
): Promise<DatabaseResult<T>> => {
  try {
    if (requireAuth) {
      const authResult = await validateAuthentication()
      if (authResult.error) {
        return {
          success: false,
          error: authResult.error
        }
      }
    }
    
    const result = await withRetry(operation)
    
    if (result.error) {
      return {
        success: false,
        error: handleDatabaseError(result.error, operationName)
      }
    }
    
    return {
      success: true,
      data: result.data || undefined
    }
    
  } catch (error) {
    return {
      success: false,
      error: handleDatabaseError(error, operationName)
    }
  }
}

// Enhanced product functions with safe operations
export const getProducts = async (): Promise<Product[]> => {
  console.log('🔍 상품 목록 조회 시작...')

  const result = await safeDbOperation(
    async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_options (*)
        `)
        .order('created_at', { ascending: false })
      return { data, error }
    },
    'getProducts',
    true
  )

  if (!result.success) {
    console.error('❌ 상품 목록 조회 실패:', result.error)
    throw new Error(result.error?.message || '상품 목록을 불러올 수 없습니다.')
  }

  if (!result.data) {
    console.log('⚠️ 상품 데이터가 없습니다.')
    return []
  }

  const products = (result.data as any[]).map(product => ({
    id: product.id,
    name: product.name,
    chineseName: product.chinese_name,
    sourceUrl: product.source_url,
    imageUrl: product.image_url,
    baseCostCny: product.base_cost_cny,
    options: product.product_options.map((option: any) => ({
      id: option.id,
      name: option.name,
      sku: option.sku,
      stock: option.stock,
      costOfGoods: option.cost_of_goods,
      recommendedPrice: option.recommended_price
    }))
  }))

  console.log(`✅ 상품 목록 조회 완료: ${products.length}개 상품`)
  return products
}

// Product validation interface
interface ProductValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// Comprehensive product validation function
const validateProductData = (product: Omit<Product, 'id'>): ProductValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  if (!product.name || typeof product.name !== 'string' || product.name.trim().length === 0) {
    errors.push('상품명은 필수 입력 항목입니다.')
  } else if (product.name.trim().length > 100) {
    errors.push('상품명은 100자를 초과할 수 없습니다.')
  }

  if (!product.chineseName || typeof product.chineseName !== 'string' || product.chineseName.trim().length === 0) {
    warnings.push('중국어 상품명이 없습니다. 추후 입력을 권장합니다.')
  } else if (product.chineseName.trim().length > 100) {
    errors.push('중국어 상품명은 100자를 초과할 수 없습니다.')
  }

  if (product.sourceUrl && typeof product.sourceUrl === 'string' && product.sourceUrl.trim().length > 0) {
    try {
      new URL(product.sourceUrl)
    } catch {
      errors.push('소스 URL 형식이 올바르지 않습니다.')
    }
  }

  if (product.imageUrl && typeof product.imageUrl === 'string' && product.imageUrl.trim().startsWith('http')) {
    try {
      new URL(product.imageUrl)
    } catch {
      errors.push('이미지 URL 형식이 올바르지 않습니다.')
    }
  }

  if (product.baseCostCny !== undefined && product.baseCostCny !== null) {
    if (typeof product.baseCostCny !== 'number' || product.baseCostCny < 0) {
      errors.push('기본 비용(CNY)은 0 이상의 숫자여야 합니다.')
    } else if (product.baseCostCny > 999999) {
      warnings.push('기본 비용(CNY)이 매우 높습니다. 확인해주세요.')
    }
  }

  if (!product.options || !Array.isArray(product.options) || product.options.length === 0) {
    errors.push('최소 1개 이상의 상품 옵션이 필요합니다.')
  } else {
    const skuSet = new Set<string>()

    product.options.forEach((option, index) => {
      const optionPrefix = `옵션 ${index + 1}`

      if (!option.name || typeof option.name !== 'string' || option.name.trim().length === 0) {
        errors.push(`${optionPrefix}: 옵션명은 필수 입력 항목입니다.`)
      } else if (option.name.trim().length > 50) {
        errors.push(`${optionPrefix}: 옵션명은 50자를 초과할 수 없습니다.`)
      }

      if (!option.sku || typeof option.sku !== 'string' || option.sku.trim().length === 0) {
        errors.push(`${optionPrefix}: SKU는 필수 입력 항목입니다.`)
      } else {
        const trimmedSku = option.sku.trim()
        if (trimmedSku.length > 50) {
          errors.push(`${optionPrefix}: SKU는 50자를 초과할 수 없습니다.`)
        }
        if (skuSet.has(trimmedSku)) {
          errors.push(`${optionPrefix}: 중복된 SKU입니다. (${trimmedSku})`)
        } else {
          skuSet.add(trimmedSku)
        }
      }

      if (option.stock !== undefined && option.stock !== null) {
        if (typeof option.stock !== 'number' || option.stock < 0 || !Number.isInteger(option.stock)) {
          errors.push(`${optionPrefix}: 재고는 0 이상의 정수여야 합니다.`)
        } else if (option.stock > 999999) {
          warnings.push(`${optionPrefix}: 재고가 매우 높습니다. 확인해주세요.`)
        }
      }

      if (option.costOfGoods !== undefined && option.costOfGoods !== null) {
        if (typeof option.costOfGoods !== 'number' || option.costOfGoods < 0) {
          errors.push(`${optionPrefix}: 상품 원가는 0 이상의 숫자여야 합니다.`)
        } else if (option.costOfGoods > 999999) {
          warnings.push(`${optionPrefix}: 상품 원가가 매우 높습니다. 확인해주세요.`)
        }
      }

      if (option.recommendedPrice !== undefined && option.recommendedPrice !== null) {
        if (typeof option.recommendedPrice !== 'number' || option.recommendedPrice < 0) {
          errors.push(`${optionPrefix}: 권장 판매가는 0 이상의 숫자여야 합니다.`)
        } else if (option.recommendedPrice > 9999999) {
          warnings.push(`${optionPrefix}: 권장 판매가가 매우 높습니다. 확인해주세요.`)
        }

        if (option.costOfGoods && option.recommendedPrice < option.costOfGoods) {
          warnings.push(`${optionPrefix}: 권장 판매가가 원가보다 낮습니다.`)
        }
      }
    })

    if (product.options.length > 50) {
      errors.push('상품 옵션은 50개를 초과할 수 없습니다.')
    } else if (product.options.length > 20) {
      warnings.push('상품 옵션이 많습니다. 관리에 주의하세요.')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// Enhanced safe product creation with comprehensive validation
export const addProductSafe = async (userId: string, product: Omit<Product, 'id'>): Promise<Product> => {
  console.log('🔍 안전한 상품 등록 시작:', {
    productName: product.name,
    optionsCount: product.options?.length || 0,
    userId: userId.substring(0, 8) + '...'
  })

  console.log('🔍 상품 데이터 검증 중...')
  const validation = validateProductData(product)

  if (!validation.isValid) {
    const errorMessage = '상품 데이터 검증 실패:\n' + validation.errors.join('\n')
    console.error('❌ 상품 데이터 검증 실패:', validation.errors)
    throw new Error(errorMessage)
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️ 상품 데이터 경고:', validation.warnings)
  }

  const productId = generateId()
  let createdProductId: string | null = null
  let createdOptionIds: string[] = []

  try {
    console.log('🔍 상품 생성 중...')
    const sanitizedProduct = {
      id: productId,
      user_id: userId,
      name: product.name.trim(),
      chinese_name: product.chineseName?.trim() || null,
      source_url: product.sourceUrl?.trim() || null,
      image_url: product.imageUrl?.trim() || null,
      base_cost_cny: product.baseCostCny || 0
    }

    const productResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase
          .from('products')
          .insert(sanitizedProduct)
          .select()
        return { data, error }
      },
      'addProductSafe - create product',
      false
    )

    if (!productResult.success) {
      console.error('❌ 상품 생성 실패:', productResult.error)
      throw new Error(productResult.error?.message || '상품 생성에 실패했습니다.')
    }

    createdProductId = productId
    console.log('✅ 상품 생성 완료, 옵션 생성 중...')

    const optionsData = product.options.map(option => {
      const optionId = generateId()
      createdOptionIds.push(optionId)

      return {
        id: optionId,
        product_id: productId,
        name: option.name.trim(),
        sku: option.sku.trim(),
        stock: Math.max(0, Math.floor(option.stock || 0)),
        cost_of_goods: Math.max(0, option.costOfGoods || 0),
        recommended_price: Math.max(0, option.recommendedPrice || 0)
      }
    })

    const optionsResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase
          .from('product_options')
          .insert(optionsData)
          .select()
        return { data, error }
      },
      'addProductSafe - create options',
      false
    )

    if (!optionsResult.success) {
      console.error('❌ 상품 옵션 생성 실패:', optionsResult.error)
      throw new Error(optionsResult.error?.message || '상품 옵션 생성에 실패했습니다.')
    }

    console.log('✅ 상품 옵션 생성 완료')

    console.log('🔍 생성된 상품 조회 중...')
    const products = await getProducts()
    const newProduct = products.find(p => p.id === productId)

    if (!newProduct) {
      throw new Error('생성된 상품을 찾을 수 없습니다. 데이터베이스 동기화 문제일 수 있습니다.')
    }

    if (newProduct.options.length !== product.options.length) {
      console.warn('⚠️ 생성된 옵션 수가 예상과 다릅니다:', {
        expected: product.options.length,
        actual: newProduct.options.length
      })
    }

    console.log('✅ 상품 등록 완료:', {
      productName: newProduct.name,
      productId: newProduct.id,
      optionsCount: newProduct.options.length,
      warnings: validation.warnings
    })

    return newProduct

  } catch (error) {
    console.error('❌ 상품 등록 실패, 롤백 시작:', error)

    const rollbackPromises: Promise<any>[] = []

    if (createdOptionIds.length > 0) {
      console.log('🔄 생성된 옵션 롤백 중...')
      rollbackPromises.push(
        (async () => {
          const { error } = await supabase
            .from('product_options')
            .delete()
            .in('id', createdOptionIds);
          if (error) {
            console.error('⚠️ 옵션 롤백 실패:', error);
          } else {
            console.log('✅ 옵션 롤백 완료');
          }
        })()
      );
    }

    if (createdProductId) {
      console.log('🔄 생성된 상품 롤백 중...')
      rollbackPromises.push(
        (async () => {
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', createdProductId);
          if (error) {
            console.error('⚠️ 상품 롤백 실패:', error);
          } else {
            console.log('✅ 상품 롤백 완료');
          }
        })()
      );
    }

    try {
      await Promise.all(rollbackPromises)
    } catch (rollbackError) {
      console.error('⚠️ 롤백 중 일부 오류 발생:', rollbackError)
    }

    const enhancedError = new Error(
      error instanceof Error
        ? `상품 등록 실패: ${error.message}`
        : '상품 등록 중 알 수 없는 오류가 발생했습니다.'
    )
    throw enhancedError
  }
}

// Backward compatibility wrapper
export const addProduct = async (product: Omit<Product, 'id'>, userId?: string): Promise<Product> => {
  console.log('🔍 상품 등록 시작 (호환성 래퍼)...')
  try {
    const finalUserId = await ensureUserIdForOperation(userId, 'addProduct');
         
    const result = await addProductSafe(finalUserId, product)
    
    console.log('✅ 상품 등록 완료 (호환성 래퍼):', result.name)
    return result

  } catch (error) {
    console.error('❌ 상품 등록 실패 (호환성 래퍼):', error)
    throw error
  }
}

export const updateProduct = async (product: Product): Promise<void> => {
  console.log('🔍 상품 업데이트 시작:', { productId: product.id, productName: product.name })

  const authResult = await validateAuthentication()
  if (authResult.error) {
    console.error('❌ 상품 업데이트 인증 실패:', authResult.error)
    throw new Error(authResult.error.message)
  }

  const userValidation = validateUserContext(authResult.user, 'updateProduct')
  if (!userValidation.valid) {
    console.error('❌ 상품 업데이트 사용자 컨텍스트 검증 실패:', userValidation.error)
    throw new Error(userValidation.error?.message || '사용자 컨텍스트가 유효하지 않습니다.')
  }

  try {
    console.log('🔍 상품 정보 업데이트 중...')
    const productResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase
          .from('products')
          .update({
            name: product.name,
            chinese_name: product.chineseName,
            source_url: product.sourceUrl,
            image_url: product.imageUrl,
            base_cost_cny: product.baseCostCny,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id)
          .eq('user_id', authResult.user.id)
        return { data, error }
      },
      'updateProduct - update product',
      false
    )

    if (!productResult.success) {
      console.error('❌ 상품 정보 업데이트 실패:', productResult.error)
      throw new Error(productResult.error?.message || '상품 정보 업데이트에 실패했습니다.')
    }

    console.log('✅ 상품 정보 업데이트 완료')

    console.log('🔍 기존 옵션 삭제 중...')
    const deleteResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase
          .from('product_options')
          .delete()
          .eq('product_id', product.id)
        return { data, error }
      },
      'updateProduct - delete options',
      false
    )

    if (!deleteResult.success) {
      console.error('❌ 기존 옵션 삭제 실패:', deleteResult.error)
      throw new Error(deleteResult.error?.message || '기존 옵션 삭제에 실패했습니다.')
    }

    console.log('✅ 기존 옵션 삭제 완료')

    console.log('🔍 새 옵션 생성 중...')
    const optionsData = product.options.map(option => ({
      id: option.id || generateId(),
      product_id: product.id,
      name: option.name,
      sku: option.sku,
      stock: option.stock,
      cost_of_goods: option.costOfGoods,
      recommended_price: option.recommendedPrice
    }))

    const optionsResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase
          .from('product_options')
          .insert(optionsData)
        return { data, error }
      },
      'updateProduct - create options',
      false
    )

    if (!optionsResult.success) {
      console.error('❌ 새 옵션 생성 실패:', optionsResult.error)
      throw new Error(optionsResult.error?.message || '새 옵션 생성에 실패했습니다.')
    }

    console.log('✅ 상품 업데이트 완료')
  } catch (error) {
    console.error('❌ 상품 업데이트 실패:', error)
    throw error
  }
}

export const deleteProduct = async (productId: string): Promise<void> => {
  console.log('🔍 상품 삭제 시작:', { productId })

  const authResult = await validateAuthentication()
  if (authResult.error) {
    console.error('❌ 상품 삭제 인증 실패:', authResult.error)
    throw new Error(authResult.error.message)
  }

  const userValidation = validateUserContext(authResult.user, 'deleteProduct')
  if (!userValidation.valid) {
    console.error('❌ 상품 삭제 사용자 컨텍스트 검증 실패:', userValidation.error)
    throw new Error(userValidation.error?.message || '사용자 컨텍스트가 유효하지 않습니다.')
  }

  try {
    const deleteResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId)
          .eq('user_id', authResult.user.id)
        return { data, error }
      },
      'deleteProduct',
      false
    )

    if (!deleteResult.success) {
      console.error('❌ 상품 삭제 실패:', deleteResult.error)
      throw new Error(deleteResult.error?.message || '상품 삭제에 실패했습니다.')
    }

    console.log('✅ 상품 삭제 완료')
  } catch (error) {
    console.error('❌ 상품 삭제 실패:', error)
    throw error
  }
}

// Enhanced sales functions with safe operations
export const getSales = async (): Promise<Sale[]> => {
  console.log('🔍 매출 목록 조회 시작...')

  const result = await safeDbOperation(
    async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('date', { ascending: false })
      return { data, error }
    },
    'getSales',
    true
  )

  if (!result.success) {
    console.error('❌ 매출 목록 조회 실패:', result.error)
    throw new Error(result.error?.message || '매출 목록을 불러올 수 없습니다.')
  }

  if (!result.data) {
    console.log('⚠️ 매출 데이터가 없습니다.')
    return []
  }

  const sales = (result.data as any[]).map(sale => ({
    id: sale.id,
    date: sale.date,
    productId: sale.product_id,
    optionId: sale.option_id,
    quantity: sale.quantity,
    salePricePerItem: sale.sale_price_per_item,
    channel: sale.channel as SalesChannel,
    channelFeePercentage: sale.channel_fee_percentage,
    packagingCostKrw: sale.packaging_cost_krw,
    shippingCostKrw: sale.shipping_cost_krw
  }))

  console.log(`✅ 매출 목록 조회 완료: ${sales.length}개 매출`)
  return sales
}

export const addSale = async (sale: Omit<Sale, 'id'>, userId?: string): Promise<Sale> => {
  console.log('🔍 매출 등록 시작:', {
    productId: sale.productId,
    optionId: sale.optionId,
    quantity: sale.quantity
  })

  const finalUserId = await ensureUserIdForOperation(userId, 'addSale');
  const saleId = generateId()

  try {
    console.log('🔍 매출 생성 중...')
    const saleResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase
          .from('sales')
          .insert({
            id: saleId,
            user_id: finalUserId,
            product_id: sale.productId,
            option_id: sale.optionId,
            date: sale.date,
            quantity: sale.quantity,
            sale_price_per_item: sale.salePricePerItem,
            channel: sale.channel,
            channel_fee_percentage: sale.channelFeePercentage,
            packaging_cost_krw: sale.packagingCostKrw,
            shipping_cost_krw: sale.shippingCostKrw
          })
          .select()
        return { data, error }
      },
      'addSale - create sale',
      false
    )

    if (!saleResult.success) {
      console.error('❌ 매출 생성 실패:', saleResult.error)
      throw new Error(saleResult.error?.message || '매출 생성에 실패했습니다.')
    }

    console.log('✅ 매출 생성 완료, 재고 업데이트 중...')

    // 재고 업데이트 (매출로 인한 재고 감소)
    const updateResult = await withRetry(
      async () => {
        const { data, error } = await supabase.rpc('update_inventory_from_sale', {
          sale_id: saleId
        })
        
        if (error) {
          throw error
        }
        
        return data
      },
      3,
      1000
    )

    if (updateResult && !(updateResult as any).success) {
      console.error('❌ 재고 업데이트 실패:', (updateResult as any).error)
      throw new Error(`재고 업데이트 실패: ${(updateResult as any).error || '알 수 없는 오류'}`)
    }

    console.log('✅ 재고 업데이트 완료:', updateResult)

    const newSale: Sale = {
      id: saleId,
      date: sale.date,
      productId: sale.productId,
      optionId: sale.optionId,
      quantity: sale.quantity,
      salePricePerItem: sale.salePricePerItem,
      channel: sale.channel,
      channelFeePercentage: sale.channelFeePercentage,
      packagingCostKrw: sale.packagingCostKrw,
      shippingCostKrw: sale.shippingCostKrw
    }

    console.log('✅ 매출 등록 완료')
    return newSale

  } catch (error) {
    console.error('❌ 매출 등록 실패:', error)
    throw error
  }
}

// Enhanced purchases functions with safe operations
export const getPurchases = async (): Promise<Purchase[]> => {
  console.log('🔍 매입 목록 조회 시작...')

  const result = await safeDbOperation(
    async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          purchase_items (*)
        `)
        .order('date', { ascending: false })
      return { data, error }
    },
    'getPurchases',
    true
  )

  if (!result.success) {
    console.error('❌ 매입 목록 조회 실패:', result.error)
    throw new Error(result.error?.message || '매입 목록을 불러올 수 없습니다.')
  }

  if (!result.data) {
    console.log('⚠️ 매입 데이터가 없습니다.')
    return []
  }

  const purchases = (result.data as any[]).map(purchase => ({
    id: purchase.id,
    date: purchase.date,
    shippingCostKrw: purchase.shipping_cost_krw,
    customsFeeKrw: purchase.customs_fee_krw,
    otherFeeKrw: purchase.other_fee_krw,
    items: purchase.purchase_items.map((item: any) => ({
      productId: item.product_id,
      optionId: item.option_id,
      quantity: item.quantity,
      costCnyPerItem: item.cost_cny_per_item
    }))
  }))

  console.log(`✅ 매입 목록 조회 완료: ${purchases.length}개 매입`)
  return purchases
}

export const addPurchase = async (purchase: Omit<Purchase, 'id'>, userId?: string): Promise<void> => {
  console.log('🔍 매입 등록 시작:', {
    date: purchase.date,
    itemsCount: purchase.items.length
  })

  const finalUserId = await ensureUserIdForOperation(userId, 'addPurchase');
  const purchaseId = generateId()

  try {
    console.log('🔍 매입 생성 중...')
    const purchaseResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase
          .from('purchases')
          .insert({
            id: purchaseId,
            user_id: finalUserId,
            date: purchase.date,
            shipping_cost_krw: purchase.shippingCostKrw,
            customs_fee_krw: purchase.customsFeeKrw,
            other_fee_krw: purchase.otherFeeKrw
          })
        return { data, error }
      },
      'addPurchase - create purchase',
      false
    )

    if (!purchaseResult.success) {
      console.error('❌ 매입 생성 실패:', purchaseResult.error)
      throw new Error(purchaseResult.error?.message || '매입 생성에 실패했습니다.')
    }

    console.log('✅ 매입 생성 완료, 매입 아이템 생성 중...')

    const itemsData = purchase.items.map(item => ({
      purchase_id: purchaseId,
      product_id: item.productId,
      option_id: item.optionId,
      quantity: item.quantity,
      cost_cny_per_item: item.costCnyPerItem
    }))

    const itemsResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase
          .from('purchase_items')
          .insert(itemsData)
        return { data, error }
      },
      'addPurchase - create items',
      false
    )

    if (!itemsResult.success) {
      console.error('❌ 매입 아이템 생성 실패:', itemsResult.error)
      await supabase.from('purchases').delete().eq('id', purchaseId)
      throw new Error(itemsResult.error?.message || '매입 아이템 생성에 실패했습니다.')
    }

    console.log('✅ 매입 아이템 생성 완료, 재고 업데이트 중...')

    const updateResult = await withRetry(
      async () => {
        const { data, error } = await supabase.rpc('update_inventory_from_purchase', {
          purchase_id: purchaseId
        })
        
        if (error) {
          throw error
        }
        
        return data
      },
      3,
      1000
    )

    if (updateResult && !(updateResult as any).success) {
      console.error('❌ 재고 업데이트 실패:', (updateResult as any).error)
      throw new Error(`재고 업데이트 실패: ${(updateResult as any).error || '알 수 없는 오류'}`)
    }

    console.log('✅ 재고 업데이트 완료:', updateResult)
    console.log('✅ 매입 등록 완료')

  } catch (error) {
    console.error('❌ 매입 등록 실패:', error)
    throw error
  }
}

// Enhanced settings functions with safe operations
export const getSettings = async (): Promise<AppSettings> => {
  console.log('🔍 설정 조회 시작...')
  
  const authResult = await validateAuthentication()
  if (authResult.error) {
    console.error('❌ 설정 조회 인증 실패:', authResult.error)
    console.log('⚠️ 인증 실패로 기본 설정 반환')
    return {
      defaultPackagingCostKrw: 1000,
      defaultShippingCostKrw: 3000
    }
  }

  const result = await safeDbOperation(
    async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', authResult.user.id)
        .maybeSingle()
      return { data, error }
    },
    'getSettings',
    false
  )

  if (!result.success) {
    console.error('❌ 설정 조회 실패:', result.error)
    console.log('⚠️ 설정 조회 실패로 기본 설정 반환')
    return {
      defaultPackagingCostKrw: 1000,
      defaultShippingCostKrw: 3000
    }
  }

  if (!result.data) {
    console.log('⚠️ 설정 데이터가 없습니다. 기본 설정 반환')
    return {
      defaultPackagingCostKrw: 1000,
      defaultShippingCostKrw: 3000
    }
  }

  const settings = {
    defaultPackagingCostKrw: (result.data as any).default_packaging_cost_krw,
    defaultShippingCostKrw: (result.data as any).default_shipping_cost_krw
  }

  console.log('✅ 설정 조회 완료')
  return settings
}

export const updateSettings = async (settings: AppSettings): Promise<void> => {
  console.log('🔍 설정 업데이트 시작...')

  const result = await safeDbOperation(
    async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({
          user_id: (await validateAuthentication()).user.id,
          default_packaging_cost_krw: settings.defaultPackagingCostKrw,
          default_shipping_cost_krw: settings.defaultShippingCostKrw,
          updated_at: new Date().toISOString()
        })
      return { data, error }
    },
    'updateSettings',
    true
  )

  if (!result.success) {
    console.error('❌ 설정 업데이트 실패:', result.error)
    throw new Error(result.error?.message || '설정 업데이트에 실패했습니다.')
  }

  console.log('✅ 설정 업데이트 완료')
}

export const updateProductOption = async (
  productId: string,
  optionId: string,
  updates: Partial<ProductOption>
): Promise<void> => {
  console.log('🔍 상품 옵션 업데이트 시작:', { productId, optionId, updates })
  
  const result = await safeDbOperation(
    async () => {
      const { data, error } = await supabase
        .from('product_options')
        .update({
          name: updates.name,
          sku: updates.sku,
          stock: updates.stock,
          cost_of_goods: updates.costOfGoods,
          recommended_price: updates.recommendedPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', optionId)
        .eq('product_id', productId)
      return { data, error }
    },
    'updateProductOption',
    true
  )

  if (!result.success) {
    console.error('❌ 상품 옵션 업데이트 실패:', result.error)
    throw new Error(result.error?.message || '상품 옵션 업데이트에 실패했습니다.')
  }

  console.log('✅ 상품 옵션 업데이트 완료')
}

// Sample data creation interfaces
export interface SampleDataProgress {
  step: string
  current: number
  total: number
  message: string
  isComplete: boolean
  error?: string
}

export interface SampleDataResult {
  success: boolean
  error?: string
  createdData?: {
    products: number
    options: number
    purchases: number
    purchaseItems: number
    sales: number
  }
}

// Sample data creation function
export const createSampleData = async (
  userId: string,
  onProgress?: (progress: SampleDataProgress) => void
): Promise<SampleDataResult> => {
  console.log('🔍 샘플 데이터 생성 시작...')
  
  try {
    const updateProgress = (
      step: string,
      current: number,
      total: number,
      message: string,
      isComplete: boolean = false,
      error?: string
    ) => {
      const progress: SampleDataProgress = {
        step,
        current,
        total,
        message,
        isComplete,
        error
      };
      
      if (onProgress) {
        onProgress(progress);
      }
    };
    
    updateProgress('초기화', 1, 8, '샘플 데이터 생성 준비 중...', false);
    
    // Sample product data
    const productData = [
      {
        id: generateId(),
        user_id: userId,
        name: '면 셔츠',
        chinese_name: '棉衬衫',
        source_url: 'https://detail.1688.com/sample',
        image_url: 'https://via.placeholder.com/300x300?text=Cotton+Shirt',
        base_cost_cny: 45
      },
      {
        id: generateId(),
        user_id: userId,
        name: '청바지',
        chinese_name: '牛仔裤',
        source_url: 'https://detail.1688.com/sample',
        image_url: 'https://via.placeholder.com/300x300?text=Jeans',
        base_cost_cny: 60
      }
    ];

    updateProgress('상품 생성', 2, 8, '샘플 상품 생성 중...', false);
    
    for (let i = 0; i < productData.length; i++) {
      const product = productData[i];
      console.log(`🔍 상품 ${i + 1}/${productData.length} 생성 중: ${product.name}`)
      
      const productResult = await safeDbOperation(
        async () => {
          const { data, error } = await supabase.from('products').insert(product)
          return { data, error }
        },
        `createSampleData - create product ${i + 1}`,
        false
      );

      if (!productResult.success) {
        throw new Error(`상품 생성 실패: ${productResult.error?.message}`);
      }
    }

    updateProgress('상품 생성', 3, 8, '샘플 상품 2개 생성 완료', true);

    // Sample options data
    const options = [
      // 면 셔츠 옵션
      { id: generateId(), product_id: productData[0].id, name: '화이트 / S', sku: 'SHIRT-WHITE-S', stock: 10, cost_of_goods: 15000, recommended_price: 29000 },
      { id: generateId(), product_id: productData[0].id, name: '화이트 / M', sku: 'SHIRT-WHITE-M', stock: 15, cost_of_goods: 15000, recommended_price: 29000 },
      { id: generateId(), product_id: productData[0].id, name: '블랙 / S', sku: 'SHIRT-BLACK-S', stock: 10, cost_of_goods: 15000, recommended_price: 29000 },
      { id: generateId(), product_id: productData[0].id, name: '블랙 / M', sku: 'SHIRT-BLACK-M', stock: 15, cost_of_goods: 15000, recommended_price: 29000 },
      // 청바지 옵션
      { id: generateId(), product_id: productData[1].id, name: '블루 / 28', sku: 'JEANS-BLUE-28', stock: 8, cost_of_goods: 20000, recommended_price: 39000 },
      { id: generateId(), product_id: productData[1].id, name: '블루 / 30', sku: 'JEANS-BLUE-30', stock: 12, cost_of_goods: 20000, recommended_price: 39000 },
      { id: generateId(), product_id: productData[1].id, name: '블랙 / 28', sku: 'JEANS-BLACK-28', stock: 8, cost_of_goods: 20000, recommended_price: 39000 },
      { id: generateId(), product_id: productData[1].id, name: '블랙 / 30', sku: 'JEANS-BLACK-30', stock: 12, cost_of_goods: 20000, recommended_price: 39000 }
    ];

    updateProgress('옵션 생성', 4, 8, '상품 옵션 생성 중...', false);
    
    console.log(`🔍 ${options.length}개 옵션 데이터 검증 완료, 생성 시작...`)
    
    const optionsResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase.from('product_options').insert(options)
        return { data, error }
      },
      'createSampleData - create options',
      false
    );

    if (!optionsResult.success) {
      throw new Error(`옵션 생성 실패: ${optionsResult.error?.message}`);
    }

    updateProgress('옵션 생성', 5, 8, '상품 옵션 8개 생성 완료', true);

    // Sample purchase data
    const purchaseData = {
      id: generateId(),
      user_id: userId,
      date: new Date().toISOString().split('T')[0],
      shipping_cost_krw: 15000,
      customs_fee_krw: 5000,
      other_fee_krw: 2000
    };

    updateProgress('매입 생성', 6, 8, '샘플 매입 생성 중...', false);
    
    console.log('🔍 매입 데이터 검증 완료, 생성 시작...')
    
    const purchaseResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase.from('purchases').insert(purchaseData)
        return { data, error }
      },
      'createSampleData - create purchase',
      false
    );

    if (!purchaseResult.success) {
      throw new Error(`매입 생성 실패: ${purchaseResult.error?.message}`);
    }

    // Sample purchase items
    const purchaseItems = options.map(option => ({
      purchase_id: purchaseData.id,
      product_id: option.product_id,
      option_id: option.id,
      quantity: option.stock,
      cost_cny_per_item: option.product_id === productData[0].id ? 45 : 60
    }));

    console.log(`🔍 ${purchaseItems.length}개 매입 아이템 데이터 검증 완료, 생성 시작...`)
    
    const purchaseItemsResult = await safeDbOperation(
      async () => {
        const { data, error } = await supabase.from('purchase_items').insert(purchaseItems)
        return { data, error }
      },
      'createSampleData - create purchase items',
      false
    );

    if (!purchaseItemsResult.success) {
      throw new Error(`매입 아이템 생성 실패: ${purchaseItemsResult.error?.message}`);
    }

    updateProgress('매입 생성', 7, 8, '매입 1건 및 아이템 8개 생성 완료', true);

    updateProgress('완료', 8, 8, '샘플 데이터 생성 완료', true);

    console.log('✅ 샘플 데이터 생성 완료');
    
    return {
      success: true,
      createdData: {
        products: productData.length,
        options: options.length,
        purchases: 1,
        purchaseItems: purchaseItems.length,
        sales: 0
      }
    };
  } catch (error) {
    console.error('❌ 샘플 데이터 생성 실패:', error);
    
    if (onProgress) {
      onProgress({
        step: '오류',
        current: 0,
        total: 8,
        message: '샘플 데이터 생성 중 오류가 발생했습니다.',
        isComplete: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

// Delete all data function
export const deleteAllData = async (): Promise<void> => {
  console.log('🔍 모든 데이터 삭제 시작...')
  
  const authResult = await validateAuthentication()
  if (authResult.error) {
    throw new Error(authResult.error.message)
  }
  
  const currentUserId = authResult.user.id
  
  const deleteSteps = [
    { table: 'sales', name: '매출 데이터' },
    { table: 'purchase_items', name: '매입 아이템 데이터' },
    { table: 'purchases', name: '매입 데이터' },
    { table: 'product_options', name: '상품 옵션 데이터' },
    { table: 'products', name: '상품 데이터' }
  ]
  
  for (const step of deleteSteps) {
    try {
      console.log(`🔍 ${step.name} 삭제 중...`)
      
      const deleteResult = await safeDbOperation(
        async () => {
          const { data, error } = await supabase.from(step.table).delete().eq('user_id', currentUserId)
          return { data, error }
        },
        `deleteAllData - ${step.table}`,
        false
      )
      
      if (!deleteResult.success) {
        console.error(`❌ ${step.name} 삭제 실패:`, deleteResult.error)
        throw new Error(`${step.name} 삭제에 실패했습니다: ${deleteResult.error?.message}`)
      }
      
      console.log(`✅ ${step.name} 삭제 완료`)
    } catch (error) {
      console.error(`❌ ${step.name} 삭제 중 오류:`, error)
      throw error
    }
  }
  
  console.log('✅ 모든 데이터 삭제 완료')
}