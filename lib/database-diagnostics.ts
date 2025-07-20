import { supabase } from './supabase'

export interface DatabaseDiagnosticResult {
  success: boolean
  message: string
  details?: any
  error?: string
}

export interface RLSPolicyStatus {
  tableName: string
  rlsEnabled: boolean
  policies: Array<{
    policyName: string
    permissive: boolean
    roles: string[]
    cmd: string
  }>
}

export interface DatabaseConnectionStatus {
  connected: boolean
  authenticated: boolean
  userId?: string
  error?: string
}

/**
 * Check database connection and authentication status
 */
export const checkDatabaseConnection = async (): Promise<DatabaseConnectionStatus> => {
  try {
    console.log('🔍 데이터베이스 연결 상태 확인 중...')
    
    // Check basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (connectionError) {
      console.error('❌ 데이터베이스 연결 실패:', connectionError)
      return {
        connected: false,
        authenticated: false,
        error: connectionError.message
      }
    }
    
    // Check authentication
    const { data: authData, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('❌ 인증 상태 확인 실패:', authError)
      return {
        connected: true,
        authenticated: false,
        error: authError.message
      }
    }
    
    const isAuthenticated = !!authData.user
    
    console.log('✅ 데이터베이스 연결 상태:', {
      connected: true,
      authenticated: isAuthenticated,
      userId: authData.user?.id
    })
    
    return {
      connected: true,
      authenticated: isAuthenticated,
      userId: authData.user?.id
    }
    
  } catch (error) {
    console.error('❌ 데이터베이스 연결 확인 중 예외:', error)
    return {
      connected: false,
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check RLS policy status for all tables
 */
export const checkRLSPolicyStatus = async (): Promise<RLSPolicyStatus[]> => {
  try {
    console.log('🔍 RLS 정책 상태 확인 중...')
    
    const tables = [
      'users', 'products', 'product_options', 
      'sales', 'purchases', 'purchase_items', 'app_settings'
    ]
    
    const results: RLSPolicyStatus[] = []
    
    for (const tableName of tables) {
      try {
        // Check if RLS is enabled (this might fail due to permissions)
        const { data: rlsData, error: rlsError } = await supabase.rpc('check_rls_status', {
          table_name: tableName
        })
        
        // If RPC fails, try alternative method
        let rlsEnabled = false
        let policies: any[] = []
        
        if (rlsError) {
          console.warn(`⚠️ RLS 상태 확인 실패 (${tableName}):`, rlsError.message)
          // Try to infer RLS status by attempting a query
          const { error: testError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1)
          
          // If we get a policy violation, RLS is likely enabled
          rlsEnabled = testError?.code === 'PGRST116' || testError?.message?.includes('policy')
        } else {
          rlsEnabled = rlsData?.rls_enabled || false
          policies = rlsData?.policies || []
        }
        
        results.push({
          tableName,
          rlsEnabled,
          policies: policies.map((p: any) => ({
            policyName: p.policy_name || 'unknown',
            permissive: p.permissive !== false,
            roles: p.roles || [],
            cmd: p.cmd || 'ALL'
          }))
        })
        
      } catch (error) {
        console.error(`❌ ${tableName} RLS 확인 실패:`, error)
        results.push({
          tableName,
          rlsEnabled: false,
          policies: []
        })
      }
    }
    
    console.log('✅ RLS 정책 상태 확인 완료:', results)
    return results
    
  } catch (error) {
    console.error('❌ RLS 정책 상태 확인 중 예외:', error)
    return []
  }
}

/**
 * Test database operations with current policies
 */
export const testDatabaseOperations = async (): Promise<DatabaseDiagnosticResult[]> => {
  const results: DatabaseDiagnosticResult[] = []
  
  try {
    console.log('🔍 데이터베이스 작업 테스트 시작...')
    
    // Test 1: User table access
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1)
      
      results.push({
        success: !error,
        message: 'Users table access test',
        details: { hasData: !!data?.length, error: error?.message }
      })
    } catch (error) {
      results.push({
        success: false,
        message: 'Users table access test',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Test 2: Products table access
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .limit(1)
      
      results.push({
        success: !error,
        message: 'Products table access test',
        details: { hasData: !!data?.length, error: error?.message }
      })
    } catch (error) {
      results.push({
        success: false,
        message: 'Products table access test',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Test 3: Database functions
    try {
      const { data, error } = await supabase.rpc('check_stock', {
        option_id: '00000000-0000-0000-0000-000000000000' // dummy UUID
      })
      
      results.push({
        success: !error || error.message.includes('not found'),
        message: 'Database function test (check_stock)',
        details: { result: data, error: error?.message }
      })
    } catch (error) {
      results.push({
        success: false,
        message: 'Database function test (check_stock)',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    console.log('✅ 데이터베이스 작업 테스트 완료:', results)
    return results
    
  } catch (error) {
    console.error('❌ 데이터베이스 작업 테스트 중 예외:', error)
    return [{
      success: false,
      message: 'Database operations test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }]
  }
}

/**
 * Apply RLS policy fixes - user-based policies
 */
export const applyUserBasedRLSPolicies = async (): Promise<DatabaseDiagnosticResult> => {
  try {
    console.log('🔍 사용자 기반 RLS 정책 적용 중...')
    
    const rlsPolicySQL = `
      -- Drop existing policies
      DROP POLICY IF EXISTS "Enable all for authenticated users" ON users;
      DROP POLICY IF EXISTS "Enable all for authenticated users" ON products;
      DROP POLICY IF EXISTS "Enable all for authenticated users" ON product_options;
      DROP POLICY IF EXISTS "Enable all for authenticated users" ON sales;
      DROP POLICY IF EXISTS "Enable all for authenticated users" ON purchases;
      DROP POLICY IF EXISTS "Enable all for authenticated users" ON purchase_items;
      DROP POLICY IF EXISTS "Enable all for authenticated users" ON app_settings;
      
      -- Create user-based policies
      CREATE POLICY "Users can manage own data" ON users FOR ALL USING (auth.uid() = id);
      CREATE POLICY "Users can manage own data" ON products FOR ALL USING (auth.uid() = user_id);
      CREATE POLICY "Users can manage own data" ON product_options FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM products WHERE id = product_id)
      );
      CREATE POLICY "Users can manage own data" ON sales FOR ALL USING (auth.uid() = user_id);
      CREATE POLICY "Users can manage own data" ON purchases FOR ALL USING (auth.uid() = user_id);
      CREATE POLICY "Users can manage own data" ON purchase_items FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM purchases WHERE id = purchase_id)
      );
      CREATE POLICY "Users can manage own data" ON app_settings FOR ALL USING (auth.uid() = user_id);
    `
    
    // Note: This would require admin privileges to execute
    // For now, we'll return instructions for manual execution
    
    return {
      success: false,
      message: 'User-based RLS policies require manual application',
      details: {
        instructions: 'Execute the following SQL in Supabase Dashboard SQL Editor with admin privileges',
        sql: rlsPolicySQL
      }
    }
    
  } catch (error) {
    console.error('❌ RLS 정책 적용 실패:', error)
    return {
      success: false,
      message: 'Failed to apply user-based RLS policies',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Disable RLS for development environment
 */
export const disableRLSForDevelopment = async (): Promise<DatabaseDiagnosticResult> => {
  try {
    console.log('🔍 개발 환경용 RLS 비활성화 시도 중...')
    
    const disableRLSSQL = `
      -- Disable RLS for all tables
      ALTER TABLE users DISABLE ROW LEVEL SECURITY;
      ALTER TABLE products DISABLE ROW LEVEL SECURITY;
      ALTER TABLE product_options DISABLE ROW LEVEL SECURITY;
      ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
      ALTER TABLE purchases DISABLE ROW LEVEL SECURITY;
      ALTER TABLE purchase_items DISABLE ROW LEVEL SECURITY;
      ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
    `
    
    // Note: This would require admin privileges to execute
    // For now, we'll return instructions for manual execution
    
    return {
      success: false,
      message: 'RLS disabling requires manual execution',
      details: {
        instructions: 'Execute the following SQL in Supabase Dashboard SQL Editor with admin privileges',
        sql: disableRLSSQL,
        note: 'This is recommended for development/testing environments only'
      }
    }
    
  } catch (error) {
    console.error('❌ RLS 비활성화 실패:', error)
    return {
      success: false,
      message: 'Failed to disable RLS',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Run comprehensive database diagnostics
 */
export const runDatabaseDiagnostics = async (): Promise<{
  connection: DatabaseConnectionStatus
  rlsStatus: RLSPolicyStatus[]
  operationTests: DatabaseDiagnosticResult[]
  recommendations: string[]
}> => {
  console.log('🔍 종합 데이터베이스 진단 시작...')
  
  const connection = await checkDatabaseConnection()
  const rlsStatus = await checkRLSPolicyStatus()
  const operationTests = await testDatabaseOperations()
  
  // Generate recommendations based on results
  const recommendations: string[] = []
  
  if (!connection.connected) {
    recommendations.push('데이터베이스 연결을 확인하세요. Supabase URL과 API 키가 올바른지 확인하세요.')
  }
  
  if (!connection.authenticated) {
    recommendations.push('사용자 인증이 필요합니다. Google 로그인을 완료하세요.')
  }
  
  const hasRLSEnabled = rlsStatus.some(table => table.rlsEnabled)
  const hasFailedOperations = operationTests.some(test => !test.success)
  
  if (hasRLSEnabled && hasFailedOperations) {
    recommendations.push('RLS 정책으로 인해 데이터베이스 작업이 실패하고 있습니다.')
    recommendations.push('개발 환경에서는 RLS를 비활성화하거나 사용자 기반 정책으로 변경하는 것을 권장합니다.')
    recommendations.push('Supabase 대시보드에서 supabase-simple.sql 또는 supabase-complete.sql을 실행하세요.')
  }
  
  if (operationTests.some(test => test.message.includes('function') && !test.success)) {
    recommendations.push('데이터베이스 함수가 제대로 작동하지 않습니다. SECURITY DEFINER 권한이 필요할 수 있습니다.')
  }
  
  console.log('✅ 종합 데이터베이스 진단 완료')
  
  return {
    connection,
    rlsStatus,
    operationTests,
    recommendations
  }
}