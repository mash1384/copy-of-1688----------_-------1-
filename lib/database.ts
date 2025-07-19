import { supabase } from './supabase'
import { Product, ProductOption, Sale, Purchase, AppSettings, SalesChannel } from '../types'

// 유틸리티 함수
const generateId = () => crypto.randomUUID()

// 상품 관련 함수들
export const getProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_options (*)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data.map(product => ({
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
}

export const addProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('사용자 인증이 필요합니다')

  console.log('상품 등록 시작:', { 
    userId: user.user.id, 
    productName: product.name,
    optionsCount: product.options.length 
  })

  const productId = generateId()

  try {
    // 상품 생성
    const { error: productError } = await supabase
      .from('products')
      .insert({
        id: productId,
        user_id: user.user.id,
        name: product.name,
        chinese_name: product.chineseName,
        source_url: product.sourceUrl,
        image_url: product.imageUrl,
        base_cost_cny: product.baseCostCny
      })

    if (productError) {
      console.error('상품 생성 오류:', productError)
      throw productError
    }

    console.log('상품 생성 완료, 옵션 생성 중...')

    // 옵션들 생성
    const optionsData = product.options.map(option => ({
      id: generateId(),
      product_id: productId,
      name: option.name,
      sku: option.sku,
      stock: option.stock || 0,
      cost_of_goods: option.costOfGoods || 0,
      recommended_price: option.recommendedPrice
    }))

    const { error: optionsError } = await supabase
      .from('product_options')
      .insert(optionsData)

    if (optionsError) {
      console.error('상품 옵션 생성 오류:', optionsError)
      throw optionsError
    }

    console.log('상품 옵션 생성 완료')

    // 생성된 상품 반환
    const products = await getProducts()
    const newProduct = products.find(p => p.id === productId)
    
    if (!newProduct) {
      throw new Error('생성된 상품을 찾을 수 없습니다')
    }

    console.log('상품 등록 완료:', newProduct.name)
    return newProduct
  } catch (error) {
    console.error('상품 등록 실패:', error)
    throw error
  }
}

export const updateProduct = async (product: Product): Promise<void> => {
  // 상품 정보 업데이트
  const { error: productError } = await supabase
    .from('products')
    .update({
      name: product.name,
      chinese_name: product.chineseName,
      source_url: product.sourceUrl,
      image_url: product.imageUrl,
      base_cost_cny: product.baseCostCny
    })
    .eq('id', product.id)

  if (productError) throw productError

  // 기존 옵션들 삭제
  const { error: deleteError } = await supabase
    .from('product_options')
    .delete()
    .eq('product_id', product.id)

  if (deleteError) throw deleteError

  // 새 옵션들 생성
  const optionsData = product.options.map(option => ({
    id: option.id || generateId(),
    product_id: product.id,
    name: option.name,
    sku: option.sku,
    stock: option.stock,
    cost_of_goods: option.costOfGoods,
    recommended_price: option.recommendedPrice
  }))

  const { error: optionsError } = await supabase
    .from('product_options')
    .insert(optionsData)

  if (optionsError) throw optionsError
}

export const deleteProduct = async (productId: string): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)

  if (error) throw error
}

