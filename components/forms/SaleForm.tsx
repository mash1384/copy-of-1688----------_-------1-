import * as React from 'react';
import { useState, useEffect } from 'react';
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
  const [shippingCostKrw, setShippingCostKrw] = useState<number | ''>(
    ''
  );

  useEffect(() => {
    setPackagingCostKrw(settings.defaultPackagingCostKrw);
    setShippingCostKrw(settings.defaultShippingCostKrw);
  }, [settings]);
  
  const selectedProduct = products.find(p => p.id === productId);
  const selectedOption = selectedProduct?.options.find(o => o.id === optionId);

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


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
          <label htmlFor="saleDate" className="block text-sm font-medium text-gray-700">판매 날짜</label>
          <input type="date" id="saleDate" value={date} onChange={e => setDate(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label htmlFor="product" className="block text-sm font-medium text-gray-700">상품</label>
            <select id="product" value={productId} onChange={e => {setProductId(e.target.value); setOptionId('');}} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                <option value="">상품 선택</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
        </div>
        <div>
            <label htmlFor="option" className="block text-sm font-medium text-gray-700">옵션</label>
            <select id="option" value={optionId} onChange={e => setOptionId(e.target.value)} required disabled={!productId} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                <option value="">옵션 선택</option>
                {selectedProduct?.options.map(o => <option key={o.id} value={o.id}>{o.name} (재고: {o.stock})</option>)}
            </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">수량</label>
            <input type="number" id="quantity" value={quantity} onChange={handleNumericChange(setQuantity)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" min="1" max={selectedOption?.stock}/>
        </div>
        <div>
            <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700">개당 판매가 (KRW)</label>
            <input type="number" id="salePrice" value={salePricePerItem} onChange={handleNumericChange(setSalePricePerItem)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
        </div>
      </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label htmlFor="channel" className="block text-sm font-medium text-gray-700">판매 채널</label>
            <select id="channel" value={channel} onChange={e => setChannel(e.target.value as SalesChannel)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                {Object.values(SalesChannel).map(ch => <option key={ch} value={ch}>{ch}</option>)}
            </select>
        </div>
        <div>
            <label htmlFor="channelFee" className="block text-sm font-medium text-gray-700">채널 수수료 (%)</label>
            <input type="number" id="channelFee" step="0.1" value={channelFeePercentage} onChange={handleNumericChange(setChannelFeePercentage)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
        </div>
      </div>
      <div className="pt-4 border-t">
         <h4 className="text-md font-medium text-gray-800">기타 비용 (KRW)</h4>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label htmlFor="packagingCost" className="block text-sm font-medium text-gray-700">포장비</label>
              <input type="number" id="packagingCost" value={packagingCostKrw} onChange={handleNumericChange(setPackagingCostKrw)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
            </div>
            <div>
              <label htmlFor="shippingCost" className="block text-sm font-medium text-gray-700">국내 배송비</label>
              <input type="number" id="shippingCost" value={shippingCostKrw} onChange={handleNumericChange(setShippingCostKrw)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
            </div>
         </div>
       </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <button type="button" onClick={onCancel} className="inline-flex items-center justify-center bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition duration-200 text-sm whitespace-nowrap">취소</button>
        <button type="submit" className="inline-flex items-center justify-center bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 text-sm whitespace-nowrap">등록</button>
      </div>
    </form>
  );
};

export default SaleForm;