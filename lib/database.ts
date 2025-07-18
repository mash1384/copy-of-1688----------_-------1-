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

  const productId = generateId()

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

  if (productError) throw productError

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

  if (optionsError) throw optionsError

  // 생성된 상품 반환
  const products = await getProducts()
  return products.find(p => p.id === productId)!
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

export const addSale = async (sale: Omit<Sale, 'id'>): Promise<void> => {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('사용자 인증이 필요합니다')

  const { error } = await supabase
    .from('sales')
    .insert({
      user_id: user.user.id,
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

  if (error) throw error

  // 재고 감소
  const { error: stockError } = await supabase.rpc('decrease_stock', {
    option_id: sale.optionId,
    quantity: sale.quantity
  })

  if (stockError) throw stockError
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
  const { error: updateError } = await supabase.rpc('update_inventory_from_purchase', {
    purchase_id: purchaseId
  })

  if (updateError) throw updateError
}

// 설정 관련 함수들
export const getSettings = async (): Promise<AppSettings> => {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('사용자 인증이 필요합니다')

  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('user_id', user.user.id)
    .single()

  if (error) {
    // 설정이 없으면 기본값 반환
    return {
      defaultPackagingCostKrw: 1000,
      defaultShippingCostKrw: 3000
    }
  }

  return {
    defaultPackagingCostKrw: data.default_packaging_cost_krw,
    defaultShippingCostKrw: data.default_shipping_cost_krw
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
export const createSampleData = async (): Promise<void> => {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('User authentication required')

  try {
    // 1. Create sample products
    const product1Id = generateId()
    const product2Id = generateId()

    // Product 1: Cotton Shirt
    await supabase.from('products').insert({
      id: product1Id,
      user_id: user.user.id,
      name: '면 셔츠',
      chinese_name: '棉质衬衫',
      source_url: 'https://detail.1688.com/offer/example1.html',
      image_url: 'https://via.placeholder.com/300x300/4F46E5/FFFFFF?text=면+셔츠',
      base_cost_cny: 25.50
    })

    // Product 2: Jeans
    await supabase.from('products').insert({
      id: product2Id,
      user_id: user.user.id,
      name: '청바지',
      chinese_name: '牛仔裤',
      source_url: 'https://detail.1688.com/offer/example2.html',
      image_url: 'https://via.placeholder.com/300x300/1F2937/FFFFFF?text=청바지',
      base_cost_cny: 45.00
    })

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

    await supabase.from('product_options').insert(options)

    // 3. Create sample purchase
    const purchaseId = generateId()
    await supabase.from('purchases').insert({
      id: purchaseId,
      user_id: user.user.id,
      date: '2024-01-15',
      shipping_cost_krw: 120000,
      customs_fee_krw: 45000,
      other_fee_krw: 15000
    })

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

    await supabase.from('purchase_items').insert(purchaseItems)

    // Update inventory and costs
    await supabase.rpc('update_inventory_from_purchase', { purchase_id: purchaseId })

    // 4. Create sample sales
    const sales = [
      {
        user_id: user.user.id,
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
        user_id: user.user.id,
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
        user_id: user.user.id,
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
        user_id: user.user.id,
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
        user_id: user.user.id,
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

    for (const sale of sales) {
      await supabase.from('sales').insert(sale)
      // Decrease stock
      await supabase.rpc('decrease_stock', {
        option_id: sale.option_id,
        quantity: sale.quantity
      })
    }

  } catch (error) {
    console.error('Sample data creation failed:', error)
    throw error
  }
}

// Delete all data
export const deleteAllData = async (): Promise<void> => {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('User authentication required')

  try {
    // Delete in order (due to foreign key constraints)
    await supabase.from('sales').delete().eq('user_id', user.user.id)

    // Get purchase IDs first, then delete purchase items
    const { data: purchases } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.user.id)

    if (purchases && purchases.length > 0) {
      const purchaseIds = purchases.map(p => p.id)
      await supabase.from('purchase_items').delete().in('purchase_id', purchaseIds)
    }

    await supabase.from('purchases').delete().eq('user_id', user.user.id)

    // Get product IDs first, then delete product options
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('user_id', user.user.id)

    if (products && products.length > 0) {
      const productIds = products.map(p => p.id)
      await supabase.from('product_options').delete().in('product_id', productIds)
    }

    await supabase.from('products').delete().eq('user_id', user.user.id)
  } catch (error) {
    console.error('Data deletion failed:', error)
    throw error
  }
}