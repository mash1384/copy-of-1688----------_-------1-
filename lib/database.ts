import { supabase } from './supabase'
import { Product, ProductOption, Sale, Purchase, AppSettings, SalesChannel } from '../types'
import { 
  validateUserContext, 
  getCurrentUserWithValidation, 
  handleMissingUserContext,
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
    // First, try to get the current session
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

    // Check if session exists and is valid
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

    // Check if session is expired
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

    // Validate user data
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
    // Try to get user from current session
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
      
      // Don't retry on authentication or permission errors
      if (error?.code === 'PGRST116' || error?.code === 'PGRST301' || error?.code === '42501') {
        throw error
      }
      
      if (attempt === maxRetries) {
        throw error
      }
      
      console.warn(`⚠️ Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, error)
      await new Promise(resolve => setTimeout(resolve, delay))
      delay *= 2 // Exponential backoff
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
    // Validate authentication if required
    if (requireAuth) {
      const authResult = await validateAuthentication()
      if (authResult.error) {
        return {
          success: false,
          error: authResult.error
        }
      }
    }
    
    // Execute operation with retry logic
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
    () => supabase
      .from('products')
      .select(`
        *,
        product_options (*)
      `)
      .order('created_at', { ascending: false }),
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

  const products = result.data.map(product => ({
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

export const addProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  console.log('🔍 상품 등록 시작:', { 
    productName: product.name,
    optionsCount: product.options.length 
  })

  // Validate authentication first
  const authResult = await validateAuthentication()
  if (authResult.error) {
    console.error('❌ 상품 등록 인증 실패:', authResult.error)
    throw new Error(authResult.error.message)
  }

  const userId = authResult.user.id
  const productId = generateId()

  try {
    // Create product with safe operation
    console.log('🔍 상품 생성 중...')
    const productResult = await safeDbOperation(
      () => supabase
        .from('products')
        .insert({
          id: productId,
          user_id: userId,
          name: product.name,
          chinese_name: product.chineseName,
          source_url: product.sourceUrl,
          image_url: product.imageUrl,
          base_cost_cny: product.baseCostCny
        }),
      'addProduct - create product',
      false // Auth already validated
    )

    if (!productResult.success) {
      console.error('❌ 상품 생성 실패:', productResult.error)
      throw new Error(productResult.error?.message || '상품 생성에 실패했습니다.')
    }

    console.log('✅ 상품 생성 완료, 옵션 생성 중...')

    // Create options with safe operation
    const optionsData = product.options.map(option => ({
      id: generateId(),
      product_id: productId,
      name: option.name,
      sku: option.sku,
      stock: option.stock || 0,
      cost_of_goods: option.costOfGoods || 0,
      recommended_price: option.recommendedPrice
    }))

    const optionsResult = await safeDbOperation(
      () => supabase
        .from('product_options')
        .insert(optionsData),
      'addProduct - create options',
      false // Auth already validated
    )

    if (!optionsResult.success) {
      console.error('❌ 상품 옵션 생성 실패:', optionsResult.error)
      // Try to clean up the created product
      await supabase.from('products').delete().eq('id', productId)
      throw new Error(optionsResult.error?.message || '상품 옵션 생성에 실패했습니다.')
    }

    console.log('✅ 상품 옵션 생성 완료')

    // Retrieve the created product
    const products = await getProducts()
    const newProduct = products.find(p => p.id === productId)
    
    if (!newProduct) {
      throw new Error('생성된 상품을 찾을 수 없습니다.')
    }

    console.log('✅ 상품 등록 완료:', newProduct.name)
    return newProduct

  } catch (error) {
    console.error('❌ 상품 등록 실패:', error)
    throw error
  }
}

export const updateProduct = async (product: Product): Promise<void> => {
  console.log('🔍 상품 업데이트 시작:', { productId: product.id, productName: product.name })
  
  // Validate authentication
  const authResult = await validateAuthentication()
  if (authResult.error) {
    console.error('❌ 상품 업데이트 인증 실패:', authResult.error)
    throw new Error(authResult.error.message)
  }

  // Validate user context
  const userValidation = validateUserContext(authResult.user, 'updateProduct')
  if (!userValidation.valid) {
    console.error('❌ 상품 업데이트 사용자 컨텍스트 검증 실패:', userValidation.error)
    throw new Error(userValidation.error?.message || '사용자 컨텍스트가 유효하지 않습니다.')
  }

  try {
    // Update product with safe operation
    console.log('🔍 상품 정보 업데이트 중...')
    const productResult = await safeDbOperation(
      () => supabase
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
        .eq('user_id', authResult.user.id), // Ensure user owns the product
      'updateProduct - update product',
      false // Auth already validated
    )

    if (!productResult.success) {
      console.error('❌ 상품 정보 업데이트 실패:', productResult.error)
      throw new Error(productResult.error?.message || '상품 정보 업데이트에 실패했습니다.')
    }

    console.log('✅ 상품 정보 업데이트 완료')

    // Delete existing options with safe operation
    console.log('🔍 기존 옵션 삭제 중...')
    const deleteResult = await safeDbOperation(
      () => supabase
        .from('product_options')
        .delete()
        .eq('product_id', product.id),
      'updateProduct - delete options',
      false // Auth already validated
    )

    if (!deleteResult.success) {
      console.error('❌ 기존 옵션 삭제 실패:', deleteResult.error)
      throw new Error(deleteResult.error?.message || '기존 옵션 삭제에 실패했습니다.')
    }

    console.log('✅ 기존 옵션 삭제 완료')

    // Create new options with safe operation
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
      () => supabase
        .from('product_options')
        .insert(optionsData),
      'updateProduct - create options',
      false // Auth already validated
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
  
  // Validate authentication
  const authResult = await validateAuthentication()
  if (authResult.error) {
    console.error('❌ 상품 삭제 인증 실패:', authResult.error)
    throw new Error(authResult.error.message)
  }

  // Validate user context
  const userValidation = validateUserContext(authResult.user, 'deleteProduct')
  if (!userValidation.valid) {
    console.error('❌ 상품 삭제 사용자 컨텍스트 검증 실패:', userValidation.error)
    throw new Error(userValidation.error?.message || '사용자 컨텍스트가 유효하지 않습니다.')
  }

  try {
    // Delete product with safe operation (ensures user owns the product)
    const deleteResult = await safeDbOperation(
      () => supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('user_id', authResult.user.id), // Ensure user owns the product
      'deleteProduct',
      false // Auth already validated
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
    () => supabase
      .from('sales')
      .select('*')
      .order('date', { ascending: false }),
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

  const sales = result.data.map(sale => ({
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

export const addSale = async (sale: Omit<Sale, 'id'>, userId?: string): Promise<void> => {
  console.log('🔍 매출 등록 시작:', { productId: sale.productId, optionId: sale.optionId, quantity: sale.quantity })
  
  // Validate authentication
  let currentUserId = userId
  if (!currentUserId) {
    const authResult = await validateAuthentication()
    if (authResult.error) {
      console.error('❌ 매출 등록 인증 실패:', authResult.error)
      throw new Error(authResult.error.message)
    }
    currentUserId = authResult.user.id
  }

  try {
    // Insert sale data with safe operation
    console.log('🔍 매출 데이터 삽입 중...')
    const saleResult = await safeDbOperation(
      () => supabase
        .from('sales')
        .insert({
          user_id: currentUserId,
          product_id: sale.productId,
          option_id: sale.optionId,
          date: sale.date,
          quantity: sale.quantity,
          sale_price_per_item: sale.salePricePerItem,
          channel: sale.channel,
          channel_fee_percentage: sale.channelFeePercentage,
          packaging_cost_krw: sale.packagingCostKrw,
          shipping_cost_krw: sale.shippingCostKrw
        }),
      'addSale - insert sale',
      false // Auth already validated
    )

    if (!saleResult.success) {
      console.error('❌ 매출 데이터 삽입 실패:', saleResult.error)
      throw new Error(saleResult.error?.message || '매출 데이터 삽입에 실패했습니다.')
    }

    console.log('✅ 매출 데이터 삽입 완료')

    // Decrease stock using enhanced function with retry logic
    console.log('🔍 재고 감소 중...', { optionId: sale.optionId, quantity: sale.quantity })
    
    const stockResult = await withRetry(
      async () => {
        const { data, error } = await supabase.rpc('decrease_stock', {
          option_id: sale.optionId,
          quantity: sale.quantity
        })
        
        if (error) {
          throw error
        }
        
        return data
      },
      3, // Max retries
      1000 // Initial delay
    )

    console.log('🔍 재고 감소 결과:', stockResult)

    if (stockResult && !stockResult.success) {
      console.error('❌ 재고 감소 실패:', stockResult.error)
      // Try to rollback the sale if stock update failed
      await supabase
        .from('sales')
        .delete()
        .eq('product_id', sale.productId)
        .eq('option_id', sale.optionId)
        .eq('date', sale.date)
        .eq('quantity', sale.quantity)
        .eq('user_id', currentUserId)
      
      throw new Error(`재고 감소 실패: ${stockResult.error || '알 수 없는 오류'}`)
    }

    if (stockResult && stockResult.warning) {
      console.warn('⚠️ 재고 경고:', stockResult.warning)
    }

    console.log('✅ 재고 감소 완료:', {
      previousStock: stockResult?.previous_stock,
      newStock: stockResult?.new_stock,
      quantitySold: stockResult?.quantity_sold
    })
    console.log('✅ 매출 등록 완료')
    
  } catch (error) {
    console.error('❌ 매출 등록 실패:', error)
    throw error
  }
}

// Enhanced purchase functions with safe operations
export const getPurchases = async (): Promise<Purchase[]> => {
  console.log('🔍 매입 목록 조회 시작...')
  
  const result = await safeDbOperation(
    () => supabase
      .from('purchases')
      .select(`
        *,
        purchase_items (*)
      `)
      .order('date', { ascending: false }),
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

  const purchases = result.data.map(purchase => ({
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

export const addPurchase = async (purchase: Omit<Purchase, 'id'>): Promise<void> => {
  console.log('🔍 매입 등록 시작:', { 
    date: purchase.date,
    itemsCount: purchase.items.length 
  })

  // Validate authentication
  const authResult = await validateAuthentication()
  if (authResult.error) {
    console.error('❌ 매입 등록 인증 실패:', authResult.error)
    throw new Error(authResult.error.message)
  }

  const userId = authResult.user.id
  const purchaseId = generateId()

  try {
    // Create purchase with safe operation
    console.log('🔍 매입 생성 중...')
    const purchaseResult = await safeDbOperation(
      () => supabase
        .from('purchases')
        .insert({
          id: purchaseId,
          user_id: userId,
          date: purchase.date,
          shipping_cost_krw: purchase.shippingCostKrw,
          customs_fee_krw: purchase.customsFeeKrw,
          other_fee_krw: purchase.otherFeeKrw
        }),
      'addPurchase - create purchase',
      false // Auth already validated
    )

    if (!purchaseResult.success) {
      console.error('❌ 매입 생성 실패:', purchaseResult.error)
      throw new Error(purchaseResult.error?.message || '매입 생성에 실패했습니다.')
    }

    console.log('✅ 매입 생성 완료, 매입 아이템 생성 중...')

    // Create purchase items with safe operation
    const itemsData = purchase.items.map(item => ({
      purchase_id: purchaseId,
      product_id: item.productId,
      option_id: item.optionId,
      quantity: item.quantity,
      cost_cny_per_item: item.costCnyPerItem
    }))

    const itemsResult = await safeDbOperation(
      () => supabase
        .from('purchase_items')
        .insert(itemsData),
      'addPurchase - create items',
      false // Auth already validated
    )

    if (!itemsResult.success) {
      console.error('❌ 매입 아이템 생성 실패:', itemsResult.error)
      // Try to clean up the created purchase
      await supabase.from('purchases').delete().eq('id', purchaseId)
      throw new Error(itemsResult.error?.message || '매입 아이템 생성에 실패했습니다.')
    }

    console.log('✅ 매입 아이템 생성 완료, 재고 업데이트 중...')

    // Update inventory using enhanced function with retry logic
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
      3, // Max retries
      1000 // Initial delay
    )

    if (updateResult && !updateResult.success) {
      console.error('❌ 재고 업데이트 실패:', updateResult.error)
      throw new Error(`재고 업데이트 실패: ${updateResult.error || '알 수 없는 오류'}`)
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
  
  // Validate authentication
  const authResult = await validateAuthentication()
  if (authResult.error) {
    console.error('❌ 설정 조회 인증 실패:', authResult.error)
    // Return default settings if authentication fails
    console.log('⚠️ 인증 실패로 기본 설정 반환')
    return {
      defaultPackagingCostKrw: 1000,
      defaultShippingCostKrw: 3000
    }
  }

  const result = await safeDbOperation(
    () => supabase
      .from('app_settings')
      .select('*')
      .eq('user_id', authResult.user.id)
      .maybeSingle(),
    'getSettings',
    false // Auth already validated
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
    console.log('⚠️ 설정 데이터가 없어 기본값 반환')
    return {
      defaultPackagingCostKrw: 1000,
      defaultShippingCostKrw: 3000
    }
  }

  const settings = {
    defaultPackagingCostKrw: result.data.default_packaging_cost_krw,
    defaultShippingCostKrw: result.data.default_shipping_cost_krw
  }

  console.log('✅ 설정 조회 완료:', settings)
  return settings
}

export const updateSettings = async (settings: AppSettings): Promise<void> => {
  console.log('🔍 설정 업데이트 시작:', settings)
  
  // Validate authentication
  const authResult = await validateAuthentication()
  if (authResult.error) {
    console.error('❌ 설정 업데이트 인증 실패:', authResult.error)
    throw new Error(authResult.error.message)
  }

  const result = await safeDbOperation(
    () => supabase
      .from('app_settings')
      .upsert({
        user_id: authResult.user.id,
        default_packaging_cost_krw: settings.defaultPackagingCostKrw,
        default_shipping_cost_krw: settings.defaultShippingCostKrw
      }),
    'updateSettings',
    false // Auth already validated
  )

  if (!result.success) {
    console.error('❌ 설정 업데이트 실패:', result.error)
    throw new Error(result.error?.message || '설정 업데이트에 실패했습니다.')
  }

  console.log('✅ 설정 업데이트 완료')
}

// Enhanced product option update with safe operations
export const updateProductOption = async (productId: string, optionId: string, updates: Partial<ProductOption>): Promise<void> => {
  console.log('🔍 상품 옵션 업데이트 시작:', { productId, optionId, updates })
  
  const result = await safeDbOperation(
    () => supabase
      .from('product_options')
      .update({
        recommended_price: updates.recommendedPrice,
        cost_of_goods: updates.costOfGoods,
        stock: updates.stock,
        updated_at: new Date().toISOString()
      })
      .eq('id', optionId),
    'updateProductOption',
    true
  )

  if (!result.success) {
    console.error('❌ 상품 옵션 업데이트 실패:', result.error)
    throw new Error(result.error?.message || '상품 옵션 업데이트에 실패했습니다.')
  }

  console.log('✅ 상품 옵션 업데이트 완료')
}
// Progress tracking interface for sample data creation
export interface SampleDataProgress {
  step: string
  current: number
  total: number
  message: string
  error?: string
  isComplete?: boolean
}

// Progress callback type
export type ProgressCallback = (progress: SampleDataProgress) => void

// Sample data creation result interface
export interface SampleDataResult {
  success: boolean
  message: string
  createdData?: {
    products: number
    options: number
    purchases: number
    purchaseItems: number
    sales: number
  }
  error?: string
}

// Enhanced sample data creation with comprehensive error handling and progress tracking
export const createSampleDataSafe = withUserContextValidation(
  async (userId: string, onProgress?: ProgressCallback): Promise<SampleDataResult> => {
    console.log('🔍 안전한 샘플 데이터 생성 시작...')
    
    // Track created resources for rollback
    const createdResources = {
      products: [] as string[],
      options: [] as string[],
      purchases: [] as string[],
      purchaseItems: [] as string[],
      sales: [] as string[]
    }

    // Progress tracking
    const totalSteps = 8
    let currentStep = 0

    const updateProgress = (step: string, message: string, error?: string) => {
      currentStep++
      const progress: SampleDataProgress = {
        step,
        current: currentStep,
        total: totalSteps,
        message,
        error
      }
      console.log(`📊 진행률 ${currentStep}/${totalSteps}: ${step} - ${message}`)
      if (error) {
        console.error(`❌ 오류: ${error}`)
      }
      onProgress?.(progress)
    }

    // Rollback function for cleanup on failure
    const rollbackCreatedData = async (): Promise<void> => {
      console.log('🔄 생성된 데이터 롤백 시작...')
      
      try {
        // Delete in reverse order of creation
        if (createdResources.sales.length > 0) {
          console.log('🔄 매출 데이터 롤백 중...')
          await supabase.from('sales').delete().in('id', createdResources.sales)
        }
        
        if (createdResources.purchaseItems.length > 0) {
          console.log('🔄 매입 아이템 롤백 중...')
          await supabase.from('purchase_items').delete().in('id', createdResources.purchaseItems)
        }
        
        if (createdResources.purchases.length > 0) {
          console.log('🔄 매입 데이터 롤백 중...')
          await supabase.from('purchases').delete().in('id', createdResources.purchases)
        }
        
        if (createdResources.options.length > 0) {
          console.log('🔄 상품 옵션 롤백 중...')
          await supabase.from('product_options').delete().in('id', createdResources.options)
        }
        
        if (createdResources.products.length > 0) {
          console.log('🔄 상품 데이터 롤백 중...')
          await supabase.from('products').delete().in('id', createdResources.products)
        }
        
        console.log('✅ 롤백 완료')
      } catch (rollbackError) {
        console.error('❌ 롤백 중 오류 발생:', rollbackError)
        // Don't throw here as we're already in error handling
      }
    }

    try {
      const currentUserId = userId
      console.log('✅ 사용자 컨텍스트 검증 완료, 사용자 ID:', currentUserId)

      updateProgress('validation', '사용자 인증 및 권한 확인 완료')

      // Step 1: Validate existing data (optional check)
      updateProgress('check', '기존 데이터 확인 중...')
      
      try {
        const existingProducts = await supabase
          .from('products')
          .select('id, name')
          .eq('user_id', currentUserId)
          .limit(5)
        
        if (existingProducts.data && existingProducts.data.length > 0) {
          console.log(`⚠️ 기존 상품 ${existingProducts.data.length}개 발견. 중복 데이터가 생성될 수 있습니다.`)
        }
      } catch (checkError) {
        console.warn('⚠️ 기존 데이터 확인 실패 (무시하고 계속):', checkError)
      }

      // Step 2: Create sample products with validation
      updateProgress('products', '샘플 상품 생성 중...')
      
      const product1Id = generateId()
      const product2Id = generateId()
      
      // Validate product data before creation
      const productData = [
        {
          id: product1Id,
          user_id: currentUserId,
          name: '면 셔츠',
          chinese_name: '棉质衬衫',
          source_url: 'https://detail.1688.com/offer/example1.html',
          image_url: 'https://via.placeholder.com/300x300/4F46E5/FFFFFF?text=면+셔츠',
          base_cost_cny: 25.50
        },
        {
          id: product2Id,
          user_id: currentUserId,
          name: '청바지',
          chinese_name: '牛仔裤',
          source_url: 'https://detail.1688.com/offer/example2.html',
          image_url: 'https://via.placeholder.com/300x300/1F2937/FFFFFF?text=청바지',
          base_cost_cny: 45.00
        }
      ]

      // Validate product data integrity
      for (const product of productData) {
        if (!product.name || !product.chinese_name || product.base_cost_cny <= 0) {
          throw new Error(`상품 데이터 유효성 검사 실패: ${product.name}`)
        }
      }

      console.log('🔍 상품 데이터 검증 완료, 생성 시작...')

      // Create products one by one with detailed error handling
      for (let i = 0; i < productData.length; i++) {
        const product = productData[i]
        console.log(`🔍 상품 ${i + 1}/${productData.length} 생성 중: ${product.name}`)
        
        const productResult = await safeDbOperation(
          () => supabase.from('products').insert(product),
          `createSampleData - product ${i + 1} (${product.name})`,
          false // Auth already validated
        )

        if (!productResult.success) {
          const errorMsg = `상품 "${product.name}" 생성 실패: ${productResult.error?.message}`
          console.error('❌', errorMsg)
          throw new Error(errorMsg)
        }

        createdResources.products.push(product.id)
        console.log(`✅ 상품 "${product.name}" 생성 완료`)
      }

      // Step 3: Create product options with validation
      updateProgress('options', '상품 옵션 생성 중...')
      
      const options = [
        // Cotton shirt options
        { id: generateId(), product_id: product1Id, name: '화이트 / M', sku: 'SHIRT-WH-M', stock: 15, cost_of_goods: 8500, recommended_price: 25000 },
        { id: generateId(), product_id: product1Id, name: '화이트 / L', sku: 'SHIRT-WH-L', stock: 12, cost_of_goods: 8500, recommended_price: 25000 },
        { id: generateId(), product_id: product1Id, name: '블랙 / M', sku: 'SHIRT-BK-M', stock: 8, cost_of_goods: 8500, recommended_price: 25000 },
        { id: generateId(), product_id: product1Id, name: '블랙 / L', sku: 'SHIRT-BK-L', stock: 10, cost_of_goods: 8500, recommended_price: 25000 },

        // Jeans options
        { id: generateId(), product_id: product2Id, name: '인디고 / 28', sku: 'JEANS-IN-28', stock: 6, cost_of_goods: 15000, recommended_price: 45000 },
        { id: generateId(), product_id: product2Id, name: '인디고 / 30', sku: 'JEANS-IN-30', stock: 8, cost_of_goods: 15000, recommended_price: 45000 },
        { id: generateId(), product_id: product2Id, name: '인디고 / 32', sku: 'JEANS-IN-32', stock: 5, cost_of_goods: 15000, recommended_price: 45000 },
        { id: generateId(), product_id: product2Id, name: '블랙 / 30', sku: 'JEANS-BK-30', stock: 4, cost_of_goods: 15000, recommended_price: 45000 }
      ]

      // Validate option data integrity
      for (const option of options) {
        if (!option.name || !option.sku || option.stock < 0 || option.cost_of_goods < 0 || option.recommended_price <= 0) {
          throw new Error(`옵션 데이터 유효성 검사 실패: ${option.name}`)
        }
      }

      console.log(`🔍 ${options.length}개 옵션 데이터 검증 완료, 생성 시작...`)
      
      const optionsResult = await safeDbOperation(
        () => supabase.from('product_options').insert(options),
        'createSampleData - product options',
        false // Auth already validated
      )
      
      if (!optionsResult.success) {
        const errorMsg = `상품 옵션 생성 실패: ${optionsResult.error?.message}`
        console.error('❌', errorMsg)
        throw new Error(errorMsg)
      }

      createdResources.options = options.map(opt => opt.id)
      console.log(`✅ ${options.length}개 상품 옵션 생성 완료`)

      // Step 4: Create sample purchase with validation
      updateProgress('purchase', '샘플 매입 데이터 생성 중...')
      
      const purchaseId = generateId()
      const purchaseData = {
        id: purchaseId,
        user_id: currentUserId,
        date: '2024-01-15',
        shipping_cost_krw: 120000,
        customs_fee_krw: 45000,
        other_fee_krw: 15000
      }

      // Validate purchase data
      if (!purchaseData.date || purchaseData.shipping_cost_krw < 0 || purchaseData.customs_fee_krw < 0) {
        throw new Error('매입 데이터 유효성 검사 실패')
      }

      console.log('🔍 매입 데이터 검증 완료, 생성 시작...')
      
      const purchaseResult = await safeDbOperation(
        () => supabase.from('purchases').insert(purchaseData),
        'createSampleData - purchase',
        false // Auth already validated
      )

      if (!purchaseResult.success) {
        const errorMsg = `매입 생성 실패: ${purchaseResult.error?.message}`
        console.error('❌', errorMsg)
        throw new Error(errorMsg)
      }

      createdResources.purchases.push(purchaseId)
      console.log('✅ 매입 데이터 생성 완료')

      // Step 5: Create purchase items with validation
      updateProgress('purchase-items', '매입 아이템 생성 중...')
      
      const purchaseItems = [
        { id: generateId(), purchase_id: purchaseId, product_id: product1Id, option_id: options[0].id, quantity: 20, cost_cny_per_item: 25.50 },
        { id: generateId(), purchase_id: purchaseId, product_id: product1Id, option_id: options[1].id, quantity: 15, cost_cny_per_item: 25.50 },
        { id: generateId(), purchase_id: purchaseId, product_id: product1Id, option_id: options[2].id, quantity: 12, cost_cny_per_item: 25.50 },
        { id: generateId(), purchase_id: purchaseId, product_id: product1Id, option_id: options[3].id, quantity: 15, cost_cny_per_item: 25.50 },
        { id: generateId(), purchase_id: purchaseId, product_id: product2Id, option_id: options[4].id, quantity: 10, cost_cny_per_item: 45.00 },
        { id: generateId(), purchase_id: purchaseId, product_id: product2Id, option_id: options[5].id, quantity: 12, cost_cny_per_item: 45.00 },
        { id: generateId(), purchase_id: purchaseId, product_id: product2Id, option_id: options[6].id, quantity: 8, cost_cny_per_item: 45.00 },
        { id: generateId(), purchase_id: purchaseId, product_id: product2Id, option_id: options[7].id, quantity: 6, cost_cny_per_item: 45.00 }
      ]

      // Validate purchase items data
      for (const item of purchaseItems) {
        if (!item.product_id || !item.option_id || item.quantity <= 0 || item.cost_cny_per_item <= 0) {
          throw new Error(`매입 아이템 데이터 유효성 검사 실패`)
        }
      }

      console.log(`🔍 ${purchaseItems.length}개 매입 아이템 데이터 검증 완료, 생성 시작...`)
      
      const purchaseItemsResult = await safeDbOperation(
        () => supabase.from('purchase_items').insert(purchaseItems),
        'createSampleData - purchase items',
        false // Auth already validated
      )
      
      if (!purchaseItemsResult.success) {
        const errorMsg = `매입 아이템 생성 실패: ${purchaseItemsResult.error?.message}`
        console.error('❌', errorMsg)
        throw new Error(errorMsg)
      }

      createdResources.purchaseItems = purchaseItems.map(item => item.id)
      console.log(`✅ ${purchaseItems.length}개 매입 아이템 생성 완료`)

      // Step 6: Update inventory from purchase
      updateProgress('inventory', '재고 업데이트 중...')
      
      console.log('🔍 재고 업데이트 시작...')
      const inventoryResult = await withRetry(
        async () => {
          const { data, error } = await supabase.rpc('update_inventory_from_purchase', { 
            purchase_id: purchaseId 
          })
          if (error) throw error
          return data
        },
        3, // Max retries
        1000 // Initial delay
      )
      
      if (inventoryResult && !inventoryResult.success) {
        const errorMsg = `재고 업데이트 실패: ${inventoryResult.error || '알 수 없는 오류'}`
        console.error('❌', errorMsg)
        throw new Error(errorMsg)
      }
      
      console.log('✅ 재고 업데이트 완료:', inventoryResult)

      // Step 7: Create sample sales with validation
      updateProgress('sales', '샘플 매출 데이터 생성 중...')
      
      const salesData = [
        {
          id: generateId(),
          user_id: currentUserId,
          product_id: product1Id,
          option_id: options[0].id,
          date: '2024-01-20',
          quantity: 2,
          sale_price_per_item: 24000,
          channel: '스마트스토어',
          channel_fee_percentage: 3.5,
          packaging_cost_krw: 1000,
          shipping_cost_krw: 3000
        },
        {
          id: generateId(),
          user_id: currentUserId,
          product_id: product1Id,
          option_id: options[1].id,
          date: '2024-01-22',
          quantity: 1,
          sale_price_per_item: 25000,
          channel: '쿠팡',
          channel_fee_percentage: 8.0,
          packaging_cost_krw: 1000,
          shipping_cost_krw: 0
        },
        {
          id: generateId(),
          user_id: currentUserId,
          product_id: product1Id,
          option_id: options[2].id,
          date: '2024-01-25',
          quantity: 3,
          sale_price_per_item: 23000,
          channel: '스마트스토어',
          channel_fee_percentage: 3.5,
          packaging_cost_krw: 1000,
          shipping_cost_krw: 3000
        },
        {
          id: generateId(),
          user_id: currentUserId,
          product_id: product2Id,
          option_id: options[4].id,
          date: '2024-01-28',
          quantity: 1,
          sale_price_per_item: 44000,
          channel: '자사몰',
          channel_fee_percentage: 0,
          packaging_cost_krw: 1500,
          shipping_cost_krw: 3000
        },
        {
          id: generateId(),
          user_id: currentUserId,
          product_id: product2Id,
          option_id: options[5].id,
          date: '2024-02-01',
          quantity: 2,
          sale_price_per_item: 43000,
          channel: '쿠팡',
          channel_fee_percentage: 8.0,
          packaging_cost_krw: 1500,
          shipping_cost_krw: 0
        }
      ]

      // Validate sales data
      for (const sale of salesData) {
        if (!sale.product_id || !sale.option_id || !sale.date || sale.quantity <= 0 || sale.sale_price_per_item <= 0) {
          throw new Error(`매출 데이터 유효성 검사 실패`)
        }
      }

      console.log(`🔍 ${salesData.length}개 매출 데이터 검증 완료, 생성 시작...`)

      // Create sales one by one with stock updates
      for (let i = 0; i < salesData.length; i++) {
        const sale = salesData[i]
        console.log(`🔍 매출 ${i + 1}/${salesData.length} 생성 중...`)
        
        const saleResult = await safeDbOperation(
          () => supabase.from('sales').insert(sale),
          `createSampleData - sale ${i + 1}`,
          false // Auth already validated
        )
        
        if (!saleResult.success) {
          const errorMsg = `매출 ${i + 1} 생성 실패: ${saleResult.error?.message}`
          console.error('❌', errorMsg)
          throw new Error(errorMsg)
        }
        
        createdResources.sales.push(sale.id)
        
        // Update stock with retry logic
        console.log(`🔍 매출 ${i + 1} 재고 감소 중...`)
        await withRetry(
          async () => {
            const { data, error } = await supabase.rpc('decrease_stock', {
              option_id: sale.option_id,
              quantity: sale.quantity
            })
            if (error) throw error
            return data
          },
          3, // Max retries
          1000 // Initial delay
        )
        
        console.log(`✅ 매출 ${i + 1} 생성 및 재고 업데이트 완료`)
      }

      // Step 8: Final validation and completion
      updateProgress('completion', '샘플 데이터 생성 완료!')
      
      console.log('🔍 최종 데이터 무결성 검사...')
      
      // Verify created data exists and is accessible
      const finalProducts = await supabase
        .from('products')
        .select('id, name')
        .in('id', createdResources.products)
      
      if (!finalProducts.data || finalProducts.data.length !== createdResources.products.length) {
        throw new Error('생성된 상품 데이터 검증 실패')
      }

      console.log('✅ 모든 샘플 데이터 생성이 성공적으로 완료되었습니다!')
      console.log('📊 생성된 데이터 요약:')
      console.log(`  - 상품: ${createdResources.products.length}개`)
      console.log(`  - 상품 옵션: ${createdResources.options.length}개`)
      console.log(`  - 매입: ${createdResources.purchases.length}건`)
      console.log(`  - 매입 아이템: ${createdResources.purchaseItems.length}개`)
      console.log(`  - 매출: ${createdResources.sales.length}건`)

      // Final progress update with completion
      updateProgress('completion', '샘플 데이터 생성 완료!', undefined)
      onProgress?.({
        step: 'completion',
        current: totalSteps,
        total: totalSteps,
        message: '샘플 데이터 생성 완료!',
        isComplete: true
      })

      return {
        success: true,
        message: '샘플 데이터가 성공적으로 생성되었습니다.',
        createdData: {
          products: createdResources.products.length,
          options: createdResources.options.length,
          purchases: createdResources.purchases.length,
          purchaseItems: createdResources.purchaseItems.length,
          sales: createdResources.sales.length
        }
      }

    } catch (error) {
      console.error('❌ 샘플 데이터 생성 실패:', error)
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Update progress with error
      updateProgress('error', '샘플 데이터 생성 실패', errorMessage)
      
      // Attempt rollback
      console.log('🔄 실패로 인한 롤백 시작...')
      await rollbackCreatedData()
      
      return {
        success: false,
        message: '샘플 데이터 생성에 실패했습니다.',
        error: errorMessage
      }
    }
  },
  'createSampleDataSafe',
  true // Require authentication
)

// Legacy function for backward compatibility
export const createSampleData = createSampleDataSafe

// Enhanced delete all data with comprehensive user context validation
export const deleteAllData = withUserContextValidation(
  async (userId: string): Promise<void> => {
    console.log('🔍 완전 초기화 시작...')
    
    try {
      // Use the validated user ID
      const currentUserId = userId
      console.log('✅ 사용자 컨텍스트 검증 완료, 사용자 ID:', currentUserId)

      // Delete in proper order to respect foreign key constraints
      const deletionSteps = [
        { name: '매출 데이터', table: 'sales' },
        { name: '매입 아이템', table: 'purchase_items' },
        { name: '매입 데이터', table: 'purchases' },
        { name: '상품 옵션', table: 'product_options' },
        { name: '상품 데이터', table: 'products' },
        { name: '앱 설정', table: 'app_settings' }
      ]

      for (const step of deletionSteps) {
        console.log(`🔍 ${step.name} 삭제 중...`)
        
        const deleteResult = await safeDbOperation(
          () => supabase.from(step.table).delete().eq('user_id', currentUserId),
          `deleteAllData - ${step.name}`,
          false // Auth already validated
        )

        if (!deleteResult.success) {
          console.error(`❌ ${step.name} 삭제 실패:`, deleteResult.error)
          throw new Error(deleteResult.error?.message || `${step.name} 삭제에 실패했습니다.`)
        }

        console.log(`✅ ${step.name} 삭제 완료`)
      }

      console.log('✅ 완전 초기화 완료!')
      
    } catch (error) {
      console.error('❌ 데이터 삭제 실패:', error)
      throw error
    }
  },
  'deleteAllData',
  true // Require authentication
)
    
    const { error: purchaseError } = await supabase.from('purchases').insert({
      id: purchaseId,
      user_id: currentUserId,
      date: '2024-01-15',
      shipping_cost_krw: 120000,
      customs_fee_krw: 45000,
      other_fee_krw: 15000
    })

    if (purchaseError) {
      console.error('매입 생성 오류:', purchaseError)
      throw purchaseError
    }

    // Purchase items
    const purchaseItems = [
      { purchase_id: purchaseId, product_id: product1Id, option_id: options[0].id, quantity: 20, cost_cny_per_item: 25.50 },
      { purchase_id: purchaseId, product_id: product1Id, option_id: options[1].id, quantity: 15, cost_cny_per_item: 25.50 },
      { purchase_id: purchaseId, product_id: product1Id, option_id: options[2].id, quantity: 12, cost_cny_per_item: 25.50 },
      { purchase_id: purchaseId, product_id: product1Id, option_id: options[3].id, quantity: 15, cost_cny_per_item: 25.50 },
      { purchase_id: purchaseId, product_id: product2Id, option_id: options[4].id, quantity: 10, cost_cny_per_item: 45.00 },
      { purchase_id: purchaseId, product_id: product2Id, option_id: options[5].id, quantity: 12, cost_cny_per_item: 45.00 },
      { purchase_id: purchaseId, product_id: product2Id, option_id: options[6].id, quantity: 8, cost_cny_per_item: 45.00 },
      { purchase_id: purchaseId, product_id: product2Id, option_id: options[7].id, quantity: 6, cost_cny_per_item: 45.00 }
    ]

    console.log('매입 아이템 생성 중...')
    const { error: purchaseItemsError } = await supabase.from('purchase_items').insert(purchaseItems)
    
    if (purchaseItemsError) {
      console.error('매입 아이템 생성 오류:', purchaseItemsError)
      throw purchaseItemsError
    }

    // Update inventory and costs
    console.log('재고 업데이트 중...')
    const { data: inventoryData, error: inventoryError } = await supabase.rpc('update_inventory_from_purchase', { purchase_id: purchaseId })
    
    if (inventoryError) {
      console.error('❌ 재고 업데이트 오류:', inventoryError)
      console.error('오류 세부사항:', JSON.stringify(inventoryError, null, 2))
      throw inventoryError
    }
    
    console.log('✅ 재고 업데이트 완료:', inventoryData)

    console.log('매입 데이터 생성 완료')

    // 4. Create sample sales
    console.log('매출 데이터 생성 중...')
    const sales = [
      {
        user_id: currentUserId,
        product_id: product1Id,
        option_id: options[0].id,
        date: '2024-01-20',
        quantity: 2,
        sale_price_per_item: 24000,
        channel: '스마트스토어',
        channel_fee_percentage: 3.5,
        packaging_cost_krw: 1000,
        shipping_cost_krw: 3000
      },
      {
        user_id: currentUserId,
        product_id: product1Id,
        option_id: options[1].id,
        date: '2024-01-22',
        quantity: 1,
        sale_price_per_item: 25000,
        channel: '쿠팡',
        channel_fee_percentage: 8.0,
        packaging_cost_krw: 1000,
        shipping_cost_krw: 0
      },
      {
        user_id: currentUserId,
        product_id: product1Id,
        option_id: options[2].id,
        date: '2024-01-25',
        quantity: 3,
        sale_price_per_item: 23000,
        channel: '스마트스토어',
        channel_fee_percentage: 3.5,
        packaging_cost_krw: 1000,
        shipping_cost_krw: 3000
      },
      {
        user_id: currentUserId,
        product_id: product2Id,
        option_id: options[4].id,
        date: '2024-01-28',
        quantity: 1,
        sale_price_per_item: 44000,
        channel: '자사몰',
        channel_fee_percentage: 0,
        packaging_cost_krw: 1500,
        shipping_cost_krw: 3000
      },
      {
        user_id: currentUserId,
        product_id: product2Id,
        option_id: options[5].id,
        date: '2024-02-01',
        quantity: 2,
        sale_price_per_item: 43000,
        channel: '쿠팡',
        channel_fee_percentage: 8.0,
        packaging_cost_krw: 1500,
        shipping_cost_krw: 0
      }
    ]

    for (let i = 0; i < sales.length; i++) {
      const sale = sales[i]
      console.log(`매출 ${i + 1}/${sales.length} 생성 중...`)
      
      const { error: saleError } = await supabase.from('sales').insert(sale)
      if (saleError) {
        console.error(`매출 ${i + 1} 생성 오류:`, saleError)
        throw saleError
      }
      
      // Decrease stock
      const { error: stockError } = await supabase.rpc('decrease_stock', {
        option_id: sale.option_id,
        quantity: sale.quantity
      })
      
      if (stockError) {
        console.error(`재고 감소 오류 (매출 ${i + 1}):`, stockError)
        throw stockError
      }
    }

    console.log('매출 데이터 생성 완료')
    console.log('✅ 모든 샘플 데이터 생성이 완료되었습니다!')

  } catch (error) {
    console.error('Sample data creation failed:', error)
    throw error
  }
}

// Enhanced delete all data with safe operations
export const deleteAllData = async (): Promise<void> => {
  console.log('🔍 완전 초기화 시작...')
  
  try {
    // Validate authentication
    const authResult = await validateAuthentication()
    if (authResult.error) {
      console.error('❌ 완전 초기화 인증 실패:', authResult.error)
      throw new Error(authResult.error.message)
    }

    // Delete in proper order to respect foreign key constraints
    const deletionSteps = [
      { name: '매출 데이터', table: 'sales' },
      { name: '매입 아이템', table: 'purchase_items' },
      { name: '매입 데이터', table: 'purchases' },
      { name: '상품 옵션', table: 'product_options' },
      { name: '상품 데이터', table: 'products' },
      { name: '앱 설정', table: 'app_settings' }
    ]

    for (const step of deletionSteps) {
      console.log(`🔍 ${step.name} 삭제 중...`)
      
      const deleteResult = await safeDbOperation(
        () => supabase.from(step.table).delete().neq('id', ''),
        `deleteAllData - ${step.name}`,
        false // Auth already validated
      )

      if (!deleteResult.success) {
        console.error(`❌ ${step.name} 삭제 실패:`, deleteResult.error)
        throw new Error(deleteResult.error?.message || `${step.name} 삭제에 실패했습니다.`)
      }

      console.log(`✅ ${step.name} 삭제 완료`)
    }

    console.log('✅ 완전 초기화 완료!')
    
  } catch (error) {
    console.error('❌ 데이터 삭제 실패:', error)
    throw error
  }
},
'deleteAllData',
true // Require authentication
)