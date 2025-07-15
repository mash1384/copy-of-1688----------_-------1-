import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Purchase, Product, PurchaseItem } from '../types';
import { CNY_TO_KRW_RATE } from '../constants';
import Modal from './ui/Modal';
import PurchaseForm from './forms/PurchaseForm';
import { PlusIcon } from './icons/Icons';

interface PurchasesProps {
  purchases: Purchase[];
  products: Product[];
  onAddPurchase: (purchase: Omit<Purchase, 'id'>) => void;
}

const Purchases: React.FC<PurchasesProps> = ({ purchases, products, onAddPurchase }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'cost' | 'items'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedPurchase, setSelectedPurchase] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const getProductInfo = (productId: string, optionId: string) => {
    const product = products.find(p => p.id === productId);
    const option = product?.options.find(o => o.id === optionId);
    return { productName: product?.name, optionName: option?.name };
  };

  const calculateTotalPurchaseCost = (purchase: Purchase) => {
    const itemsTotalCny = purchase.items.reduce((sum, item) => sum + item.costCnyPerItem * item.quantity, 0);
    const itemsTotalKrw = itemsTotalCny * CNY_TO_KRW_RATE;
    const additionalCosts = purchase.shippingCostKrw + purchase.customsFeeKrw + purchase.otherFeeKrw;
    return itemsTotalKrw + additionalCosts;
  };

  const calculateActualCostPerItem = (purchase: Purchase, item: PurchaseItem) => {
    const itemBaseCostKrw = item.costCnyPerItem * CNY_TO_KRW_RATE * item.quantity;
    const itemRatio = itemBaseCostKrw / (purchase.items.reduce((sum, item) => sum + item.costCnyPerItem * CNY_TO_KRW_RATE * item.quantity, 0));
    const additionalCosts = purchase.shippingCostKrw + purchase.customsFeeKrw + purchase.otherFeeKrw;
    const itemAdditionalCost = additionalCosts * itemRatio;
    return (itemBaseCostKrw + itemAdditionalCost) / item.quantity;
  };

  const handleAddPurchase = (purchaseData: Omit<Purchase, 'id'>) => {
    onAddPurchase(purchaseData);
    setIsModalOpen(false);
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        setIsModalOpen(true);
      }
      if (event.key === 'Escape') {
        setIsModalOpen(false);
        setSelectedPurchase(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 필터링 및 정렬된 매입 목록
  const filteredAndSortedPurchases = useMemo(() => {
    let filtered = purchases.filter(purchase => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const hasMatchingProduct = purchase.items.some(item => {
          const { productName, optionName } = getProductInfo(item.productId, item.optionId);
          return (productName?.toLowerCase().includes(searchLower)) ||
            (optionName?.toLowerCase().includes(searchLower)) ||
            purchase.id.toLowerCase().includes(searchLower);
        });
        if (!hasMatchingProduct) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'cost':
          comparison = calculateTotalPurchaseCost(a) - calculateTotalPurchaseCost(b);
          break;
        case 'items':
          comparison = a.items.length - b.items.length;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [purchases, searchTerm, sortBy, sortOrder, products]);

  // 통계 계산
  const statistics = useMemo(() => {
    const totalPurchases = filteredAndSortedPurchases.length;
    const totalCost = filteredAndSortedPurchases.reduce((sum, purchase) => sum + calculateTotalPurchaseCost(purchase), 0);
    const totalItems = filteredAndSortedPurchases.reduce((sum, purchase) => sum + purchase.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const avgCostPerPurchase = totalPurchases > 0 ? totalCost / totalPurchases : 0;

    return { totalPurchases, totalCost, totalItems, avgCostPerPurchase };
  }, [filteredAndSortedPurchases]);

  const formatCurrency = (value: number) => `₩${Math.round(value).toLocaleString()}`;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 모던한 헤더 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                📦
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">매입 관리</h1>
                <p className="text-slate-600 mt-1">스마트한 매입 관리와 원가 분석</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  그리드
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  리스트
                </button>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                새 매입
              </button>
            </div>
          </div>
        </div>

        {/* 통계 대시보드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">총 매입 건수</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{statistics.totalPurchases}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-lg">📊</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">총 매입 비용</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(statistics.totalCost)}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 text-lg">💰</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">총 상품 수량</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{statistics.totalItems}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 text-lg">📦</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">평균 매입 비용</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(statistics.avgCostPerPurchase)}</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 text-lg">📈</span>
              </div>
            </div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="상품명, 옵션명, 매입 ID로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'cost' | 'items')}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="date">날짜순</option>
                <option value="cost">비용순</option>
                <option value="items">상품수순</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="desc">내림차순</option>
                <option value="asc">오름차순</option>
              </select>
            </div>
          </div>
        </div>

        {/* 매입 목록 */}
        {filteredAndSortedPurchases.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📦</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">매입 내역이 없습니다</h3>
            <p className="text-slate-600 mb-6">첫 번째 매입을 등록해보세요</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              매입 등록하기
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAndSortedPurchases.map(purchase => {
              const totalCost = calculateTotalPurchaseCost(purchase);
              const totalQuantity = purchase.items.reduce((sum, item) => sum + item.quantity, 0);
              const isSelected = selectedPurchase === purchase.id;

              return (
                <div
                  key={purchase.id}
                  className={`bg-white rounded-xl shadow-sm border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-blue-500 ring-2 ring-blue-200' 
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                  onClick={() => setSelectedPurchase(isSelected ? null : purchase.id)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">
                          매입 #{purchase.id}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {new Date(purchase.date).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          {purchase.items.length}개 상품
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          {totalQuantity}개
                        </span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-2xl font-bold text-slate-900 mb-1">
                        {formatCurrency(totalCost)}
                      </div>
                      <div className="flex space-x-4 text-sm text-slate-600">
                        {purchase.shippingCostKrw > 0 && (
                          <span>배송비 {formatCurrency(purchase.shippingCostKrw)}</span>
                        )}
                        {purchase.customsFeeKrw > 0 && (
                          <span>관세 {formatCurrency(purchase.customsFeeKrw)}</span>
                        )}
                      </div>
                    </div>

                    {/* 상품 미리보기 */}
                    <div className="space-y-2">
                      {purchase.items.slice(0, 2).map(item => {
                        const { productName, optionName } = getProductInfo(item.productId, item.optionId);
                        return (
                          <div key={`${purchase.id}-${item.optionId}`} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {productName || '삭제된 상품'}
                              </p>
                              <p className="text-xs text-slate-600">
                                {optionName || '삭제된 옵션'} • {item.quantity}개
                              </p>
                            </div>
                            <div className="text-sm font-medium text-slate-900">
                              ¥{item.costCnyPerItem.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                      {purchase.items.length > 2 && (
                        <div className="text-center py-2 text-sm text-slate-500">
                          +{purchase.items.length - 2}개 더보기
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 상세 정보 (확장 시) */}
                  {isSelected && (
                    <div className="border-t border-slate-200 p-6 bg-slate-50">
                      <h4 className="font-semibold text-slate-900 mb-4">상세 내역</h4>
                      <div className="space-y-3">
                        {purchase.items.map(item => {
                          const { productName, optionName } = getProductInfo(item.productId, item.optionId);
                          const actualCost = calculateActualCostPerItem(purchase, item);
                          const baseCostKrw = item.costCnyPerItem * CNY_TO_KRW_RATE;
                          const totalItemCost = actualCost * item.quantity;

                          return (
                            <div key={`${purchase.id}-${item.optionId}`} className="bg-white p-4 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h5 className="font-medium text-slate-900 mb-1">
                                    {productName || '삭제된 상품'}
                                  </h5>
                                  <p className="text-sm text-slate-600 mb-2">
                                    {optionName || '삭제된 옵션'}
                                  </p>
                                  <div className="flex space-x-3 text-xs text-slate-500">
                                    <span>수량: {item.quantity}개</span>
                                    <span>단가: ¥{item.costCnyPerItem.toFixed(2)}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-slate-600">
                                    기본: {formatCurrency(baseCostKrw)}
                                  </p>
                                  <p className="text-sm font-semibold text-blue-600">
                                    실제: {formatCurrency(actualCost)}
                                  </p>
                                  <p className="text-lg font-bold text-slate-900">
                                    {formatCurrency(totalItemCost)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedPurchases.map(purchase => {
              const totalCost = calculateTotalPurchaseCost(purchase);
              const totalQuantity = purchase.items.reduce((sum, item) => sum + item.quantity, 0);
              const isSelected = selectedPurchase === purchase.id;

              return (
                <div
                  key={purchase.id}
                  className={`bg-white rounded-xl shadow-sm border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-blue-500 ring-2 ring-blue-200' 
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                  onClick={() => setSelectedPurchase(isSelected ? null : purchase.id)}
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            매입 #{purchase.id}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {new Date(purchase.date).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            {purchase.items.length}개 상품
                          </span>
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            {totalQuantity}개
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-slate-900">
                          {formatCurrency(totalCost)}
                        </div>
                        <div className="flex space-x-4 text-sm text-slate-600">
                          {purchase.shippingCostKrw > 0 && (
                            <span>배송비 {formatCurrency(purchase.shippingCostKrw)}</span>
                          )}
                          {purchase.customsFeeKrw > 0 && (
                            <span>관세 {formatCurrency(purchase.customsFeeKrw)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 리스트 뷰에서는 상품 미리보기를 가로로 표시 */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {purchase.items.slice(0, 3).map(item => {
                        const { productName, optionName } = getProductInfo(item.productId, item.optionId);
                        return (
                          <div key={`${purchase.id}-${item.optionId}`} className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-lg">
                            <span className="text-sm font-medium text-slate-900">
                              {productName || '삭제된 상품'}
                            </span>
                            <span className="text-xs text-slate-600">
                              {optionName || '삭제된 옵션'} • {item.quantity}개
                            </span>
                            <span className="text-sm font-medium text-slate-900">
                              ¥{item.costCnyPerItem.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                      {purchase.items.length > 3 && (
                        <div className="flex items-center px-3 py-2 text-sm text-slate-500">
                          +{purchase.items.length - 3}개 더
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 상세 정보 (확장 시) */}
                  {isSelected && (
                    <div className="border-t border-slate-200 p-6 bg-slate-50">
                      <h4 className="font-semibold text-slate-900 mb-4">상세 내역</h4>
                      <div className="space-y-3">
                        {purchase.items.map(item => {
                          const { productName, optionName } = getProductInfo(item.productId, item.optionId);
                          const actualCost = calculateActualCostPerItem(purchase, item);
                          const baseCostKrw = item.costCnyPerItem * CNY_TO_KRW_RATE;
                          const totalItemCost = actualCost * item.quantity;

                          return (
                            <div key={`${purchase.id}-${item.optionId}`} className="bg-white p-4 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h5 className="font-medium text-slate-900 mb-1">
                                    {productName || '삭제된 상품'}
                                  </h5>
                                  <p className="text-sm text-slate-600 mb-2">
                                    {optionName || '삭제된 옵션'}
                                  </p>
                                  <div className="flex space-x-3 text-xs text-slate-500">
                                    <span>수량: {item.quantity}개</span>
                                    <span>단가: ¥{item.costCnyPerItem.toFixed(2)}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-slate-600">
                                    기본: {formatCurrency(baseCostKrw)}
                                  </p>
                                  <p className="text-sm font-semibold text-blue-600">
                                    실제: {formatCurrency(actualCost)}
                                  </p>
                                  <p className="text-lg font-bold text-slate-900">
                                    {formatCurrency(totalItemCost)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="새 매입 등록">
          <PurchaseForm
            products={products}
            onAddPurchase={handleAddPurchase}
            onCancel={() => setIsModalOpen(false)}
          />
        </Modal>
      </div>
    </div>
  );
};

export default Purchases;