-- Supabase Stored Procedures
-- 이 SQL을 Supabase 대시보드의 SQL Editor에서 실행하세요

-- 재고 감소 함수
CREATE OR REPLACE FUNCTION decrease_stock(option_id UUID, quantity INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE product_options 
    SET stock = stock - quantity
    WHERE id = option_id;
END;
$$ LANGUAGE plpgsql;

-- 매입으로부터 재고 및 원가 업데이트 함수
CREATE OR REPLACE FUNCTION update_inventory_from_purchase(purchase_id UUID)
RETURNS VOID AS $$
DECLARE
    item RECORD;
    total_purchase_cost DECIMAL;
    total_items_cost_cny DECIMAL;
    total_additional_costs DECIMAL;
    total_quantity INTEGER;
    average_landed_cost DECIMAL;
BEGIN
    -- 매입 정보 조회
    SELECT shipping_cost_krw + customs_fee_krw + other_fee_krw INTO total_additional_costs
    FROM purchases WHERE id = purchase_id;
    
    -- 아이템별 총 비용(CNY) 및 수량 계산
    SELECT 
        SUM(quantity * cost_cny_per_item * 200), -- CNY to KRW 환율 200 가정 (실제로는 동적으로 가져와야 함)
        SUM(quantity)
    INTO total_items_cost_cny, total_quantity
    FROM purchase_items 
    WHERE purchase_items.purchase_id = purchase_id;
    
    -- 총 매입 비용 (KRW)
    total_purchase_cost := total_items_cost_cny + total_additional_costs;
    
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
        -- 이동평균법으로 원가 업데이트
        UPDATE product_options 
        SET 
            stock = stock + item.quantity,
            cost_of_goods = CASE 
                WHEN stock = 0 THEN average_landed_cost
                ELSE (cost_of_goods * stock + average_landed_cost * item.quantity) / (stock + item.quantity)
            END
        WHERE id = item.option_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;