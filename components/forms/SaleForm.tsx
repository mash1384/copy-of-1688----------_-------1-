import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Product, Sale, SalesChannel, AppSettings } from '../../types';

interface SaleFormProps {
  products: Product[];
  settings: AppSettings;
  onAddSale: (sale: Omit<Sale, 'id'>) => void;
  onCancel: () => void;
}

const SaleForm: React.FC<SaleFormProps> = ({ products, settings, onAddSale, onCancel }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [productId, setProductId] = useState('');
  const [optionId, setOptionId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [salePricePerItem, setSalePricePerItem] = useState<number | ''>('');
  const [channel, setChannel] = useState<SalesChannel>(SalesChannel.SMART_STORE);
  const [channelFeePercentage, setChannelFeePercentage] = useState<number | ''>('');
  const [packagingCostKrw, setPackagingCostKrw] = useState<number | ''>('');
  const [shippingCostKrw, setShippingCostKrw] = useState<number | ''>('');

  useEffect(() => {
    setPackagingCostKrw(settings.defaultPackagingCostKrw);
    setShippingCostKrw(settings.defaultShippingCostKrw);
  }, [settings]);
  
  const selectedProduct = products.find(p => p.id === productId);
  const selectedOption = selectedProduct?.options.find(o => o.id === optionId);

  // 실시간 수익 계산
  const profitCalculation = useMemo(() => {
    if (!selectedOption || !quantity || !salePricePerItem || !channelFeePercentage || !packagingCostKrw || !shippingCostKrw) {
      return null;
    }

    const qty = Number(quantity);
    const price = Number(salePricePerItem);
    const fee = Number(channelFeePercentage);
    const packaging = Number(packagingCostKrw);
    const shipping = Number(shippingCostKrw);

    const totalRevenue = qty * price;
    const costOfGoods = qty * selectedOption.costOfGoods;
    const channelFee = totalRevenue * (fee / 100);
    const totalPackaging = packaging * qty;
    const totalShipping = shipping * qty;
    const totalCosts = costOfGoods + channelFee + totalPackaging + totalShipping;
    const profit = totalRevenue - totalCosts;
    const marginRate = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      costOfGoods,
      channelFee,
      totalPackaging,
      totalShipping,
      totalCosts,
      profit,
      marginRate
    };
  }, [selectedOption, quantity, salePricePerItem, channelFeePercentage, packagingCostKrw, shippingCostKrw]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const saleQty = Number(quantity);
    const price = Number(salePricePerItem);
    const fee = Number(channelFeePercentage);
    const packagingCost = Number(packagingCostKrw);
    const shippingCost = Number(shippingCostKrw);

    if (!productId || !optionId || !saleQty || !price || isNaN(fee) || isNaN(packagingCost) || isNaN(shippingCost)) {
        alert("모든 필드를 올바르게 입력해주세요.");
        return;
    }
    if(selectedOption && saleQty > selectedOption.stock) {
        alert(`재고가 부족합니다. 현재 재고: ${selectedOption.stock}개`);
        return;
    }

    onAddSale({
      date,
      productId,
      optionId,
      quantity: saleQty,
      salePricePerItem: price,
      channel,
      channelFeePercentage: fee,
      packagingCostKrw: packagingCost,
      shippingCostKrw: shippingCost,
    });
  };

  const handleNumericChange = (setter: React.Dispatch<React.SetStateAction<number | ''>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setter(value === '' ? '' : Number(value));
  };

  const formatCurrency = (value: number) => `₩${Math.round(value).toLocaleString()}`;

  return (
    <div className="max-w-5xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* 기본 정보 섹션 */}
        <div className="bg-slate-50 rounded-lg p-4">
          <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center">
            <span className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center mr-2 text-blue-600 text-sm">📅</span>
            기본 정보
          </h3>
          
          <div className="space-y-3">
            <div>
              <label htmlFor="saleDate" className="block text-sm font-medium text-slate-700 mb-2">판매 날짜</label>
              <input 
                type="date" 
                id="saleDate" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                required 
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label htmlFor="product" className="block text-sm font-medium text-slate-700 mb-2">상품</label>
                <select 
                  id="product" 
                  value={productId} 
                  onChange={e => {setProductId(e.target.value); setOptionId('');}} 
                  required 
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  <option value="">상품을 선택하세요</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              
              <div>
                <label htmlFor="option" className="block text-sm font-medium text-slate-700 mb-2">옵션</label>
                <select 
                  id="option" 
                  value={optionId} 
                  onChange={e => setOptionId(e.target.value)} 
                  required 
                  disabled={!productId} 
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">옵션을 선택하세요</option>
                  {selectedProduct?.options.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name} (재고: {o.stock}개, 원가: ₩{o.costOfGoods.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 판매 정보 & 채널 정보 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center">
              <span className="w-6 h-6 bg-green-100 rounded-md flex items-center justify-center mr-2 text-green-600 text-sm">💰</span>
              판매 정보
            </h3>
            
            <div className="space-y-3">
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 mb-1">판매 수량</label>
                <div className="relative">
                  <input 
                    type="number" 
                    id="quantity" 
                    value={quantity} 
                    onChange={handleNumericChange(setQuantity)} 
                    required 
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors pr-10" 
                    min="1" 
                    max={selectedOption?.stock}
                    placeholder="수량"
                  />
                  <span className="absolute right-3 top-2 text-slate-500 text-sm">개</span>
                </div>
                {selectedOption && (
                  <p className="text-xs text-slate-600 mt-1">최대 {selectedOption.stock}개</p>
                )}
              </div>
              
              <div>
                <label htmlFor="salePrice" className="block text-sm font-medium text-slate-700 mb-1">개당 판매가</label>
                <div className="relative">
                  <input 
                    type="number" 
                    id="salePrice" 
                    value={salePricePerItem} 
                    onChange={handleNumericChange(setSalePricePerItem)} 
                    required 
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors pl-7"
                    placeholder="판매가"
                  />
                  <span className="absolute left-3 top-2 text-slate-500 text-sm">₩</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center">
              <span className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center mr-2 text-orange-600 text-sm">🏪</span>
              채널 & 수수료
            </h3>
            
            <div className="space-y-3">
              <div>
                <label htmlFor="channel" className="block text-sm font-medium text-slate-700 mb-1">판매 채널</label>
                <select 
                  id="channel" 
                  value={channel} 
                  onChange={e => setChannel(e.target.value as SalesChannel)} 
                  required 
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                >
                  {Object.values(SalesChannel).map(ch => <option key={ch} value={ch}>{ch}</option>)}
                </select>
              </div>
              
              <div>
                <label htmlFor="channelFee" className="block text-sm font-medium text-slate-700 mb-1">채널 수수료</label>
                <div className="relative">
                  <input 
                    type="number" 
                    id="channelFee" 
                    step="0.1" 
                    value={channelFeePercentage} 
                    onChange={handleNumericChange(setChannelFeePercentage)} 
                    required 
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors pr-7"
                    placeholder="수수료율"
                  />
                  <span className="absolute right-3 top-2 text-slate-500 text-sm">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 기타 비용 섹션 */}
        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center">
            <span className="w-6 h-6 bg-purple-100 rounded-md flex items-center justify-center mr-2 text-purple-600 text-sm">📦</span>
            기타 비용
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label htmlFor="packagingCost" className="block text-sm font-medium text-slate-700 mb-1">개당 포장비</label>
              <div className="relative">
                <input 
                  type="number" 
                  id="packagingCost" 
                  value={packagingCostKrw} 
                  onChange={handleNumericChange(setPackagingCostKrw)} 
                  required 
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors pl-7"
                  placeholder="포장비"
                />
                <span className="absolute left-3 top-2 text-slate-500 text-sm">₩</span>
              </div>
            </div>
            
            <div>
              <label htmlFor="shippingCost" className="block text-sm font-medium text-slate-700 mb-1">개당 배송비</label>
              <div className="relative">
                <input 
                  type="number" 
                  id="shippingCost" 
                  value={shippingCostKrw} 
                  onChange={handleNumericChange(setShippingCostKrw)} 
                  required 
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors pl-7"
                  placeholder="배송비"
                />
                <span className="absolute left-3 top-2 text-slate-500 text-sm">₩</span>
              </div>
            </div>
          </div>
        </div>

        {/* 수익 미리보기 */}
        {profitCalculation && (
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
            <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center">
              <span className="w-6 h-6 bg-slate-200 rounded-md flex items-center justify-center mr-2 text-sm">📊</span>
              수익 미리보기
            </h3>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-md p-3 border border-slate-200 text-center">
                <p className="text-xs text-slate-600 mb-1">총 매출</p>
                <p className="text-sm font-bold text-green-600">{formatCurrency(profitCalculation.totalRevenue)}</p>
              </div>
              
              <div className="bg-white rounded-md p-3 border border-slate-200 text-center">
                <p className="text-xs text-slate-600 mb-1">총 비용</p>
                <p className="text-sm font-bold text-red-500">{formatCurrency(profitCalculation.totalCosts)}</p>
              </div>
              
              <div className="bg-white rounded-md p-3 border border-slate-200 text-center">
                <p className="text-xs text-slate-600 mb-1">순이익</p>
                <p className={`text-sm font-bold ${profitCalculation.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(profitCalculation.profit)}
                </p>
              </div>
              
              <div className="bg-white rounded-md p-3 border border-slate-200 text-center">
                <p className="text-xs text-slate-600 mb-1">마진율</p>
                <p className={`text-sm font-bold ${profitCalculation.marginRate > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {profitCalculation.marginRate.toFixed(1)}%
                </p>
              </div>
            </div>
            
            <div className="mt-3 p-3 bg-white rounded-md border border-slate-200">
              <p className="text-xs text-slate-600 mb-2">비용 상세</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 text-xs text-slate-700">
                <span>원가: {formatCurrency(profitCalculation.costOfGoods)}</span>
                <span>수수료: {formatCurrency(profitCalculation.channelFee)}</span>
                <span>포장비: {formatCurrency(profitCalculation.totalPackaging)}</span>
                <span>배송비: {formatCurrency(profitCalculation.totalShipping)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-200">
          <button 
            type="button" 
            onClick={onCancel} 
            className="flex-1 sm:flex-none px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
          >
            취소
          </button>
          <button 
            type="submit" 
            className="flex-1 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl"
          >
            매출 등록하기
          </button>
        </div>
      </form>
    </div>
  );
};

export default SaleForm;