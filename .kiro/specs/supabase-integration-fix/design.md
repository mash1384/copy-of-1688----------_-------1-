# Design Document

## Overview

이 설계는 Supabase 연동 문제를 해결하여 웹 애플리케이션의 핵심 기능들(샘플데이터 로드, 완전초기화, 새상품등록, 매출등록)이 정상적으로 작동하도록 하는 것을 목표로 합니다.

현재 문제점 분석:
1. **RLS(Row Level Security) 정책 문제**: 현재 `auth.role() = 'authenticated'` 정책이 제대로 작동하지 않음
2. **인증 상태 관리 문제**: 사용자 인증 상태와 데이터베이스 작업 간의 동기화 이슈
3. **에러 핸들링 부족**: 구체적인 오류 메시지와 디버깅 정보 부족
4. **데이터베이스 함수 호출 문제**: RPC 함수들이 RLS 정책에 의해 차단됨
5. **사용자 컨텍스트 누락**: 일부 작업에서 사용자 ID가 제대로 전달되지 않음

## Architecture

### 1. 인증 및 권한 관리 개선

**현재 문제점:**
- RLS 정책이 `auth.role() = 'authenticated'`로 설정되어 있지만 실제로는 작동하지 않음
- 사용자별 데이터 격리가 제대로 이루어지지 않음

**해결 방안:**
- RLS 정책을 사용자 기반으로 변경: `auth.uid() = user_id`
- 개발 환경에서는 RLS를 완전히 비활성화하는 옵션 제공
- 인증 상태 확인 및 재시도 메커니즘 구현

### 2. 데이터베이스 연결 및 작업 개선

**현재 문제점:**
- 데이터베이스 함수들이 RLS 정책에 의해 차단됨
- 에러 메시지가 불명확하여 디버깅이 어려움

**해결 방안:**
- 데이터베이스 함수에 `SECURITY DEFINER` 권한 추가
- 상세한 에러 로깅 및 사용자 친화적 메시지 제공
- 재시도 로직 및 fallback 메커니즘 구현

### 3. 클라이언트 사이드 개선

**현재 문제점:**
- 에러 처리가 일관성이 없음
- 사용자 피드백이 부족함

**해결 방안:**
- 통합된 에러 처리 시스템
- 로딩 상태 및 진행률 표시
- 상세한 성공/실패 메시지

## Components and Interfaces

### 1. Database Layer Improvements

#### Enhanced Error Handling
```typescript
interface DatabaseError {
  code: string;
  message: string;
  details?: any;
  hint?: string;
}

interface DatabaseResult<T> {
  data?: T;
  error?: DatabaseError;
  success: boolean;
}
```

#### Improved Database Functions
- `createSampleDataSafe()`: 안전한 샘플 데이터 생성
- `deleteAllDataSafe()`: 안전한 데이터 삭제
- `addProductSafe()`: 안전한 상품 추가
- `addSaleSafe()`: 안전한 매출 추가

### 2. Authentication Context Enhancement

#### Enhanced Auth Context
```typescript
interface EnhancedAuthContextType {
  currentUser: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<User>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}
```

### 3. UI Feedback System

#### Loading States
- 전역 로딩 상태 관리
- 작업별 개별 로딩 상태
- 진행률 표시 (가능한 경우)

#### Error Display
- 사용자 친화적 에러 메시지
- 기술적 세부사항 (개발자 모드)
- 해결 방법 제안

## Data Models

### 1. Enhanced Database Schema

현재 스키마는 유지하되, 다음 개선사항 적용:

#### RLS Policy Updates
```sql
-- 사용자 기반 정책으로 변경
CREATE POLICY "Users can manage own data" ON products 
FOR ALL USING (auth.uid() = user_id);

-- 또는 개발 환경에서는 RLS 완전 비활성화
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
```

#### Enhanced Database Functions
```sql
-- SECURITY DEFINER 권한으로 함수 재생성
CREATE OR REPLACE FUNCTION decrease_stock_safe(option_id UUID, quantity INTEGER)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
-- 함수 내용
$$;
```

### 2. Client-Side Data Models

#### Operation Result
```typescript
interface OperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

## Error Handling

### 1. Database Error Categories

1. **Authentication Errors**: 인증 관련 오류
2. **Permission Errors**: 권한 관련 오류 (RLS)
3. **Validation Errors**: 데이터 유효성 오류
4. **Network Errors**: 네트워크 연결 오류
5. **Unknown Errors**: 기타 예상치 못한 오류

### 2. Error Recovery Strategies

1. **Automatic Retry**: 일시적 네트워크 오류
2. **Auth Refresh**: 인증 토큰 만료
3. **User Intervention**: 사용자 입력 필요
4. **Graceful Degradation**: 기능 제한 모드

### 3. User Feedback

1. **Success Messages**: 명확한 성공 확인
2. **Error Messages**: 이해하기 쉬운 오류 설명
3. **Action Suggestions**: 다음 단계 안내
4. **Debug Information**: 개발자를 위한 상세 정보

## Testing Strategy

### 1. Database Integration Tests

1. **Authentication Flow Tests**
   - 로그인/로그아웃 시나리오
   - 토큰 갱신 테스트
   - 권한 확인 테스트

2. **CRUD Operation Tests**
   - 상품 생성/수정/삭제
   - 매출 등록 및 재고 업데이트
   - 샘플 데이터 생성/삭제

3. **Error Scenario Tests**
   - 네트워크 오류 시뮬레이션
   - 권한 오류 테스트
   - 데이터 유효성 오류 테스트

### 2. UI Integration Tests

1. **User Flow Tests**
   - 상품 등록 플로우
   - 매출 등록 플로우
   - 데이터 관리 플로우

2. **Error Handling Tests**
   - 에러 메시지 표시
   - 재시도 메커니즘
   - 사용자 피드백

### 3. Performance Tests

1. **Database Performance**
   - 대량 데이터 처리
   - 동시 사용자 시나리오
   - 쿼리 최적화 확인

2. **UI Responsiveness**
   - 로딩 상태 표시
   - 사용자 상호작용 응답성
   - 메모리 사용량 모니터링

## Implementation Approach

### Phase 1: Database Layer Fixes
1. RLS 정책 수정 또는 비활성화
2. 데이터베이스 함수 권한 수정
3. 에러 핸들링 개선

### Phase 2: Authentication Improvements
1. 인증 상태 관리 개선
2. 토큰 갱신 메커니즘
3. 사용자 컨텍스트 전달 개선

### Phase 3: UI/UX Enhancements
1. 로딩 상태 및 피드백 개선
2. 에러 메시지 사용자 친화적으로 개선
3. 성공 확인 메시지 추가

### Phase 4: Testing and Validation
1. 모든 기능 테스트
2. 에러 시나리오 검증
3. 사용자 경험 개선

## Security Considerations

1. **RLS Policy Design**: 사용자별 데이터 격리 보장
2. **Function Security**: SECURITY DEFINER 함수의 안전한 사용
3. **Input Validation**: 클라이언트 및 서버 사이드 검증
4. **Error Information**: 보안에 민감한 정보 노출 방지

## Performance Considerations

1. **Database Queries**: 효율적인 쿼리 및 인덱스 사용
2. **Client Caching**: 적절한 데이터 캐싱 전략
3. **Loading States**: 사용자 경험을 위한 점진적 로딩
4. **Error Recovery**: 빠른 오류 복구 메커니즘