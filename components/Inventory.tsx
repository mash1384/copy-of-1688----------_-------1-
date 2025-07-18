
import * as React from 'react';
import { useState, useMemo } from 'react';
import { Product } from '../types';
import Card from './ui/Card';

interface InventoryProps {
  products: Product[];
}

const LOW_STOCK_THRESHOLD = 10;
const CRITICAL_STOCK_THRESHOLD = 5;

const Inventory: React.FC<InventoryProps> = ({ products }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out' | 'good'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'value'>('name');

  // 재고 데이터 계산
  const inventoryData = useMemo(() => {
    const items = products.flatMap(product =>
      product.options.map(option => ({
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrl,
        optionId: option.id,
        optionName: option.name,
        sku: option.sku,
        stock: option.stock,
        costOfGoods: option.costOfGoods,
        totalValue: option.stock * option.costOfGoods,
        status: option.stock <= 0 ? 'out' : 
                option.stock <= CRITICAL_STOCK_THRESHOLD ? 'critical' :
                option.stock <= LOW_STOCK_THRESHOLD ? 'low' : 'good'
      }))
    );

    // 필터링
    let filtered = items.filter(item => {
      const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.optionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterStatus === 'all' || 
                           (filterStatus === 'out' && item.status === 'out') ||
                           (filterStatus === 'low' && (item.status === 'low' || item.status === 'critical')) ||
                           (filterStatus === 'good' && item.status === 'good');
      
      return matchesSearch && matchesFilter;
    });

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.productName.localeCompare(b.productName);
        case 'stock':
          return a.stock - b.stock;
        case 'value':
          return b.totalValue - a.totalValue;
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, searchTerm, filterStatus, sortBy]);

  // 통계 계산
  const stats = useMemo(() => {
    const totalItems = inventoryData.length;
    const totalValue = inventoryData.reduce((sum, item) => sum + item.totalValue, 0);
    const outOfStock = inventoryData.filter(item => item.status === 'out').length;
    const lowStock = inventoryData.filter(item => item.status === 'low' || item.status === 'critical').length;
    const totalQuantity = inventoryData.reduce((sum, item) => sum + item.stock, 0);

    return { totalItems, totalValue, outOfStock, lowStock, totalQuantity };
  }, [inventoryData]);

  const formatCurrency = (value: number) => `₩${Math.round(value).toLocaleString()}`;

  const getStatusBadge = (status: string, stock: number) => {
    switch (status) {
      case 'out':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
            품절
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
            긴급
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
            부족
          </span>
        );
      case 'good':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
            양호
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 헤더 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                📦
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">재고 현황</h1>
                <p className="text-slate-600 mt-1">실시간 재고 관리 및 모니터링</p>
              </div>
            </div>
          </div>
        </div>

        {/* 통계 대시보드 */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">총 상품 수</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalItems}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-lg">📊</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">총 재고량</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalQuantity.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 text-lg">📦</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">재고 가치</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.totalValue)}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 text-lg">💰</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">재고 부족</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.lowStock}</p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 text-lg">⚠️</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">품절 상품</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats.outOfStock}</p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-red-600 text-lg">🚫</span>
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
                placeholder="상품명, 옵션명, SKU로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">전체 상태</option>
                <option value="good">재고 양호</option>
                <option value="low">재고 부족</option>
                <option value="out">품절</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="name">상품명순</option>
                <option value="stock">재고량순</option>
                <option value="value">가치순</option>
              </select>
            </div>
          </div>
        </div>

        {/* 재고 목록 */}
        {inventoryData.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📦</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">재고 데이터가 없습니다</h3>
            <p className="text-slate-600">상품을 등록하면 재고 현황을 확인할 수 있습니다</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">상품 정보</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">현재 재고</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">단가</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">총 가치</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">상태</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {inventoryData.map(item => (
                    <tr key={item.optionId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12">
                            <img className="h-12 w-12 rounded-lg object-cover border border-slate-200" src={item.productImage} alt={item.productName} />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-slate-900">{item.productName}</div>
                            <div className="text-sm text-slate-500">{item.optionName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {item.sku}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-lg font-bold text-slate-900">{item.stock.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">개</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{formatCurrency(item.costOfGoods)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-purple-600">{formatCurrency(item.totalValue)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(item.status, item.stock)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;
