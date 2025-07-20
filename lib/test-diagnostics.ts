import { 
  runDatabaseDiagnostics, 
  checkDatabaseConnection, 
  testDatabaseOperations,
  applyUserBasedRLSPolicies,
  disableRLSForDevelopment
} from './database-diagnostics'

/**
 * Test database diagnostics functionality
 */
export const testDatabaseDiagnostics = async () => {
  console.log('🔍 데이터베이스 진단 테스트 시작...')
  
  try {
    // Test 1: Basic connection
    console.log('\n=== 1. 데이터베이스 연결 테스트 ===')
    const connectionStatus = await checkDatabaseConnection()
    console.log('연결 상태:', connectionStatus)
    
    // Test 2: Database operations
    console.log('\n=== 2. 데이터베이스 작업 테스트 ===')
    const operationResults = await testDatabaseOperations()
    operationResults.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.message}`)
      if (result.error) console.log(`   오류: ${result.error}`)
      if (result.details) console.log(`   세부사항:`, result.details)
    })
    
    // Test 3: Comprehensive diagnostics
    console.log('\n=== 3. 종합 진단 ===')
    const diagnostics = await runDatabaseDiagnostics()
    
    console.log('연결 상태:', diagnostics.connection)
    console.log('RLS 상태:', diagnostics.rlsStatus)
    console.log('권장사항:', diagnostics.recommendations)
    
    // Test 4: Policy fix options
    console.log('\n=== 4. 정책 수정 옵션 ===')
    
    const userBasedResult = await applyUserBasedRLSPolicies()
    console.log('사용자 기반 정책:', userBasedResult)
    
    const disableRLSResult = await disableRLSForDevelopment()
    console.log('RLS 비활성화:', disableRLSResult)
    
    console.log('\n✅ 데이터베이스 진단 테스트 완료')
    
    return {
      connectionStatus,
      operationResults,
      diagnostics,
      policyOptions: {
        userBased: userBasedResult,
        disableRLS: disableRLSResult
      }
    }
    
  } catch (error) {
    console.error('❌ 데이터베이스 진단 테스트 실패:', error)
    throw error
  }
}

/**
 * Quick diagnostic check for troubleshooting
 */
export const quickDiagnosticCheck = async () => {
  console.log('🔍 빠른 진단 확인...')
  
  const connection = await checkDatabaseConnection()
  
  if (!connection.connected) {
    console.log('❌ 데이터베이스 연결 실패')
    console.log('해결방법:')
    console.log('1. .env.local 파일의 SUPABASE_URL과 SUPABASE_ANON_KEY 확인')
    console.log('2. 네트워크 연결 확인')
    console.log('3. Supabase 프로젝트 상태 확인')
    return false
  }
  
  if (!connection.authenticated) {
    console.log('⚠️ 사용자 인증 필요')
    console.log('해결방법: Google 로그인 완료')
    return false
  }
  
  console.log('✅ 기본 연결 및 인증 상태 양호')
  
  // Test a simple operation
  const operations = await testDatabaseOperations()
  const failedOps = operations.filter(op => !op.success)
  
  if (failedOps.length > 0) {
    console.log('❌ 일부 데이터베이스 작업 실패:')
    failedOps.forEach(op => {
      console.log(`  - ${op.message}: ${op.error}`)
    })
    console.log('\n해결방법:')
    console.log('1. Supabase 대시보드에서 supabase-simple.sql 실행 (RLS 비활성화)')
    console.log('2. 또는 supabase-complete.sql 실행 (사용자 기반 정책)')
    console.log('3. supabase-diagnostics.sql 실행 (진단 함수 추가)')
    return false
  }
  
  console.log('✅ 모든 기본 작업 정상')
  return true
}