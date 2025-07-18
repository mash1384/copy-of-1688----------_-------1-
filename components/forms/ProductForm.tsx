import * as React from 'react';
import { useState, useEffect } from 'react';
import { Product } from '../../types';
import { PlusIcon, XIcon } from '../icons/Icons';
import ImageDropzone from '../ui/ImageDropzone';

interface ProductFormProps {
  productToEdit: Product | null;
  onSave: (product: Product) => void;
  onCancel: () => void;
}

const uuid = () => `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const ProductForm: React.FC<ProductFormProps> = ({ productToEdit, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [chineseName, setChineseName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [baseCostCny, setBaseCostCny] = useState<number | ''>('');
  const [options, setOptions] = useState<{ name: string; sku: string }[]>([{ name: '', sku: '' }]);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setChineseName(productToEdit.chineseName || '');
      setSourceUrl(productToEdit.sourceUrl || '');
      setImageUrl(productToEdit.imageUrl);
      setBaseCostCny(productToEdit.baseCostCny);
      setOptions(productToEdit.options.map(({ name, sku }) => ({ name, sku })));
    } else {
      setName('');
      setChineseName('');
      setSourceUrl('');
      setImageUrl(null);
      setBaseCostCny('');
      setOptions([{ name: '', sku: '' }]);
    }
  }, [productToEdit]);

  const handleOptionChange = (index: number, field: 'name' | 'sku', value: string) => {
    const newOptions = [...options];
    newOptions[index][field] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, { name: '', sku: '' }]);
  };

  const removeOption = (index: number) => {
    if (options.length > 1) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof baseCostCny !== 'number' || !imageUrl) {
      alert("이미지를 포함한 모든 필수 항목을 입력해주세요.");
      return;
    }

    const newProductData: Product = {
      id: productToEdit ? productToEdit.id : uuid(),
      name,
      chineseName: chineseName || undefined,
      sourceUrl: sourceUrl || undefined,
      imageUrl,
      baseCostCny,
      options: options.map((opt, index) => {
        const existingOption = productToEdit?.options[index];
        return {
          id: existingOption?.id || uuid(),
          name: opt.name,
          sku: opt.sku,
          stock: existingOption?.stock || 0,
          costOfGoods: existingOption?.costOfGoods || 0,
        }
      }),
    };
    onSave(newProductData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">상품 이미지</label>
        <ImageDropzone
          imageUrl={imageUrl}
          onImageChange={setImageUrl}
        />
      </div>
      <div>
        <label htmlFor="productName" className="block text-sm font-medium text-gray-700">상품명 (한국어)</label>
        <input type="text" id="productName" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="예: 여성 니트 스웨터" />
      </div>
      
      <div>
        <label htmlFor="chineseName" className="block text-sm font-medium text-gray-700">중국어 상품명</label>
        <input 
          type="text" 
          id="chineseName" 
          value={chineseName} 
          onChange={e => setChineseName(e.target.value)} 
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
          placeholder="例: 女士针织毛衣"
        />
        <p className="mt-1 text-xs text-gray-500">1688에서 복사한 중국어 상품명을 입력하세요 (선택사항)</p>
      </div>

      <div>
        <label htmlFor="sourceUrl" className="block text-sm font-medium text-gray-700">1688 상품 URL</label>
        <input 
          type="url" 
          id="sourceUrl" 
          value={sourceUrl} 
          onChange={e => setSourceUrl(e.target.value)} 
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
          placeholder="https://detail.1688.com/offer/..."
        />
        <p className="mt-1 text-xs text-gray-500">1688 상품 페이지 링크를 입력하세요 (선택사항)</p>
      </div>
      
      <div>
        <label htmlFor="baseCostCny" className="block text-sm font-medium text-gray-700">1688 매입 원가 (위안)</label>
        <div className="mt-1 relative">
          <input type="number" id="baseCostCny" value={baseCostCny} onChange={e => setBaseCostCny(Number(e.target.value))} required className="block w-full px-3 py-2 pr-12 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="0.00" step="0.01" />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 text-sm">¥</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">1688에서 확인한 개당 매입가를 위안(¥) 단위로 입력하세요</p>
      </div>
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-800">상품 옵션</h4>
        {options.map((option, index) => (
          <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
            <input type="text" placeholder="옵션명 (예: 화이트 / M)" value={option.name} onChange={e => handleOptionChange(index, 'name', e.target.value)} required className="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
            <input type="text" placeholder="SKU" value={option.sku} onChange={e => handleOptionChange(index, 'sku', e.target.value)} required className="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
            <button type="button" onClick={() => removeOption(index)} className="text-red-500 hover:text-red-700 disabled:opacity-50" disabled={options.length <= 1}>
              <XIcon />
            </button>
          </div>
        ))}
        <button type="button" onClick={addOption} className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 font-medium text-sm transition duration-200">
          <PlusIcon className="w-4 h-4 mr-1.5" />
          옵션 추가
        </button>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <button type="button" onClick={onCancel} className="inline-flex items-center justify-center bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition duration-200 text-sm whitespace-nowrap">취소</button>
        <button type="submit" className="inline-flex items-center justify-center bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 text-sm whitespace-nowrap">저장</button>
      </div>
    </form>
  );
};

export default ProductForm;