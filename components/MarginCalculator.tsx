import * as React from 'react';
import { useState, useMemo } from 'react';
import { Product, SalesChannel, ProductOption } from '../types';
import { CNY_TO_KRW_RATE } from '../constants';

interface MarginCalculatorProps {
  products: Product[];
  onUpdateProductOption: (productId: string, optionId: string, updates: Partial<ProductOption>) => void;
}

interface CalculationData {
  // 매입 관련
  baseCostCny: number;
  quantity: number;
  shippingCostKrw: number;
  customsFeeKrw: number;
  otherFeeKrw: number;
  
  // 판매 관련
  channel: SalesChannel;
  channelFeePercentage: number;
  packagingCostKrw: number;
  domesticShippingKrw: number;
  
  // 목표 설정
  targetMarginRate: number;
  targetProfitRate: number;
  
  // 계산 모드
  calculationMode: 'margin' | 'profit' | 'price';
  customSalePrice: number;
}

const MarginCalculator: React.FC<MarginCalculatorProps> = ({ products, onUpdateProductOption }) => {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [data, setData] = useState<CalculationData>({
    baseCostCny: 0,
    quantity: 1,
    shippingCostKrw: 0,
    customsFeeKrw: 0,
    otherFeeKrw: 0,
    channel: SalesChannel.SMART_STORE,
    channelFeePercentage: 5.5,
    packagingCostKrw: 500,
    domesticShippingKrw: 3000,
    targetMarginRate: 50,
    targetProfitRate: 30,
    calculationMode: 'margin',
    customSalePrice: 0
  });

  // 선택된 상품 정보
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedOption = selectedProduct?.options.find(o => o.id === selectedOptionId);

  // 상품 선택 시 자동으로 원가 정보 업데이트
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedOptionId('');
    const product = products.find(p => p.id === productId);
    if (product) {
      setData(prev => ({ ...prev, baseCostCny: product.baseCostCny }));
    } else {
      setData(prev => ({ ...prev, baseCostCny: prev.baseCostCny }));
    }
  };

  const handleOptionSelect = (optionId: string) => {
    setSelectedOptionId(optionId);
    const option = selectedProduct?.options.find(o => o.id === optionId);
    if (option) {
      const estimatedBaseCost = option.costOfGoods / CNY_TO_KRW_RATE;
      setData(prev => ({ ...prev, baseCostCny: estimatedBaseCost }));
    }
  };

  // 상품 판매가 적용 기능
  const applyToProduct = () => {
    if (!selectedProduct || !selectedOption) {
      alert('상품과 옵션을 먼저 선택해주세요.');
      return;
    }

    if (calculations.recommendedPrice <= 0) {
      alert('유효한 판매가가 계산되지 않았습니다.');
      return;
    }

    const recommendedPrice = Math.round(calculations.recommendedPrice);
    const confirmMessage = `${selectedProduct.name} - ${selectedOption.name}에 권장 판매가 ₩${recommendedPrice.toLocaleString()}를 저장하시겠습니까?\n\n이 정보는 상품 관리에서 확인할 수 있습니다.`;
    
    if (window.confirm(confirmMessage)) {
      onUpdateProductOption(selectedProduct.id, selectedOption.id, {
        recommendedPrice: recommendedPrice
      });
      
      alert(`✅ 판매가가 저장되었습니다!\n\n상품: ${selectedProduct.name}\n옵션: ${selectedOption.name}\n권장 판매가: ₩${recommendedPrice.toLocaleString()}\n\n💡 상품 관리 페이지에서 확인하실 수 있습니다.`);
    }
  };

  const calculations = useMemo(() => {
    // 1. 개당 실제 원가 계산
    const baseCostKrw = data.baseCostCny * CNY_TO_KRW_RATE;
    const totalPurchaseCost = (baseCostKrw * data.quantity) + data.shippingCostKrw + data.customsFeeKrw + data.otherFeeKrw;
    const actualCostPerItem = totalPurchaseCost / data.quantity;
    
    // 2. 판매 시 추가 비용 (개당)
    const packagingCost = data.packagingCostKrw;
    const shippingCost = data.domesticShippingKrw;
    
    // 3. 계산 모드별 결과
    let recommendedPrice = 0;
    let actualMarginRate = 0;
    let actualProfitRate = 0;
    let netProfit = 0;
    
    if (data.calculationMode === 'margin') {
      const totalCostPerItem = actualCostPerItem + packagingCost + shippingCost;
      recommendedPrice = totalCostPerItem / (1 - data.targetMarginRate / 100);
      recommendedPrice = recommendedPrice / (1 - data.channelFeePercentage / 100);
    } else if (data.calculationMode === 'profit') {
      const totalCostPerItem = actualCostPerItem + packagingCost + shippingCost;
      recommendedPrice = totalCostPerItem * (1 + data.targetProfitRate / 100);
      recommendedPrice = recommendedPrice / (1 - data.channelFeePercentage / 100);
    } else {
      recommendedPrice = data.customSalePrice;
    }
    
    // 4. 실제 수익성 계산
    const grossRevenue = recommendedPrice;
    const channelFee = grossRevenue * (data.channelFeePercentage / 100);
    const netRevenue = grossRevenue - channelFee;
    const totalCosts = actualCostPerItem + packagingCost + shippingCost;
    netProfit = netRevenue - totalCosts;
    
    actualMarginRate = grossRevenue > 0 ? ((grossRevenue - totalCosts) / grossRevenue) * 100 : 0;
    actualProfitRate = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;
    
    // 5. 투자 회수 분석
    const totalInvestment = totalPurchaseCost;
    const breakEvenQuantity = netRevenue > 0 ? totalInvestment / netRevenue : 0;
    
    // 6. 전체 수량 판매 시 수익 분석
    const totalRevenue = recommendedPrice * data.quantity;
    const totalChannelFee = totalRevenue * (data.channelFeePercentage / 100);
    const totalSellingCosts = (packagingCost + shippingCost) * data.quantity;
    const totalNetProfit = totalRevenue - totalChannelFee - totalPurchaseCost - totalSellingCosts;
    const roi = totalInvestment > 0 ? (totalNetProfit / totalInvestment) * 100 : 0;
    
    return {
      baseCostKrw,
      actualCostPerItem,
      totalCostPerItem: actualCostPerItem + packagingCost + shippingCost,
      recommendedPrice,
      grossRevenue,
      channelFee,
      netRevenue,
      netProfit,
      actualMarginRate,
      actualProfitRate,
      totalCosts,
      totalInvestment,
      breakEvenQuantity,
      totalRevenue,
      totalChannelFee,
      totalSellingCosts,
      totalNetProfit,
      roi
    };
  }, [data]);

  const handleInputChange = (field: keyof CalculationData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleChannelChange = (channel: SalesChannel) => {
    let feePercentage = 5.5;
    switch (channel) {
      case SalesChannel.SMART_STORE:
        feePercentage = 5.5;
        break;
      case SalesChannel.COUPANG:
        feePercentage = 10.8;
        break;
      case SalesChannel.OWN_MALL:
        feePercentage = 2.0;
        break;
      default:
        feePercentage = 5.0;
    }
    
    setData(prev => ({ 
      ...prev, 
      channel, 
      channelFeePercentage: feePercentage 
    }));
  };

  const formatCurrency = (value: number) => `₩${Math.round(value).toLocaleString()}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 모던한 헤더 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                🧮
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  마진 계산기
                </h1>
                <p className="text-gray-600 mt-1">매입부터 판매까지 정확한 수익성 분석</p>
              </div>
            </div>
            {selectedProduct && selectedOption && calculations.recommendedPrice > 0 && (
              <button
                onClick={applyToProduct}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                상품에 판매가 저장
              </button>
            )}
          </div>
        </div>

        {/* 핵심 결과 요약 - 모던한 대시보드 스타일 */}
        {(data.baseCostCny > 0 || data.customSalePrice > 0) && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-blue-100 text-sm font-medium">권장 판매가</div>
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">💰</div>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(calculations.recommendedPrice)}</div>
              </div>
              
              <div className={`rounded-xl p-4 text-white shadow-lg ${calculations.netProfit > 0 
                ? 'bg-gradient-to-br from-green-500 to-green-600' 
                : 'bg-gradient-to-br from-red-500 to-red-600'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white/90 text-sm font-medium">개당 순이익</div>
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    {calculations.netProfit > 0 ? '📈' : '📉'}
                  </div>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(calculations.netProfit)}</div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-purple-100 text-sm font-medium">마진율</div>
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">📊</div>
                </div>
                <div className="text-2xl font-bold">{calculations.actualMarginRate.toFixed(1)}%</div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-orange-100 text-sm font-medium">투자 회수량</div>
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">🎯</div>
                </div>
                <div className="text-2xl font-bold">
                  {calculations.breakEvenQuantity > 0 ? `${Math.ceil(calculations.breakEvenQuantity)}개` : '-'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 심플한 2x2 그리드 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
          {/* 1. 상품 선택 & 비용 설정 통합 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm">🎯</div>
              <h3 className="text-lg font-semibold text-gray-800">상품 선택 & 비용 설정</h3>
            </div>
            
            {/* 상품 선택 */}
            <div className="space-y-3 mb-6">
              <select
                value={selectedProductId}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-white/70 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">직접 입력 모드</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
              
              {selectedProductId && (
                <select
                  value={selectedOptionId}
                  onChange={(e) => handleOptionSelect(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-white/70 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">옵션 선택</option>
                  {selectedProduct?.options.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name} (재고: {option.stock}개)
                    </option>
                  ))}
                </select>
              )}
              
              {selectedProduct && selectedOption && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <div className="font-medium text-blue-800">{selectedProduct.name} - {selectedOption.name}</div>
                  <div className="text-sm text-blue-600 mt-1">원가: ₩{Math.round(selectedOption.costOfGoods).toLocaleString()}</div>
                </div>
              )}
            </div>

            {/* 매입 비용 */}
            <div className="border-t pt-6">
              <h4 className="text-md font-medium text-gray-700 mb-4 flex items-center">
                <span className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center text-white text-xs mr-2">📦</span>
                매입 비용
              </h4>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">매입가 (¥)</label>
                  <input
                    type="number"
                    value={data.baseCostCny}
                    onChange={(e) => handleInputChange('baseCostCny', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">수량</label>
                  <input
                    type="number"
                    value={data.quantity}
                    onChange={(e) => handleInputChange('quantity', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    min="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">배송비</label>
                  <input
                    type="number"
                    value={data.shippingCostKrw}
                    onChange={(e) => handleInputChange('shippingCostKrw', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">관세</label>
                  <input
                    type="number"
                    value={data.customsFeeKrw}
                    onChange={(e) => handleInputChange('customsFeeKrw', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">기타</label>
                  <input
                    type="number"
                    value={data.otherFeeKrw}
                    onChange={(e) => handleInputChange('otherFeeKrw', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. 판매 설정 & 가격 계산 통합 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white text-sm">🛒</div>
              <h3 className="text-lg font-semibold text-gray-800">판매 설정 & 가격 계산</h3>
            </div>
            
            {/* 판매 정보 */}
            <div className="space-y-4 mb-6">
              <select
                value={data.channel}
                onChange={(e) => handleChannelChange(e.target.value as SalesChannel)}
                className="w-full px-4 py-3 text-sm bg-white/70 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              >
                <option value={SalesChannel.SMART_STORE}>스마트스토어</option>
                <option value={SalesChannel.COUPANG}>쿠팡</option>
                <option value={SalesChannel.OWN_MALL}>자사몰</option>
                <option value={SalesChannel.OTHER}>기타</option>
              </select>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">수수료 (%)</label>
                  <input
                    type="number"
                    value={data.channelFeePercentage}
                    onChange={(e) => handleInputChange('channelFeePercentage', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">포장비</label>
                  <input
                    type="number"
                    value={data.packagingCostKrw}
                    onChange={(e) => handleInputChange('packagingCostKrw', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">배송비</label>
                  <input
                    type="number"
                    value={data.domesticShippingKrw}
                    onChange={(e) => handleInputChange('domesticShippingKrw', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 계산 모드 */}
            <div className="border-t pt-6">
              <h4 className="text-md font-medium text-gray-700 mb-4 flex items-center">
                <span className="w-6 h-6 bg-purple-500 rounded-lg flex items-center justify-center text-white text-xs mr-2">🎯</span>
                계산 모드
              </h4>
              <div className="space-y-3">
                <label className="flex items-center p-3 bg-white/50 rounded-xl border border-gray-200 hover:bg-white/70 transition-all cursor-pointer">
                  <input
                    type="radio"
                    name="calculationMode"
                    value="margin"
                    checked={data.calculationMode === 'margin'}
                    onChange={(e) => handleInputChange('calculationMode', e.target.value)}
                    className="mr-3 w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm font-medium text-gray-700">마진율 기준</span>
                </label>
                {data.calculationMode === 'margin' && (
                  <input
                    type="number"
                    value={data.targetMarginRate}
                    onChange={(e) => handleInputChange('targetMarginRate', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="목표 마진율 (%)"
                    step="0.1"
                  />
                )}
                
                <label className="flex items-center p-3 bg-white/50 rounded-xl border border-gray-200 hover:bg-white/70 transition-all cursor-pointer">
                  <input
                    type="radio"
                    name="calculationMode"
                    value="profit"
                    checked={data.calculationMode === 'profit'}
                    onChange={(e) => handleInputChange('calculationMode', e.target.value)}
                    className="mr-3 w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm font-medium text-gray-700">순이익률 기준</span>
                </label>
                {data.calculationMode === 'profit' && (
                  <input
                    type="number"
                    value={data.targetProfitRate}
                    onChange={(e) => handleInputChange('targetProfitRate', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="목표 순이익률 (%)"
                    step="0.1"
                  />
                )}
                
                <label className="flex items-center p-3 bg-white/50 rounded-xl border border-gray-200 hover:bg-white/70 transition-all cursor-pointer">
                  <input
                    type="radio"
                    name="calculationMode"
                    value="price"
                    checked={data.calculationMode === 'price'}
                    onChange={(e) => handleInputChange('calculationMode', e.target.value)}
                    className="mr-3 w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm font-medium text-gray-700">직접 입력</span>
                </label>
                {data.calculationMode === 'price' && (
                  <input
                    type="number"
                    value={data.customSalePrice}
                    onChange={(e) => handleInputChange('customSalePrice', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="판매가 (₩)"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 3. 수익성 분석 & 투자 회수 통합 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white text-sm">📈</div>
              <h3 className="text-lg font-semibold text-gray-800">수익성 분석 & 투자 회수</h3>
            </div>
            
            {/* 수익성 지표 */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-xl text-center border border-blue-200">
                  <div className="text-xs text-blue-600 font-medium mb-1">마진율</div>
                  <div className="text-lg font-bold text-blue-800">{calculations.actualMarginRate.toFixed(1)}%</div>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-emerald-100 p-3 rounded-xl text-center border border-green-200">
                  <div className="text-xs text-green-600 font-medium mb-1">순이익률</div>
                  <div className="text-lg font-bold text-green-800">{calculations.actualProfitRate.toFixed(1)}%</div>
                </div>
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-3 rounded-xl text-center border border-gray-200">
                  <div className="text-xs text-gray-600 font-medium mb-1">개당 순이익</div>
                  <div className={`text-lg font-bold ${calculations.netProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(calculations.netProfit)}
                  </div>
                </div>
              </div>
            </div>

            {/* 투자 회수 */}
            <div className="border-t pt-6">
              <h4 className="text-md font-medium text-gray-700 mb-4 flex items-center">
                <span className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center text-white text-xs mr-2">💸</span>
                투자 회수 분석
              </h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-xl text-center border border-red-200">
                  <div className="text-sm text-red-600 font-medium mb-1">총 투자금</div>
                  <div className="text-xl font-bold text-red-800">{formatCurrency(calculations.totalInvestment)}</div>
                </div>
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl text-center border border-blue-200">
                  <div className="text-sm text-blue-600 font-medium mb-1">회수 필요량</div>
                  <div className="text-xl font-bold text-blue-800">
                    {calculations.breakEvenQuantity > 0 ? `${Math.ceil(calculations.breakEvenQuantity)}개` : '불가'}
                  </div>
                </div>
              </div>
              
              {calculations.breakEvenQuantity > 0 && calculations.breakEvenQuantity <= data.quantity && (
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-xl text-center font-medium">
                  ✅ 회수 가능
                </div>
              )}
              {calculations.breakEvenQuantity > data.quantity && calculations.breakEvenQuantity > 0 && (
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white p-3 rounded-xl text-center font-medium">
                  ⚠️ {Math.ceil(calculations.breakEvenQuantity - data.quantity)}개 추가 필요
                </div>
              )}
              {calculations.breakEvenQuantity <= 0 && (
                <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-3 rounded-xl text-center font-medium">
                  ❌ 회수 불가
                </div>
              )}
            </div>
          </div>

          {/* 4. 상세 분석 & 전체 수익 통합 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-white text-sm">💰</div>
              <h3 className="text-lg font-semibold text-gray-800">상세 분석 & 전체 수익</h3>
            </div>
            
            {/* 원가 분석 */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">기본 매입가</span>
                <span className="font-bold text-gray-800">{formatCurrency(calculations.baseCostKrw)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-gray-600 font-medium">실제 개당 원가</span>
                <span className="font-bold text-orange-600">{formatCurrency(calculations.actualCostPerItem)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-gray-600 font-medium">판매 부대비용</span>
                <span className="font-bold text-blue-600">{formatCurrency(data.packagingCostKrw + data.domesticShippingKrw)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border-2 border-red-200">
                <span className="text-gray-800 font-semibold">총 비용</span>
                <span className="font-bold text-red-600 text-lg">{formatCurrency(calculations.totalCostPerItem)}</span>
              </div>
            </div>

            {/* 전체 판매 수익 */}
            <div className="border-t pt-6">
              <h4 className="text-md font-medium text-gray-700 mb-4 flex items-center">
                <span className="w-6 h-6 bg-teal-500 rounded-lg flex items-center justify-center text-white text-xs mr-2">🎯</span>
                전체 판매 수익 ({data.quantity}개)
              </h4>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-r from-green-50 to-emerald-100 p-3 rounded-xl text-center border border-green-200">
                  <div className="text-sm text-green-600 font-medium mb-1">총 매출</div>
                  <div className="text-lg font-bold text-green-800">{formatCurrency(calculations.totalRevenue)}</div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-3 rounded-xl text-center border border-purple-200">
                  <div className="text-sm text-purple-600 font-medium mb-1">ROI</div>
                  <div className={`text-lg font-bold ${calculations.roi > 0 ? 'text-purple-800' : 'text-red-600'}`}>
                    {calculations.roi.toFixed(1)}%
                  </div>
                </div>
              </div>
              
              <div className={`p-4 rounded-xl text-center ${calculations.totalNetProfit > 0 
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                : 'bg-gradient-to-r from-red-500 to-red-600 text-white'}`}>
                <div className="text-white/90 font-medium mb-1">순 총 수익</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(calculations.totalNetProfit)}
                </div>
                <div className="text-white/80 text-sm mt-1">
                  {calculations.totalNetProfit > 0 ? '✅ 수익 예상' : '❌ 손실 예상'}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MarginCalculator;