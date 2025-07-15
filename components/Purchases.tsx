
import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Purchase, Product, PurchaseItem } from '../types';
import Card from './ui/Card';
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
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [expandedPurchases, setExpandedPurchases] = useState<Set<string>>(new Set());

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
  }

  const calculateActualCostPerItem = (purchase: Purchase, item: PurchaseItem) => {
    const itemBaseCostKrw = item.costCnyPerItem * CNY_TO_KRW_RATE * item.quantity;
    const itemRatio = itemBaseCostKrw / (purchase.items.reduce((sum, item) => sum + item.costCnyPerItem * CNY_TO_KRW_RATE * item.quantity, 0));
    const additionalCosts = purchase.shippingCostKrw + purchase.customsFeeKrw + purchase.otherFeeKrw;
    const itemAdditionalCost = additionalCosts * itemRatio;
    return (itemBaseCostKrw + itemAdditionalCost) / item.quantity;
  }

  const handleAddPurchase = (purchaseData: Omit<Purchase, 'id'>) => {
    onAddPurchase(purchaseData);
    setIsModalOpen(false);
  }

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + N: 새 매입 등록
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        setIsModalOpen(true);
      }
      // Escape: 모달 닫기
      if (event.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
      // Ctrl/Cmd + F: 검색 포커스
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="검색"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const togglePurchaseExpansion = (purchaseId: string) => {
    const newExpanded = new Set(expandedPurchases);
    if (newExpanded.has(purchaseId)) {
      newExpanded.delete(purchaseId);
    } else {
      newExpanded.add(purchaseId);
    }
    setExpandedPurchases(newExpanded);
  }

  // 필터링 및 정렬된 매입 목록
  const filteredAndSortedPurchases = useMemo(() => {
    let filtered = purchases.filter(purchase => {
      // 검색어 필터
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

      // 날짜 필터
      if (dateFilter.start && purchase.date < dateFilter.start) return false;
      if (dateFilter.end && purchase.date > dateFilter.end) return false;

      return true;
    });

    // 정렬
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
  }, [purchases, searchTerm, dateFilter, sortBy, sortOrder, products]);

  // 통계 계산
  const statistics = useMemo(() => {
    const totalPurchases = filteredAndSortedPurchases.length;
    const totalCost = filteredAndSortedPurchases.reduce((sum, purchase) => sum + calculateTotalPurchaseCost(purchase), 0);
    const totalItems = filteredAndSortedPurchases.reduce((sum, purchase) => sum + purchase.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const avgCostPerPurchase = totalPurchases > 0 ? totalCost / totalPurchases : 0;

    return { totalPurchases, totalCost, totalItems, avgCostPerPurchase };
  }, [filteredAndSortedPurchases]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">매입 관리</h1>
          <p className="text-gray-600 mt-1">상품 매입 내역을 관리하고 원가를 분석하세요</p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded">⌘+N 새 매입</span>
            <span className="bg-gray-100 px-2 py-1 rounded">⌘+F 검색</span>
            <span className="bg-gray-100 px-2 py-1 rounded">ESC 닫기</span>
          </div>
        </div>
        <div className="flex flex-row gap-2 flex-wrap">
          <button
            onClick={() => setExpandedPurchases(new Set(filteredAndSortedPurchases.map(p => p.id)))}
            className="inline-flex items-center justify-center bg-gray-100 text-gray-700 font-medium py-2 px-3 rounded-lg hover:bg-gray-200 transition duration-200 text-sm whitespace-nowrap"
          >
            모두 펼치기
          </button>
          <button
            onClick={() => setExpandedPurchases(new Set())}
            className="inline-flex items-center justify-center bg-gray-100 text-gray-700 font-medium py-2 px-3 rounded-lg hover:bg-gray-200 transition duration-200 text-sm whitespace-nowrap"
          >
            모두 접기
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 text-sm whitespace-nowrap">
            <PlusIcon className="w-4 h-4 mr-1.5" />
            새 매입 등록
          </button>
        </div>
      </div>

      {/* 통계 대시보드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">총 매입 건수</p>
              <p className="text-2xl font-bold text-blue-800">{statistics.totalPurchases}</p>
            </div>
            <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-xl">📦</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">총 매입 비용</p>
              <p className="text-2xl font-bold text-green-800">₩{statistics.totalCost.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xl">💰</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">총 상품 수량</p>
              <p className="text-2xl font-bold text-purple-800">{statistics.totalItems}</p>
            </div>
            <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
              <span className="text-purple-600 text-xl">📊</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">평균 매입 비용</p>
              <p className="text-2xl font-bold text-orange-800">₩{Math.round(statistics.avgCostPerPurchase).toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center">
              <span className="text-orange-600 text-xl">📈</span>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
            <input
              type="text"
              placeholder="상품명, 옵션명, 매입 ID 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">정렬 기준</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'cost' | 'items')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">날짜순</option>
              <option value="cost">비용순</option>
              <option value="items">상품 수량순</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">정렬 순서</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="desc">내림차순</option>
              <option value="asc">오름차순</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">기간 필터</label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        {(searchTerm || dateFilter.start || dateFilter.end) && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {filteredAndSortedPurchases.length}개의 매입 내역이 검색되었습니다
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setDateFilter({ start: '', end: '' });
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              필터 초기화
            </button>
          </div>
        )}
      </div>

      {/* 매입 목록 */}
      <div className="space-y-4">
        {filteredAndSortedPurchases.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">매입 내역이 없습니다</h3>
            <p className="text-gray-500 mb-6">첫 번째 매입을 등록해보세요</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 text-sm whitespace-nowrap">
              <PlusIcon className="w-4 h-4 mr-1.5" />
              매입 등록하기
            </button>
          </div>
        ) : (
          filteredAndSortedPurchases.map(purchase => {
            const isExpanded = expandedPurchases.has(purchase.id);
            const totalCost = calculateTotalPurchaseCost(purchase);
            const totalQuantity = purchase.items.reduce((sum, item) => sum + item.quantity, 0);

            return (
              <Card key={purchase.id}>
                <div
                  className="cursor-pointer"
                  onClick={() => togglePurchaseExpansion(purchase.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg text-gray-800">매입 #{purchase.id}</h3>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          {purchase.items.length}개 상품
                        </span>
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          총 {totalQuantity}개
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-1">📅 {new Date(purchase.date).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short'
                      })}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                        {purchase.shippingCostKrw > 0 && (
                          <span className="bg-gray-100 px-2 py-1 rounded">배송비 ₩{purchase.shippingCostKrw.toLocaleString()}</span>
                        )}
                        {purchase.customsFeeKrw > 0 && (
                          <span className="bg-gray-100 px-2 py-1 rounded">관세 ₩{purchase.customsFeeKrw.toLocaleString()}</span>
                        )}
                        {purchase.otherFeeKrw > 0 && (
                          <span className="bg-gray-100 px-2 py-1 rounded">기타 ₩{purchase.otherFeeKrw.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xl text-gray-800 mb-1">
                        ₩{totalCost.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">총 매입 비용</p>
                      <div className="mt-2">
                        <span className={`inline-block w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-4">상품 상세 내역</h4>
                    <div className="space-y-4">
                      {purchase.items.map(item => {
                        const { productName, optionName } = getProductInfo(item.productId, item.optionId);
                        const actualCost = calculateActualCostPerItem(purchase, item);
                        const baseCostKrw = item.costCnyPerItem * CNY_TO_KRW_RATE;
                        const totalItemCost = actualCost * item.quantity;

                        return (
                          <div key={`${purchase.id}-${item.optionId}`} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-800 mb-1">
                                  {productName || '삭제된 상품'}
                                </h5>
                                <p className="text-sm text-gray-600 mb-2">
                                  {optionName || '삭제된 옵션'}
                                </p>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="bg-white px-3 py-1 rounded border">
                                    수량: {item.quantity}개
                                  </span>
                                  <span className="bg-white px-3 py-1 rounded border">
                                    원화 환율: ¥{item.costCnyPerItem.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="space-y-1">
                                  <p className="text-sm text-gray-600">
                                    기본 원가: ₩{Math.round(baseCostKrw).toLocaleString()}
                                  </p>
                                  <p className="text-sm font-semibold text-blue-600">
                                    실제 개당 원가: ₩{Math.round(actualCost).toLocaleString()}
                                  </p>
                                  <p className="text-lg font-bold text-gray-800">
                                    소계: ₩{Math.round(totalItemCost).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="새 매입 등록">
        <PurchaseForm
          products={products}
          onAddPurchase={handleAddPurchase}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default Purchases;
