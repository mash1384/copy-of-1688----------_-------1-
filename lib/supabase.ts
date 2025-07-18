import { createClient } from '@supabase/supabase-js'

// Supabase 설정
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL과 Anon Key가 필요합니다. .env.local 파일을 확인해주세요.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 타입 정의
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          photo_url: string | null
          provider: string
          created_at: string
          last_login_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          photo_url?: string | null
          provider: string
          created_at?: string
          last_login_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          photo_url?: string | null
          provider?: string
          created_at?: string
          last_login_at?: string
        }
      }
      products: {
        Row: {
          id: string
          user_id: string
          name: string
          chinese_name: string | null
          source_url: string | null
          image_url: string
          base_cost_cny: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          chinese_name?: string | null
          source_url?: string | null
          image_url: string
          base_cost_cny: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          chinese_name?: string | null
          source_url?: string | null
          image_url?: string
          base_cost_cny?: number
          created_at?: string
          updated_at?: string
        }
      }
      product_options: {
        Row: {
          id: string
          product_id: string
          name: string
          sku: string
          stock: number
          cost_of_goods: number
          recommended_price: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          name: string
          sku: string
          stock?: number
          cost_of_goods?: number
          recommended_price?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          name?: string
          sku?: string
          stock?: number
          cost_of_goods?: number
          recommended_price?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          user_id: string
          product_id: string
          option_id: string
          date: string
          quantity: number
          sale_price_per_item: number
          channel: string
          channel_fee_percentage: number
          packaging_cost_krw: number
          shipping_cost_krw: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          option_id: string
          date: string
          quantity: number
          sale_price_per_item: number
          channel: string
          channel_fee_percentage: number
          packaging_cost_krw: number
          shipping_cost_krw: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          option_id?: string
          date?: string
          quantity?: number
          sale_price_per_item?: number
          channel?: string
          channel_fee_percentage?: number
          packaging_cost_krw?: number
          shipping_cost_krw?: number
          created_at?: string
        }
      }
      purchases: {
        Row: {
          id: string
          user_id: string
          date: string
          shipping_cost_krw: number
          customs_fee_krw: number
          other_fee_krw: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          shipping_cost_krw: number
          customs_fee_krw: number
          other_fee_krw: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          shipping_cost_krw?: number
          customs_fee_krw?: number
          other_fee_krw?: number
          created_at?: string
        }
      }
      purchase_items: {
        Row: {
          id: string
          purchase_id: string
          product_id: string
          option_id: string
          quantity: number
          cost_cny_per_item: number
          created_at: string
        }
        Insert: {
          id?: string
          purchase_id: string
          product_id: string
          option_id: string
          quantity: number
          cost_cny_per_item: number
          created_at?: string
        }
        Update: {
          id?: string
          purchase_id?: string
          product_id?: string
          option_id?: string
          quantity?: number
          cost_cny_per_item?: number
          created_at?: string
        }
      }
      app_settings: {
        Row: {
          id: string
          user_id: string
          default_packaging_cost_krw: number
          default_shipping_cost_krw: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          default_packaging_cost_krw: number
          default_shipping_cost_krw: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          default_packaging_cost_krw?: number
          default_shipping_cost_krw?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// 인증 관련 함수들
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}`
    }
  })
  
  if (error) throw error
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// 사용자 데이터 생성/업데이트
export const createOrUpdateUser = async (user: any) => {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      email: user.email || '',
      display_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      photo_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      provider: 'google',
      last_login_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error && error.code !== '23505') { // 23505는 unique constraint violation
    throw error
  }
  
  return data
}