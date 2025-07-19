-- Supabase 완전 설정 SQL
-- 이 SQL을 Supabase 대시보드의 SQL Editor에서 실행하세요
-- 기존 모든 설정을 삭제하고 새로 생성합니다

-- ========================================
-- 1. 기존 정책 및 함수 삭제 (완전 초기화)
-- ========================================

-- 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Users can manage own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON users;

DROP POLICY IF EXISTS "Users can manage own products" ON products;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON products;

DROP POLICY IF EXISTS "Users can manage own product options" ON product_options;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON product_options;

DROP POLICY IF EXISTS "Users can manage own sales" ON sales;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON sales;

DROP POLICY IF EXISTS "Users can manage own purchases" ON purchases;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON purchases;

DROP POLICY IF EXISTS "Users can manage own purchase items" ON purchase_items;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON purchase_items;

DROP POLICY IF EXISTS "Users can manage own settings" ON app_settings;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON app_settings;

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS decrease_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS update_inventory_from_purchase(UUID);
DROP FUNCTION IF EXISTS check_stock(UUID);

-- ========================================
-- 2. RLS 정책 재설정
-- ========================================

-- RLS 비활성화 후 재활성화 (완전 리셋)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 새로운 RLS 정책 생성 (단순화된 버전)
CREATE POLICY "Enable all for authenticated users" ON users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON product_options FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON sales FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON purchases FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON purchase_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON app_settings FOR ALL USING (auth.role() = 'authenticated');

-- ========================================
-- 3. 안전한 함수들 생성
-- ========================================

-- 안전한 재고 감소 함수
CREATE OR REPLACE FUNCTION decrease_stock(option_id UUID, quantity INTEGER)
RETURNS JSON AS $$
DECLARE
    current_stock INTEGER;
    new_stock INTEGER;
    result JSON;
BEGIN
    -- 현재 재고 확인
    SELECT stock INTO current_stock 
    FROM product_options 
    WHERE id = option_id;
    
    -- 상품 옵션이 존재하지 않는 경우
    IF current_stock IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'Product option not found',
            'option_id', option_id
        );
        RETURN result;
    END IF;
    
    -- 새로운 재고 계산 (음수 방지)
    new_stock := GREATEST(current_stock - quantity, 0);
    
    -- 재고 업데이트
    UPDATE product_options 
    SET stock = new_stock
    WHERE id = option_id;
    
    -- 성공 결과 반환
    result := json_build_object(
        'success', true,
        'option_id', option_id,
        'previous_stock', current_stock,
        'quantity_sold', quantity,
        'new_stock', new_stock,
        'warning', CASE 
            WHEN current_stock < quantity THEN 'Insufficient stock - set to 0'
            ELSE null
        END
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- 오류 발생 시 안전한 응답
    result := json_build_object(
        'success', false,
        'error', SQLERRM,
        'option_id', option_id
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 매입으로부터 재고 및 원가 업데이트 함수 (안전한 버전)
CREATE OR REPLACE FUNCTION update_inventory_from_purchase(purchase_id UUID)
RETURNS JSON AS $$
DECLARE
    item RECORD;
    total_purchase_cost DECIMAL;
    total_items_cost_krw DECIMAL;
    total_additional_costs DECIMAL;
    total_quantity INTEGER;
    average_landed_cost DECIMAL;
    current_stock INTEGER;
    current_cost DECIMAL;
    result JSON;
BEGIN
    -- 매입 정보 조회
    SELECT COALESCE(shipping_cost_krw, 0) + COALESCE(customs_fee_krw, 0) + COALESCE(other_fee_krw, 0) 
    INTO total_additional_costs
    FROM purchases WHERE id = purchase_id;
    
    -- 아이템별 총 비용(KRW) 및 수량 계산
    SELECT 
        SUM(quantity * cost_cny_per_item * 200), -- CNY to KRW 환율 200 가정
        SUM(quantity)
    INTO total_items_cost_krw, total_quantity
    FROM purchase_items 
    WHERE purchase_items.purchase_id = purchase_id;
    
    -- NULL 값 처리
    total_items_cost_krw := COALESCE(total_items_cost_krw, 0);
    total_additional_costs := COALESCE(total_additional_costs, 0);
    total_quantity := COALESCE(total_quantity, 0);
    
    -- 총 매입 비용 (KRW)
    total_purchase_cost := total_items_cost_krw + total_additional_costs;
    
    -- 평균 착지 원가 계산
    IF total_quantity > 0 THEN
        average_landed_cost := total_purchase_cost / total_quantity;
    ELSE
        average_landed_cost := 0;
    END IF;
    
    -- 각 아이템별로 재고 및 원가 업데이트
    FOR item IN 
        SELECT * FROM purchase_items WHERE purchase_items.purchase_id = purchase_id
    LOOP
        -- 현재 재고와 원가 조회
        SELECT COALESCE(stock, 0), COALESCE(cost_of_goods, 0) 
        INTO current_stock, current_cost
        FROM product_options WHERE id = item.option_id;
        
        -- 이동평균법으로 원가 업데이트
        UPDATE product_options 
        SET 
            stock = current_stock + item.quantity,
            cost_of_goods = CASE 
                WHEN current_stock = 0 THEN average_landed_cost
                ELSE (current_cost * current_stock + average_landed_cost * item.quantity) / (current_stock + item.quantity)
            END
        WHERE id = item.option_id;
    END LOOP;
    
    -- 성공 결과 반환
    result := json_build_object(
        'success', true,
        'purchase_id', purchase_id,
        'total_quantity', total_quantity,
        'average_landed_cost', average_landed_cost
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- 오류 발생 시 안전한 응답
    result := json_build_object(
        'success', false,
        'error', SQLERRM,
        'purchase_id', purchase_id
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 재고 확인 함수
CREATE OR REPLACE FUNCTION check_stock(option_id UUID)
RETURNS JSON AS $$
DECLARE
    current_stock INTEGER;
    product_name TEXT;
    option_name TEXT;
    result JSON;
BEGIN
    SELECT po.stock, p.name, po.name
    INTO current_stock, product_name, option_name
    FROM product_options po
    JOIN products p ON po.product_id = p.id
    WHERE po.id = option_id;
    
    IF current_stock IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'Product option not found'
        );
    ELSE
        result := json_build_object(
            'success', true,
            'option_id', option_id,
            'product_name', product_name,
            'option_name', option_name,
            'current_stock', current_stock
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. 설정 완료 확인
-- ========================================

-- 정책 목록 확인
SELECT 'RLS 정책 확인' as status;
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 함수 목록 확인
SELECT '함수 확인' as status;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('decrease_stock', 'update_inventory_from_purchase', 'check_stock')
ORDER BY routine_name;