-- Enhanced Database Functions with SECURITY DEFINER
-- Execute this in Supabase Dashboard SQL Editor to update database functions

-- Drop existing functions first
DROP FUNCTION IF EXISTS decrease_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS update_inventory_from_purchase(UUID);
DROP FUNCTION IF EXISTS check_stock(UUID);

-- Enhanced decrease_stock function with comprehensive error handling and logging
CREATE OR REPLACE FUNCTION decrease_stock(option_id UUID, quantity INTEGER)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_stock INTEGER;
    new_stock INTEGER;
    product_name TEXT;
    option_name TEXT;
    product_id UUID;
    result JSON;
    log_entry TEXT;
BEGIN
    -- Input validation
    IF option_id IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'option_id cannot be null',
            'error_code', 'INVALID_INPUT',
            'timestamp', NOW()
        );
        RAISE LOG 'decrease_stock: Invalid input - option_id is null';
        RETURN result;
    END IF;
    
    IF quantity IS NULL OR quantity <= 0 THEN
        result := json_build_object(
            'success', false,
            'error', 'quantity must be a positive number',
            'error_code', 'INVALID_QUANTITY',
            'option_id', option_id,
            'quantity', quantity,
            'timestamp', NOW()
        );
        RAISE LOG 'decrease_stock: Invalid quantity % for option %', quantity, option_id;
        RETURN result;
    END IF;
    
    -- Get current stock and product information with detailed logging
    SELECT po.stock, p.name, po.name, po.product_id
    INTO current_stock, product_name, option_name, product_id
    FROM product_options po
    JOIN products p ON po.product_id = p.id
    WHERE po.id = option_id;
    
    -- Check if product option exists
    IF current_stock IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'Product option not found',
            'error_code', 'OPTION_NOT_FOUND',
            'option_id', option_id,
            'timestamp', NOW()
        );
        RAISE LOG 'decrease_stock: Product option % not found', option_id;
        RETURN result;
    END IF;
    
    -- Log the operation attempt
    log_entry := format('decrease_stock: Attempting to decrease stock for %s - %s (option_id: %s) by %s units. Current stock: %s',
                       product_name, option_name, option_id, quantity, current_stock);
    RAISE LOG '%', log_entry;
    
    -- Calculate new stock (allow negative for tracking purposes)
    new_stock := current_stock - quantity;
    
    -- Update stock with timestamp
    UPDATE product_options 
    SET stock = new_stock, updated_at = NOW()
    WHERE id = option_id;
    
    -- Verify the update was successful
    IF NOT FOUND THEN
        result := json_build_object(
            'success', false,
            'error', 'Failed to update stock',
            'error_code', 'UPDATE_FAILED',
            'option_id', option_id,
            'timestamp', NOW()
        );
        RAISE LOG 'decrease_stock: Failed to update stock for option %', option_id;
        RETURN result;
    END IF;
    
    -- Log successful operation
    RAISE LOG 'decrease_stock: Successfully updated stock for % - % from % to %', 
              product_name, option_name, current_stock, new_stock;
    
    -- Build comprehensive success result
    result := json_build_object(
        'success', true,
        'option_id', option_id,
        'product_id', product_id,
        'product_name', product_name,
        'option_name', option_name,
        'previous_stock', current_stock,
        'quantity_sold', quantity,
        'new_stock', new_stock,
        'timestamp', NOW(),
        'warning', CASE 
            WHEN new_stock < 0 THEN format('Stock is now negative (%s)', new_stock)
            WHEN new_stock < 5 THEN format('Low stock warning (%s remaining)', new_stock)
            ELSE null
        END
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Comprehensive error handling with detailed logging
    log_entry := format('decrease_stock: Exception occurred - SQLSTATE: %s, SQLERRM: %s, option_id: %s, quantity: %s',
                       SQLSTATE, SQLERRM, option_id, quantity);
    RAISE LOG '%', log_entry;
    
    result := json_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'option_id', option_id,
        'quantity', quantity,
        'timestamp', NOW(),
        'debug_info', json_build_object(
            'current_stock', current_stock,
            'product_name', product_name,
            'option_name', option_name
        )
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Enhanced update_inventory_from_purchase function
CREATE OR REPLACE FUNCTION update_inventory_from_purchase(purchase_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item RECORD;
    purchase_record RECORD;
    total_purchase_cost DECIMAL;
    total_items_cost_krw DECIMAL;
    total_additional_costs DECIMAL;
    total_quantity INTEGER;
    average_landed_cost DECIMAL;
    current_stock INTEGER;
    current_cost DECIMAL;
    new_stock INTEGER;
    new_cost DECIMAL;
    updated_items INTEGER := 0;
    result JSON;
    cny_to_krw_rate DECIMAL := 200; -- Default exchange rate
    log_entry TEXT;
    item_details JSON[] := '{}';
BEGIN
    -- Input validation
    IF purchase_id IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'purchase_id cannot be null',
            'error_code', 'INVALID_INPUT',
            'timestamp', NOW()
        );
        RAISE LOG 'update_inventory_from_purchase: Invalid input - purchase_id is null';
        RETURN result;
    END IF;
    
    -- Get purchase information with detailed logging
    SELECT * INTO purchase_record
    FROM purchases 
    WHERE id = purchase_id;
    
    IF purchase_record IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'Purchase not found',
            'error_code', 'PURCHASE_NOT_FOUND',
            'purchase_id', purchase_id,
            'timestamp', NOW()
        );
        RAISE LOG 'update_inventory_from_purchase: Purchase % not found', purchase_id;
        RETURN result;
    END IF;
    
    RAISE LOG 'update_inventory_from_purchase: Processing purchase % dated %', purchase_id, purchase_record.date;
    
    -- Calculate total additional costs
    total_additional_costs := COALESCE(purchase_record.shipping_cost_krw, 0) + 
                             COALESCE(purchase_record.customs_fee_krw, 0) + 
                             COALESCE(purchase_record.other_fee_krw, 0);
    
    -- Calculate total items cost and quantity
    SELECT 
        SUM(quantity * cost_cny_per_item * cny_to_krw_rate),
        SUM(quantity)
    INTO total_items_cost_krw, total_quantity
    FROM purchase_items 
    WHERE purchase_id = purchase_id;
    
    -- Handle null values
    total_items_cost_krw := COALESCE(total_items_cost_krw, 0);
    total_quantity := COALESCE(total_quantity, 0);
    
    -- Check if there are items to process
    IF total_quantity = 0 THEN
        result := json_build_object(
            'success', false,
            'error', 'No purchase items found',
            'error_code', 'NO_ITEMS',
            'purchase_id', purchase_id,
            'timestamp', NOW()
        );
        RAISE LOG 'update_inventory_from_purchase: No items found for purchase %', purchase_id;
        RETURN result;
    END IF;
    
    -- Calculate total purchase cost and average landed cost
    total_purchase_cost := total_items_cost_krw + total_additional_costs;
    average_landed_cost := total_purchase_cost / total_quantity;
    
    RAISE LOG 'update_inventory_from_purchase: Total cost: % KRW, Total quantity: %, Average landed cost: % KRW',
              total_purchase_cost, total_quantity, average_landed_cost;
    
    -- Update each item's inventory and cost
    FOR item IN 
        SELECT pi.*, p.name as product_name, po.name as option_name
        FROM purchase_items pi
        JOIN product_options po ON pi.option_id = po.id
        JOIN products p ON pi.product_id = p.id
        WHERE pi.purchase_id = purchase_id
    LOOP
        -- Get current stock and cost
        SELECT COALESCE(stock, 0), COALESCE(cost_of_goods, 0) 
        INTO current_stock, current_cost
        FROM product_options 
        WHERE id = item.option_id;
        
        -- Skip if option doesn't exist
        IF current_stock IS NULL THEN
            RAISE LOG 'update_inventory_from_purchase: Option % not found, skipping', item.option_id;
            CONTINUE;
        END IF;
        
        -- Calculate new values
        new_stock := current_stock + item.quantity;
        new_cost := CASE 
            WHEN current_stock = 0 THEN average_landed_cost
            ELSE (current_cost * current_stock + average_landed_cost * item.quantity) / new_stock
        END;
        
        -- Update the option
        UPDATE product_options 
        SET 
            stock = new_stock,
            cost_of_goods = new_cost,
            updated_at = NOW()
        WHERE id = item.option_id;
        
        -- Log the update
        RAISE LOG 'update_inventory_from_purchase: Updated % - %: stock % -> %, cost % -> %',
                  item.product_name, item.option_name, current_stock, new_stock, current_cost, new_cost;
        
        -- Add to item details for result
        item_details := item_details || json_build_object(
            'option_id', item.option_id,
            'product_name', item.product_name,
            'option_name', item.option_name,
            'quantity_added', item.quantity,
            'previous_stock', current_stock,
            'new_stock', new_stock,
            'previous_cost', current_cost,
            'new_cost', new_cost
        );
        
        updated_items := updated_items + 1;
    END LOOP;
    
    -- Log completion
    RAISE LOG 'update_inventory_from_purchase: Successfully updated % items for purchase %', updated_items, purchase_id;
    
    -- Build comprehensive success result
    result := json_build_object(
        'success', true,
        'purchase_id', purchase_id,
        'purchase_date', purchase_record.date,
        'total_quantity', total_quantity,
        'total_items_cost_krw', total_items_cost_krw,
        'total_additional_costs_krw', total_additional_costs,
        'total_purchase_cost_krw', total_purchase_cost,
        'average_landed_cost_krw', average_landed_cost,
        'updated_items', updated_items,
        'exchange_rate_used', cny_to_krw_rate,
        'timestamp', NOW(),
        'item_details', item_details
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Comprehensive error handling with detailed logging
    log_entry := format('update_inventory_from_purchase: Exception occurred - SQLSTATE: %s, SQLERRM: %s, purchase_id: %s',
                       SQLSTATE, SQLERRM, purchase_id);
    RAISE LOG '%', log_entry;
    
    result := json_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'purchase_id', purchase_id,
        'timestamp', NOW(),
        'debug_info', json_build_object(
            'total_quantity', total_quantity,
            'total_purchase_cost', total_purchase_cost,
            'updated_items', updated_items
        )
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Enhanced check_stock function with detailed information
CREATE OR REPLACE FUNCTION check_stock(option_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_stock INTEGER;
    product_name TEXT;
    option_name TEXT;
    product_id UUID;
    cost_of_goods DECIMAL;
    recommended_price DECIMAL;
    sku TEXT;
    result JSON;
BEGIN
    -- Input validation
    IF option_id IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'option_id cannot be null',
            'error_code', 'INVALID_INPUT',
            'timestamp', NOW()
        );
        RETURN result;
    END IF;
    
    -- Get comprehensive option information
    SELECT po.stock, p.name, po.name, po.product_id, po.cost_of_goods, po.recommended_price, po.sku
    INTO current_stock, product_name, option_name, product_id, cost_of_goods, recommended_price, sku
    FROM product_options po
    JOIN products p ON po.product_id = p.id
    WHERE po.id = option_id;
    
    -- Check if product option exists
    IF current_stock IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'Product option not found',
            'error_code', 'OPTION_NOT_FOUND',
            'option_id', option_id,
            'timestamp', NOW()
        );
        RETURN result;
    END IF;
    
    -- Build comprehensive result
    result := json_build_object(
        'success', true,
        'option_id', option_id,
        'product_id', product_id,
        'product_name', product_name,
        'option_name', option_name,
        'sku', sku,
        'current_stock', current_stock,
        'cost_of_goods', cost_of_goods,
        'recommended_price', recommended_price,
        'timestamp', NOW(),
        'stock_status', CASE 
            WHEN current_stock <= 0 THEN 'OUT_OF_STOCK'
            WHEN current_stock < 5 THEN 'LOW_STOCK'
            WHEN current_stock < 10 THEN 'MEDIUM_STOCK'
            ELSE 'GOOD_STOCK'
        END,
        'warnings', CASE 
            WHEN current_stock <= 0 THEN ARRAY['Product is out of stock']
            WHEN current_stock < 5 THEN ARRAY['Low stock warning']
            ELSE ARRAY[]::TEXT[]
        END
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Error handling
    result := json_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'option_id', option_id,
        'timestamp', NOW()
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Additional utility function for bulk stock operations
CREATE OR REPLACE FUNCTION bulk_update_stock(updates JSON)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    update_item JSON;
    option_id UUID;
    new_stock INTEGER;
    updated_count INTEGER := 0;
    failed_count INTEGER := 0;
    results JSON[] := '{}';
    result JSON;
BEGIN
    -- Process each update in the JSON array
    FOR update_item IN SELECT * FROM json_array_elements(updates)
    LOOP
        BEGIN
            option_id := (update_item->>'option_id')::UUID;
            new_stock := (update_item->>'stock')::INTEGER;
            
            -- Update the stock
            UPDATE product_options 
            SET stock = new_stock, updated_at = NOW()
            WHERE id = option_id;
            
            IF FOUND THEN
                updated_count := updated_count + 1;
                results := results || json_build_object(
                    'option_id', option_id,
                    'success', true,
                    'new_stock', new_stock
                );
            ELSE
                failed_count := failed_count + 1;
                results := results || json_build_object(
                    'option_id', option_id,
                    'success', false,
                    'error', 'Option not found'
                );
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            failed_count := failed_count + 1;
            results := results || json_build_object(
                'option_id', option_id,
                'success', false,
                'error', SQLERRM
            );
        END;
    END LOOP;
    
    result := json_build_object(
        'success', failed_count = 0,
        'updated_count', updated_count,
        'failed_count', failed_count,
        'results', results,
        'timestamp', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION decrease_stock(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_inventory_from_purchase(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_stock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_stock(JSON) TO authenticated;

-- Grant execute permissions to anon users for basic functions (if needed)
GRANT EXECUTE ON FUNCTION check_stock(UUID) TO anon;

-- Test the functions
SELECT 'Enhanced database functions with SECURITY DEFINER created successfully' as status;

-- Test check_stock function with a dummy UUID
SELECT check_stock('00000000-0000-0000-0000-000000000000') as test_result;