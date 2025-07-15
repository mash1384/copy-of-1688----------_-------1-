
import * as React from 'react';
import { useState, useMemo } from 'react';
import { Product, Purchase, PurchaseItem } from '../../types';
import { PlusIcon, XIcon } from '../icons/Icons';
import { CNY_TO_KRW_RATE } from '../../constants';

interface PurchaseFormProps {
  products: Product[];
  onAddPurchase: (purchase: Omit<Purchase, 'id'>) => void;
  onCancel: () => void;
}

type FormPurchaseItem = Omit<PurchaseItem, 'quantity' | 'costCnyPerItem'> & {
  quantity: number | '';
  costCnyPerItem: number | '';
};

const PurchaseForm: React.FC<PurchaseFormProps> = ({ products, onAddPurchase, onCancel }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<FormPurchaseItem[]>([{ productId: '', optionId: '', quantity: '', costCnyPerItem: '' }]);
  const [shippingCostKrw, setShippingCostKrw] = useState<number | ''>('');
  const [customsFeeKrw, setCustomsFeeKrw] = useState<number | ''>('');
  const [otherFeeKrw, setOtherFeeKrw] = useState<number | ''>('');

  const handleItemChange = (index: number, field: keyof FormPurchaseItem, value: string | number) => {
    const newItems = [...items];
    const itemToUpdate = { ...newItems[index], [field]: value };

    if (field === 'productId') {
      itemToUpdate.optionId = '';
    }
    
    newItems[index] = itemToUpdate;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { productId: '', optionId: '', quantity: '', costCnyPerItem: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // 실시간 계산
  const calculations = useMemo(() => {
    const validItems = items.filter(item => 
      item.productId && item.optionId && 
      typeof item.quantity === 'number' && item.quantity > 0 &&
      typeof item.costCnyPerItem === 'number' && item.costCnyPerItem > 0
    );

    const itemsTotalCny = validItems.reduce((sum, item) => 
      sum + (item.quantity as number) * (item.costCnyPerItem as number), 0
    );
    const itemsTotalKrw = itemsTotalCny * CNY_TO_KRW_RATE;
    const additionalCosts = (Number(shippingCostKrw) || 0) + (Number(customsFeeKrw) || 0) + (Number(otherFeeKrw) || 0);
    const totalCost = itemsTotalKrw + additionalCosts;
    const totalQuantity = validItems.reduce((sum, item) => sum + (item.quantity as number), 0);

    return {
      validItems,
      itemsTotalCny,
      itemsTotalKrw,
      additionalCosts,
      totalCost,
      totalQuantity
    };
  }, [items, shippingCostKrw, customsFeeKrw, otherFeeKrw]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalItems: PurchaseItem[] = calculations.validItems.map(item => ({
        productId: item.productId,
        optionId: item.optionId,
        quantity: Number(item.quantity),
        costCnyPerItem: Number(item.costCnyPerItem)
    }));

    if (finalItems.length === 0) {
        alert("유효한 상품을 하나 이상 추가해주세요.");
        return;
    }

    onAddPurchase({
      date,
      items: finalItems,
      shippingCostKrw: Number(shippingCostKrw) || 0,
      customsFeeKrw: Number(customsFeeKrw) || 0,
      otherFeeKrw: Number(otherFeeKrw) || 0,
    });
  };

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 헤더 정보 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="purchaseDate" className="block text-sm font-semibold text-gray-700 mb-2">📅 매입 날짜</label>
              <input 
                type="date" 
                id="purchaseDate" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                required 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
            </div>
            <div className="flex items-end">
              <div className="bg-white p-3 rounded-lg border border-gray-200 w-full">
                <p className="text-sm text-gray-600">환율 정보</p>
                <p className="text-lg font-semibold text-gray-800">¥1 = ₩{CNY_TO_KRW_RATE}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* 상품 목록 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-800 flex items-center">
              🛍️ 매입 상품 목록
              {calculations.validItems.length > 0 && (
                <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  {calculations.validItems.length}개 상품
                </span>
              )}
            </h4>
          </div>
          
          <div className="space-y-3">
            {items.map((item, index) => {
              const selectedProduct = products.find(p => p.id === item.productId);
              const isValid = item.productId && item.optionId && 
                            typeof item.quantity === 'number' && item.quantity > 0 &&
                            typeof item.costCnyPerItem === 'number' && item.costCnyPerItem > 0;
              const itemTotalCny = isValid ? (item.quantity as number) * (item.costCnyPerItem as number) : 0;
              const itemTotalKrw = itemTotalCny * CNY_TO_KRW_RATE;
              
              return (
                <div key={index} className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  isValid ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 items-end">
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">상품</label>
                      <select 
                        value={item.productId} 
                        onChange={e => handleItemChange(index, 'productId', e.target.value)} 
                        required 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">상품 선택</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">옵션</label>
                      <select 
                        value={item.optionId} 
                        onChange={e => handleItemChange(index, 'optionId', e.target.value)} 
                        required 
                        disabled={!item.productId} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      >
                        <option value="">옵션 선택</option>
                        {selectedProduct?.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        min="1"
                        value={item.quantity} 
                        onChange={e => handleItemChange(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value))} 
                        required 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">개당 원가 (¥)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          placeholder="0.00" 
                          step="0.01"
                          min="0"
                          value={item.costCnyPerItem} 
                          onChange={e => handleItemChange(index, 'costCnyPerItem', e.target.value === '' ? '' : Number(e.target.value))} 
                          required 
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 font-medium">¥</div>
                      </div>
                    </div>
                    
                    <div className="flex items-end justify-between">
                      <button 
                        type="button" 
                        onClick={() => removeItem(index)} 
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                        disabled={items.length <= 1}
                        title="항목 삭제"
                      >
                        <XIcon />
                      </button>
                    </div>
                  </div>
                  
                  {isValid && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">소계:</span>
                        <div className="text-right">
                          <span className="text-gray-800">¥{itemTotalCny.toFixed(2)}</span>
                          <span className="text-green-600 font-semibold ml-2">≈ ₩{Math.round(itemTotalKrw).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <button 
            type="button" 
            onClick={addItem} 
            className="w-full inline-flex items-center justify-center py-2 px-4 border-2 border-dashed border-blue-300 text-blue-600 hover:text-blue-800 hover:border-blue-400 rounded-lg transition-colors font-medium text-sm"
          >
            <PlusIcon className="w-4 h-4 mr-1.5" />
            상품 추가
          </button>
        </div>

        {/* 추가 비용 */}
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            💰 추가 비용 (KRW)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">🚚 국제 배송비</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0" 
                  min="0"
                  value={shippingCostKrw} 
                  onChange={e => setShippingCostKrw(e.target.value === '' ? '' : Number(e.target.value))} 
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" 
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">₩</div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">🏛️ 관세 및 부가세</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0" 
                  min="0"
                  value={customsFeeKrw} 
                  onChange={e => setCustomsFeeKrw(e.target.value === '' ? '' : Number(e.target.value))} 
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" 
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">₩</div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">📋 기타 비용</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0" 
                  min="0"
                  value={otherFeeKrw} 
                  onChange={e => setOtherFeeKrw(e.target.value === '' ? '' : Number(e.target.value))} 
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" 
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">₩</div>
              </div>
            </div>
          </div>
        </div>

        {/* 실시간 계산 요약 */}
        {calculations.validItems.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              📊 매입 요약
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">총 상품 수량</p>
                <p className="text-xl font-bold text-gray-800">{calculations.totalQuantity}개</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">상품 비용 (¥)</p>
                <p className="text-xl font-bold text-gray-800">¥{calculations.itemsTotalCny.toFixed(2)}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">상품 비용 (₩)</p>
                <p className="text-xl font-bold text-gray-800">₩{Math.round(calculations.itemsTotalKrw).toLocaleString()}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">추가 비용</p>
                <p className="text-xl font-bold text-gray-800">₩{calculations.additionalCosts.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-green-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-800">총 매입 비용:</span>
                <span className="text-2xl font-bold text-green-600">₩{Math.round(calculations.totalCost).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex flex-row justify-end gap-2 pt-6 border-t border-gray-200">
          <button 
            type="button" 
            onClick={onCancel} 
            className="inline-flex items-center justify-center bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition duration-200 text-sm whitespace-nowrap"
          >
            취소
          </button>
          <button 
            type="submit" 
            disabled={calculations.validItems.length === 0}
            className="inline-flex items-center justify-center bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {calculations.validItems.length === 0 ? '상품을 추가해주세요' : `매입 등록 (₩${Math.round(calculations.totalCost).toLocaleString()})`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PurchaseForm;