// 매출 관련 함수들
export const getSales = async (): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('date', { ascending: false })

  if (error) throw error

  return data.map(sale => ({
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
}

export const addSale = async (sale: Omit<Sale, 'id'>, userId?: string): Promise<void> => {
  console.log('🔍 매출 등록 시작:', { productId: sale.productId, optionId: sale.optionId, quantity: sale.quantity })
  
  let currentUserId = userId
  
  if (!currentUserId) {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('사용자 인증이 필요합니다')
    currentUserId = user.user.id
  }

  try {
    console.log('🔍 매출 데이터 삽입 중...')
    const { error } = await supabase
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
      })

    if (error) {
      console.error('❌ 매출 데이터 삽입 오류:', error)
      throw error
    }

    console.log('✅ 매출 데이터 삽입 완료')

    // 재고 감소
    console.log('🔍 재고 감소 중...', { optionId: sale.optionId, quantity: sale.quantity })
    const { data: stockResult, error: stockError } = await supabase.rpc('decrease_stock', {
      option_id: sale.optionId,
      quantity: sale.quantity
    })

    if (stockError) {
      console.error('❌ 재고 감소 RPC 오류:', stockError)
      console.error('재고 감소 오류 세부사항:', JSON.stringify(stockError, null, 2))
      throw stockError
    }

    console.log('🔍 재고 감소 결과:', stockResult)

    if (stockResult && !stockResult.success) {
      console.error('❌ 재고 감소 실패:', stockResult.error)
      throw new Error(`재고 감소 실패: ${stockResult.error}`)
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

// 매입 관련 함수들
export const getPurchases = async (): Promise<Purchase[]> => {
  const { data, error } = await supabase
    .from('purchases')
    .select(`
      *,
      purchase_items (*)
    `)
    .order('date', { ascending: false })

  if (error) throw error

  return data.map(purchase => ({
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
}

export const addPurchase = async (purchase: Omit<Purchase, 'id'>): Promise<void> => {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('사용자 인증이 필요합니다')

  const purchaseId = generateId()

  // 매입 생성
  const { error: purchaseError } = await supabase
    .from('purchases')
    .insert({
      id: purchaseId,
      user_id: user.user.id,
      date: purchase.date,
      shipping_cost_krw: purchase.shippingCostKrw,
      customs_fee_krw: purchase.customsFeeKrw,
      other_fee_krw: purchase.otherFeeKrw
    })

  if (purchaseError) throw purchaseError

  // 매입 아이템들 생성
  const itemsData = purchase.items.map(item => ({
    purchase_id: purchaseId,
    product_id: item.productId,
    option_id: item.optionId,
    quantity: item.quantity,
    cost_cny_per_item: item.costCnyPerItem
  }))

  const { error: itemsError } = await supabase
    .from('purchase_items')
    .insert(itemsData)

  if (itemsError) throw itemsError

  // 재고 및 원가 업데이트 (복잡한 로직이므로 stored procedure 사용)
  const { data: updateResult, error: updateError } = await supabase.rpc('update_inventory_from_purchase', {
    purchase_id: purchaseId
  })

  if (updateError) throw updateError
  
  if (updateResult && !updateResult.success) {
    throw new Error(`재고 업데이트 실패: ${updateResult.error}`)
  }
}

// 설정 관련 함수들
export const getSettings = async (): Promise<AppSettings> => {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('사용자 인증이 필요합니다')

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('user_id', user.user.id)
      .maybeSingle() // single() 대신 maybeSingle() 사용

    if (error) {
      console.error('설정 조회 오류:', error)
      // 설정이 없으면 기본값 반환
      return {
        defaultPackagingCostKrw: 1000,
        defaultShippingCostKrw: 3000
      }
    }

    if (!data) {
      // 데이터가 없으면 기본값 반환
      return {
        defaultPackagingCostKrw: 1000,
        defaultShippingCostKrw: 3000
      }
    }

    return {
      defaultPackagingCostKrw: data.default_packaging_cost_krw,
      defaultShippingCostKrw: data.default_shipping_cost_krw
    }
  } catch (error) {
    console.error('설정 조회 예외:', error)
    return {
      defaultPackagingCostKrw: 1000,
      defaultShippingCostKrw: 3000
    }
  }
}

export const updateSettings = async (settings: AppSettings): Promise<void> => {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('사용자 인증이 필요합니다')

  const { error } = await supabase
    .from('app_settings')
    .upsert({
      user_id: user.user.id,
      default_packaging_cost_krw: settings.defaultPackagingCostKrw,
      default_shipping_cost_krw: settings.defaultShippingCostKrw
    })

  if (error) throw error
}

// 상품 옵션 업데이트 (마진 계산기용)
export const updateProductOption = async (productId: string, optionId: string, updates: Partial<ProductOption>): Promise<void> => {
  const { error } = await supabase
    .from('product_options')
    .update({
      recommended_price: updates.recommendedPrice,
      cost_of_goods: updates.costOfGoods,
      stock: updates.stock
    })
    .eq('id', optionId)

  if (error) throw error
}
// Sample data creation
export const createSampleData = async (userId?: string): Promise<void> => {
  console.log('🔍 createSampleData 함수 시작')
  
  try {
    let currentUserId = userId
    
    if (!currentUserId) {
      console.log('🔍 사용자 인증 확인 중...')
      
      const { data: user, error: userError } = await supabase.auth.getUser()
      
      console.log('🔍 사용자 인증 응답 받음:', { hasUser: !!user?.user, error: !!userError })
      
      if (userError) {
        console.error('❌ 사용자 인증 오류:', userError)
        throw userError
      }
      
      if (!user?.user) {
        console.error('❌ 사용자 정보 없음:', user)
        throw new Error('사용자 인증이 필요합니다')
      }
      
      currentUserId = user.user.id
    }
    
    console.log('✅ 사용자 인증 성공, 사용자 ID:', currentUserId)
    console.log('🔍 샘플 데이터 생성 시작, 사용자 ID:', currentUserId)

    // 기존 샘플 데이터 확인 건너뛰기 (RLS 정책 문제로 인해)
    console.log('⚠️ 기존 데이터 확인 건너뛰고 바로 샘플 데이터 생성 시작')
    console.log('💡 중복 데이터가 생성될 수 있으니 먼저 "완전 초기화"를 실행하는 것을 권장합니다')

    // 1. Create sample products
    const product1Id = generateId()
    const product2Id = generateId()

    console.log('상품 생성 중...', { product1Id, product2Id })

    try {
      // Product 1: Cotton Shirt
      console.log('🔍 상품 1 생성 시도...')
      
      const { error: product1Error } = await supabase.from('products').insert({
        id: product1Id,
        user_id: currentUserId,
        name: '면 셔츠',
        chinese_name: '棉质衬衫',
        source_url: 'https://detail.1688.com/offer/example1.html',
        image_url: 'https://via.placeholder.com/300x300/4F46E5/FFFFFF?text=면+셔츠',
        base_cost_cny: 25.50
      })

      if (product1Error) {
        console.error('❌ 상품 1 생성 오류:', product1Error)
        console.error('오류 세부사항:', JSON.stringify(product1Error, null, 2))
        throw product1Error
      }

      console.log('✅ 상품 1 생성 완료')

      // Product 2: Jeans
      console.log('🔍 상품 2 생성 시도...')
      
      const { error: product2Error } = await supabase.from('products').insert({
        id: product2Id,
        user_id: currentUserId,
        name: '청바지',
        chinese_name: '牛仔裤',
        source_url: 'https://detail.1688.com/offer/example2.html',
        image_url: 'https://via.placeholder.com/300x300/1F2937/FFFFFF?text=청바지',
        base_cost_cny: 45.00
      })

      if (product2Error) {
        console.error('❌ 상품 2 생성 오류:', product2Error)
        console.error('오류 세부사항:', JSON.stringify(product2Error, null, 2))
        throw product2Error
      }

      console.log('✅ 상품 2 생성 완료')
      console.log('✅ 모든 상품 생성 완료')
    } catch (error) {
      console.error('❌ 상품 생성 실패:', error)
      throw error
    }

    // 2. Create product options
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

    console.log('상품 옵션 생성 중...')
    const { error: optionsError } = await supabase.from('product_options').insert(options)
    
    if (optionsError) {
      console.error('상품 옵션 생성 오류:', optionsError)
      throw optionsError
    }

    console.log('상품 옵션 생성 완료')

    // 3. Create sample purchase
    const purchaseId = generateId()
    console.log('매입 데이터 생성 중...')
    
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

// Delete all data
export const deleteAllData = async (): Promise<void> => {
  console.log('🔍 완전 초기화 시작...')
  
  try {
    // RLS가 비활성화되어 있으므로 모든 데이터를 삭제할 수 있습니다
    console.log('🔍 매출 데이터 삭제 중...')
    const { error: salesError } = await supabase.from('sales').delete().neq('id', '')
    if (salesError) {
      console.error('매출 삭제 오류:', salesError)
      throw salesError
    }

    console.log('🔍 매입 아이템 삭제 중...')
    const { error: purchaseItemsError } = await supabase.from('purchase_items').delete().neq('id', '')
    if (purchaseItemsError) {
      console.error('매입 아이템 삭제 오류:', purchaseItemsError)
      throw purchaseItemsError
    }

    console.log('🔍 매입 데이터 삭제 중...')
    const { error: purchasesError } = await supabase.from('purchases').delete().neq('id', '')
    if (purchasesError) {
      console.error('매입 삭제 오류:', purchasesError)
      throw purchasesError
    }

    console.log('🔍 상품 옵션 삭제 중...')
    const { error: optionsError } = await supabase.from('product_options').delete().neq('id', '')
    if (optionsError) {
      console.error('상품 옵션 삭제 오류:', optionsError)
      throw optionsError
    }

    console.log('🔍 상품 데이터 삭제 중...')
    const { error: productsError } = await supabase.from('products').delete().neq('id', '')
    if (productsError) {
      console.error('상품 삭제 오류:', productsError)
      throw productsError
    }

    console.log('🔍 앱 설정 삭제 중...')
    const { error: settingsError } = await supabase.from('app_settings').delete().neq('id', '')
    if (settingsError) {
      console.error('설정 삭제 오류:', settingsError)
      throw settingsError
    }

    console.log('✅ 완전 초기화 완료!')
  } catch (error) {
    console.error('❌ 데이터 삭제 실패:', error)
    throw error
  }
}