-- 간단한 Supabase 설정 (RLS 비활성화)
-- 개발/테스트용으로 RLS를 완전히 비활성화합니다

-- 기존 정책 모두 삭제
DROP POLICY IF EXISTS "Enable all for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON product_options;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON sales;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON purchases;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON purchase_items;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON app_settings;

-- RLS 완전 비활성화
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- 테스트 쿼리
SELECT 'RLS 비활성화 완료' as status;