-- Database Diagnostics SQL Functions
-- Execute this in Supabase Dashboard SQL Editor to enable diagnostic functions

-- Function to check RLS status for a table
CREATE OR REPLACE FUNCTION check_rls_status(table_name TEXT)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rls_enabled BOOLEAN;
    policies_data JSON;
    result JSON;
BEGIN
    -- Check if RLS is enabled for the table
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = table_name AND relnamespace = 'public'::regnamespace;
    
    -- Get policies for the table
    SELECT json_agg(
        json_build_object(
            'policy_name', policyname,
            'permissive', permissive,
            'roles', roles,
            'cmd', cmd
        )
    ) INTO policies_data
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = table_name;
    
    -- Build result
    result := json_build_object(
        'table_name', table_name,
        'rls_enabled', COALESCE(rls_enabled, false),
        'policies', COALESCE(policies_data, '[]'::json)
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Return error information
    result := json_build_object(
        'table_name', table_name,
        'rls_enabled', false,
        'policies', '[]'::json,
        'error', SQLERRM
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to test database connectivity
CREATE OR REPLACE FUNCTION test_database_connectivity()
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
    user_count INTEGER;
    product_count INTEGER;
BEGIN
    -- Count records in key tables
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO product_count FROM products;
    
    result := json_build_object(
        'success', true,
        'timestamp', NOW(),
        'user_count', user_count,
        'product_count', product_count,
        'message', 'Database connectivity test successful'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    result := json_build_object(
        'success', false,
        'timestamp', NOW(),
        'error', SQLERRM,
        'message', 'Database connectivity test failed'
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Enhanced version of existing functions with better error handling

-- Enhanced decrease_stock function with comprehensive error handling
CREATE OR REPLACE FUNCTION decrease_stock_safe(option_id UUID, quantity INTEGER)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_stock INTEGER;
    new_stock INTEGER;
    product_name TEXT;
    option_name TEXT;
    result JSON;
BEGIN
    -- Validate input parameters
    IF option_id IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'option_id cannot be null',
            'error_code', 'INVALID_INPUT'
        );
        RETURN result;
    END IF;
    
    IF quantity IS NULL OR quantity <= 0 THEN
        result := json_build_object(
            'success', false,
            'error', 'quantity must be a positive number',
            'error_code', 'INVALID_QUANTITY'
        );
        RETURN result;
    END IF;
    
    -- Get current stock and product information
    SELECT po.stock, p.name, po.name
    INTO current_stock, product_name, option_name
    FROM product_options po
    JOIN products p ON po.product_id = p.id
    WHERE po.id = option_id;
    
    -- Check if product option exists
    IF current_stock IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'Product option not found',
            'error_code', 'OPTION_NOT_FOUND',
            'option_id', option_id
        );
        RETURN result;
    END IF;
    
    -- Calculate new stock (allow negative for tracking purposes)
    new_stock := current_stock - quantity;
    
    -- Update stock
    UPDATE product_options 
    SET stock = new_stock, updated_at = NOW()
    WHERE id = option_id;
    
    -- Build success result
    result := json_build_object(
        'success', true,
        'option_id', option_id,
        'product_name', product_name,
        'option_name', option_name,
        'previous_stock', current_stock,
        'quantity_sold', quantity,
        'new_stock', new_stock,
        'warning', CASE 
            WHEN new_stock < 0 THEN 'Stock is now negative'
            WHEN new_stock < 5 THEN 'Low stock warning'
            ELSE null
        END
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Comprehensive error handling
    result := json_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'option_id', option_id,
        'quantity', quantity
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Enhanced update_inventory_from_purchase function
CREATE OR REPLACE FUNCTION update_inventory_from_purchase_safe(purchase_id UUID)
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
    updated_items INTEGER := 0;
    result JSON;
    cny_to_krw_rate DECIMAL := 200; -- Default exchange rate
BEGIN
    -- Validate input
    IF purchase_id IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'purchase_id cannot be null',
            'error_code', 'INVALID_INPUT'
        );
        RETURN result;
    END IF;
    
    -- Get purchase information
    SELECT * INTO purchase_record
    FROM purchases 
    WHERE id = purchase_id;
    
    IF purchase_record IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'Purchase not found',
            'error_code', 'PURCHASE_NOT_FOUND',
            'purchase_id', purchase_id
        );
        RETURN result;
    END IF;
    
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
            'purchase_id', purchase_id
        );
        RETURN result;
    END IF;
    
    -- Calculate total purchase cost and average landed cost
    total_purchase_cost := total_items_cost_krw + total_additional_costs;
    average_landed_cost := total_purchase_cost / total_quantity;
    
    -- Update each item's inventory and cost
    FOR item IN 
        SELECT * FROM purchase_items WHERE purchase_id = purchase_id
    LOOP
        -- Get current stock and cost
        SELECT COALESCE(stock, 0), COALESCE(cost_of_goods, 0) 
        INTO current_stock, current_cost
        FROM product_options 
        WHERE id = item.option_id;
        
        -- Skip if option doesn't exist
        IF current_stock IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Calculate new cost using weighted average
        UPDATE product_options 
        SET 
            stock = current_stock + item.quantity,
            cost_of_goods = CASE 
                WHEN current_stock = 0 THEN average_landed_cost
                ELSE (current_cost * current_stock + average_landed_cost * item.quantity) / (current_stock + item.quantity)
            END,
            updated_at = NOW()
        WHERE id = item.option_id;
        
        updated_items := updated_items + 1;
    END LOOP;
    
    -- Build success result
    result := json_build_object(
        'success', true,
        'purchase_id', purchase_id,
        'total_quantity', total_quantity,
        'total_purchase_cost_krw', total_purchase_cost,
        'average_landed_cost_krw', average_landed_cost,
        'updated_items', updated_items,
        'exchange_rate_used', cny_to_krw_rate
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Comprehensive error handling
    result := json_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'purchase_id', purchase_id
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_rls_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION test_database_connectivity() TO authenticated;
GRANT EXECUTE ON FUNCTION decrease_stock_safe(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_inventory_from_purchase_safe(UUID) TO authenticated;

-- Test the functions
SELECT 'Database diagnostic functions created successfully' as status;