import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Sale, Product, AppSettings } from '../types';
import Modal from './ui/Modal';
import SaleForm from './forms/SaleForm';
import { PlusIcon, InfoIcon } from './icons/Icons';
import SaleDetailModal from './modals/SaleDetailModal';

interface SalesProps {
  sales: Sale[];
  products: Product[];
  settings: AppSettings;
  onAddSale: (sale: Omit<Sale, 'id'>) => void;
}

const Sales: React.FC<SalesProps> = ({ sales, products, settings, onAddSale }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'profit' | 'revenue'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [channelFilter, setChannelFilter] = useState<string>('all');

  const getSaleDetails = (sale: Sale) => {
    const product = products.find(p => p.id === sale.productId);
    const option = product?.options.find(o => o.id === sale.optionId);

    if (!product || !option) {
      return {
        productName: '삭제된 상품',
        optionName: '삭제된 옵션',
        profit: 0,
        marginRate: 0,
        costs: { totalCost: 0, channelFee: 0, packagingCost: 0, shippingCost: 0 }
      };
    }

    const totalRevenue = sale.quantity * sale.salePricePerItem;
    const totalCost = sale.quantity * option.costOfGoods;
    const channelFee = totalRevenue * (sale.channelFeePercentage / 100);
    const totalPackagingCost = sale.packagingCostKrw * sale.quantity;
    const totalShippingCost = sale.shippingCostKrw * sale.quantity;
    const otherCosts = totalPackagingCost + totalShippingCost;
    const profit = totalRevenue - totalCost - channelFee - otherCosts;
    const marginRate = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      productName: product.name,
      optionName: option.name,
      profit,
      marginRate,
      totalRevenue,
      costs: {
        totalCost,
        channelFee,
        packagingCost: totalPackagingCost,
        shippingCost: totalShippingCost,
      }
    };
  };

  const handleAddSale = (saleData: Omit<Sale, 'id'>) => {
    onAddSale(saleData);
    setIsModalOpen(false);
  };

  const handleOpenDetailModal = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedSale(null);
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
        setIsDetailModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 필터링 및 정렬된 매출 목록
  const filteredAndSortedSales = useMemo(() => {
    let filtered = sales.filter(sale => {
      // 검색어 필터
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const { productName, optionName } = getSaleDetails(sale);
        const hasMatch = productName.toLowerCase().includes(searchLower) ||
                        optionName.toLowerCase().includes(searchLower) ||
                        sale.id.toLowerCase().includes(searchLower) ||
                        sale.channel.toLowerCase().includes(searchLower);
        if (!hasMatch) return false;
      }

      // 채널 필터
      if (channelFilter !== 'all' && sale.channel !== channelFilter) {
        return false;
      }

      return true;
    });

    // 정렬
    filtered.sort((a, b) => {
      let comparison = 0;
      const aDetails = getSaleDetails(a);
      const bDetails = getSaleDetails(b);

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'profit':
          comparison = aDetails.profit - bDetails.profit;
          break;
        case 'revenue':
          comparison = (a.quantity * a.salePricePerItem) - (b.quantity * b.salePricePerItem);
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [sales, searchTerm, channelFilter, sortBy, sortOrder, products]);

  // 통계 계산
  const statistics = useMemo(() => {
    const totalSales = filteredAndSortedSales.length;
    const totalRevenue = filteredAndSortedSales.reduce((sum, sale) => sum + (sale.quantity * sale.salePricePerItem), 0);
    const totalProfit = filteredAndSortedSales.reduce((sum, sale) => {
      const { profit } = getSaleDetails(sale);
      return sum + profit;
    }, 0);
    const totalQuantity = filteredAndSortedSales.reduce((sum, sale) => sum + sale.quantity, 0);
    const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return { totalSales, totalRevenue, totalProfit, totalQuantity, avgProfitMargin };
  }, [filteredAndSortedSales]);

  // 채널별 통계
  const channelStats = useMemo(() => {
    const channels = [...new Set(sales.map(sale => sale.channel))];
    return channels.map(channel => {
      const channelSales = sales.filter(sale => sale.channel === channel);
      const revenue = channelSales.reduce((sum, sale) => sum + (sale.quantity * sale.salePricePerItem), 0);
      return { channel, count: channelSales.length, revenue };
    });
  }, [sales]);

  const formatCurrency = (value: number) => `₩${Math.round(value).toLocaleString()}`;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 모던한 헤더 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                💰
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">매출 관리</h1>
                <p className="text-slate-600 mt-1">매출 현황과 수익성 분석</p>
              </div>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              새 매출
            </button>
          </div>
        </div>

        {/* 통계 대시보드 */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">총 매출 건수</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{statistics.totalSales}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-lg">📊</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">총 매출액</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(statistics.totalRevenue)}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 text-lg">💰</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">총 순이익</p>
                <p className={`text-2xl font-bold mt-1 ${statistics.totalProfit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatCurrency(statistics.totalProfit)}
                </p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <span className="text-emerald-600 text-lg">📈</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">판매 수량</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{statistics.totalQuantity}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 text-lg">📦</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">평균 마진율</p>
                <p className={`text-2xl font-bold mt-1 ${statistics.avgProfitMargin > 0 ? 'text-orange-600' : 'text-red-500'}`}>
                  {statistics.avgProfitMargin.toFixed(1)}%
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 text-lg">📊</span>
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
                placeholder="상품명, 옵션명, 채널명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">모든 채널</option>
                {channelStats.map(stat => (
                  <option key={stat.channel} value={stat.channel}>
                    {stat.channel} ({stat.count})
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'profit' | 'revenue')}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="date">날짜순</option>
                <option value="profit">수익순</option>
                <option value="revenue">매출순</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="desc">내림차순</option>
                <option value="asc">오름차순</option>
              </select>
            </div>
          </div>
        </div>

        {/* 매출 목록 */}
        {filteredAndSortedSales.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💰</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">매출 내역이 없습니다</h3>
            <p className="text-slate-600 mb-6">첫 번째 매출을 등록해보세요</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              매출 등록하기
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">판매일</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">상품 정보</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">매출액</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">채널/수수료</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">순이익/마진율</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">상세</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredAndSortedSales.map(sale => {
                    const { productName, optionName, profit, marginRate, totalRevenue } = getSaleDetails(sale);

                    return (
                      <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {new Date(sale.date).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">{productName}</div>
                          <div className="text-sm text-slate-500">{optionName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-900">{formatCurrency(totalRevenue)}</div>
                          <div className="text-sm text-slate-500">({sale.quantity}개 × {formatCurrency(sale.salePricePerItem)})</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">{sale.channel}</div>
                          <div className="text-sm text-slate-500">{sale.channelFeePercentage}%</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className={`font-semibold ${profit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {formatCurrency(profit)}
                          </div>
                          <div className={`text-sm ${marginRate > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {marginRate.toFixed(1)}%
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleOpenDetailModal(sale)}
                            className="text-blue-600 hover:text-blue-900 transition-colors p-1 rounded-full hover:bg-blue-50"
                            title="상세 내역 보기"
                          >
                            <InfoIcon />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="새 매출 등록">
          <SaleForm
            products={products}
            settings={settings}
            onAddSale={handleAddSale}
            onCancel={() => setIsModalOpen(false)}
          />
        </Modal>
        
        <SaleDetailModal
          isOpen={isDetailModalOpen}
          onClose={handleCloseDetailModal}
          sale={selectedSale}
          products={products}
        />
      </div>
    </div>
  );
};

export default Sales;