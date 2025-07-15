import * as React from 'react';
import { useState, useMemo } from 'react';
import { Product, SalesChannel, ProductOption } from '../types';
import { CNY_TO_KRW_RATE } from '../constants';

interface MarginCalculatorProps {
  products: Product[];
  onUpdateProductOption: (productId: string, optionId: string, updates: Partial<ProductOption>) => void;
}

interface CalculationData {
  baseCostCny: number;
  quantity: number;
  shippingCostKrw: number;
  customsFeeKrw: number;
  otherFeeKrw: number;
  channel: SalesChannel;
  channelFeePercentage: number;
  packagingCostKrw: number;
  domesticShippingKrw: number;
  targetMarginRate: number;
  targetProfitRate: number;
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

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedOption = selectedProduct?.options.find(o => o.id === selectedOptionId);

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedOptionId('');
    const product = products.find(p => p.id === productId);
    if (product) {
      setData(prev => ({ ...prev, baseCostCny: product.baseCostCny }));
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
    const confirmMessage = `${selectedProduct.name} - ${selectedOption.name}에 권장 판매가 ₩${recommendedPrice.toLocaleString()}를 저장하시겠습니까?`;

    if (window.confirm(confirmMessage)) {
      onUpdateProductOption(selectedProduct.id, selectedOption.id, {
        recommendedPrice: recommendedPrice
      });
      alert(`판매가가 저장되었습니다!`);
    }
  };

  const calculations = useMemo(() => {
    const baseCostKrw = data.baseCostCny * CNY_TO_KRW_RATE;
    const totalPurchaseCost = (baseCostKrw * data.quantity) + data.shippingCostKrw + data.customsFeeKrw + data.otherFeeKrw;
    const actualCostPerItem = totalPurchaseCost / data.quantity;
    const packagingCost = data.packagingCostKrw;
    const shippingCost = data.domesticShippingKrw;

    let recommendedPrice = 0;

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

    const grossRevenue = recommendedPrice;
    const channelFee = grossRevenue * (data.channelFeePercentage / 100);
    const netRevenue = grossRevenue - channelFee;
    const totalCosts = actualCostPerItem + packagingCost + shippingCost;
    const netProfit = netRevenue - totalCosts;

    const actualMarginRate = grossRevenue > 0 ? ((grossRevenue - totalCosts) / grossRevenue) * 100 : 0;
    const actualProfitRate = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;

    const totalInvestment = totalPurchaseCost;
    const breakEvenQuantity = netRevenue > 0 ? totalInvestment / netRevenue : 0;

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
      netProfit,
      actualMarginRate,
      actualProfitRate,
      totalInvestment,
      breakEvenQuantity,
      totalRevenue,
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
    <div className="h-screen bg-slate-50 p-4 overflow-hidden">
      <style>{`
        .slider-blue {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 2px;
        }
        .slider-blue::-webkit-slider-track {
          background: #e2e8f0;
          height: 8px;
          border-radius: 4px;
          border: 1px solid #cbd5e1;
        }
        .slider-blue::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(203, 213, 225, 0.5);
          transition: all 0.2s ease;
        }
        .slider-blue::-webkit-slider-thumb:hover {
          background: #2563eb;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(203, 213, 225, 0.8);
          transform: scale(1.1);
        }
        .slider-blue::-moz-range-track {
          background: #e2e8f0;
          height: 8px;
          border-radius: 4px;
          border: 1px solid #cbd5e1;
        }
        .slider-blue::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(203, 213, 225, 0.5);
        }
        .slider-blue:focus {
          outline: none;
          border-color: #3b82f6;
        }
      `}</style>
      <div className="h-full max-w-7xl mx-auto flex flex-col">

        {/* 헤더 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold">
                📊
              </div>
              <div>
                <h1 className="text-2xl font-bold text-blue-600">마진 계산기</h1>
                <p className="text-sm text-slate-500">수익성 분석 도구</p>
              </div>
            </div>
            {selectedProduct && selectedOption && calculations.recommendedPrice > 0 && (
              <button
                onClick={applyToProduct}
                className="px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
              >
                판매가 저장
              </button>
            )}
          </div>
        </div>

        {/* 메인 컨텐츠 - 3열 레이아웃 */}
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">

          {/* 왼쪽: 입력 섹션 */}
          <div className="col-span-4 space-y-4 overflow-y-auto">

            {/* 상품 선택 */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                <span className="w-6 h-6 bg-blue-500 rounded-lg text-white text-xs flex items-center justify-center mr-2">1</span>
                상품 선택
              </h3>
              <div className="space-y-3">
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-sm font-medium text-slate-900">{selectedProduct.name} - {selectedOption.name}</div>
                    <div className="text-xs text-slate-600 mt-1">원가: ₩{Math.round(selectedOption.costOfGoods).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>

            {/* 매입 정보 */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                <span className="w-6 h-6 bg-blue-500 rounded-lg text-white text-xs flex items-center justify-center mr-2">2</span>
                매입 정보
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">매입가 (¥)</label>
                  <input
                    type="number"
                    value={data.baseCostCny}
                    onChange={(e) => handleInputChange('baseCostCny', Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">수량</label>
                  <input
                    type="number"
                    value={data.quantity}
                    onChange={(e) => handleInputChange('quantity', Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">배송비</label>
                  <input
                    type="number"
                    value={data.shippingCostKrw}
                    onChange={(e) => handleInputChange('shippingCostKrw', Number(e.target.value))}
                    className="w-full px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">관세</label>
                  <input
                    type="number"
                    value={data.customsFeeKrw}
                    onChange={(e) => handleInputChange('customsFeeKrw', Number(e.target.value))}
                    className="w-full px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">기타</label>
                  <input
                    type="number"
                    value={data.otherFeeKrw}
                    onChange={(e) => handleInputChange('otherFeeKrw', Number(e.target.value))}
                    className="w-full px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 판매 설정 */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                <span className="w-6 h-6 bg-blue-500 rounded-lg text-white text-xs flex items-center justify-center mr-2">3</span>
                판매 설정
              </h3>
              <div className="space-y-3">
                <select
                  value={data.channel}
                  onChange={(e) => handleChannelChange(e.target.value as SalesChannel)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={SalesChannel.SMART_STORE}>스마트스토어</option>
                  <option value={SalesChannel.COUPANG}>쿠팡</option>
                  <option value={SalesChannel.OWN_MALL}>자사몰</option>
                  <option value={SalesChannel.OTHER}>기타</option>
                </select>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">수수료 (%)</label>
                    <input
                      type="number"
                      value={data.channelFeePercentage}
                      onChange={(e) => handleInputChange('channelFeePercentage', Number(e.target.value))}
                      className="w-full px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">포장비</label>
                    <input
                      type="number"
                      value={data.packagingCostKrw}
                      onChange={(e) => handleInputChange('packagingCostKrw', Number(e.target.value))}
                      className="w-full px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">배송비</label>
                    <input
                      type="number"
                      value={data.domesticShippingKrw}
                      onChange={(e) => handleInputChange('domesticShippingKrw', Number(e.target.value))}
                      className="w-full px-2 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 계산 모드 - 슬라이더 개선 */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                <span className="w-6 h-6 bg-blue-500 rounded-lg text-white text-xs flex items-center justify-center mr-2">4</span>
                계산 모드
              </h3>
              <div className="space-y-4">
                <label className="flex items-center p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer">
                  <input
                    type="radio"
                    name="calculationMode"
                    value="margin"
                    checked={data.calculationMode === 'margin'}
                    onChange={(e) => handleInputChange('calculationMode', e.target.value)}
                    className="mr-3 w-4 h-4 text-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">마진율 기준</span>
                </label>
                {data.calculationMode === 'margin' && (
                  <div className="px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-blue-700 font-medium">목표 마진율</span>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={data.targetMarginRate}
                          onChange={(e) => handleInputChange('targetMarginRate', Number(e.target.value))}
                          className="w-16 px-2 py-1 text-sm bg-white border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-center"
                          min="10"
                          max="80"
                          step="0.1"
                        />
                        <span className="text-sm font-bold text-blue-600">%</span>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="10"
                        max="80"
                        step="1"
                        value={data.targetMarginRate}
                        onChange={(e) => handleInputChange('targetMarginRate', Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider-blue border border-slate-300"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-blue-500 mt-2">
                      <span>10%</span>
                      <span>45%</span>
                      <span>80%</span>
                    </div>
                  </div>
                )}

                <label className="flex items-center p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer">
                  <input
                    type="radio"
                    name="calculationMode"
                    value="profit"
                    checked={data.calculationMode === 'profit'}
                    onChange={(e) => handleInputChange('calculationMode', e.target.value)}
                    className="mr-3 w-4 h-4 text-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">순이익률 기준</span>
                </label>
                {data.calculationMode === 'profit' && (
                  <div className="px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-blue-700 font-medium">목표 순이익률</span>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={data.targetProfitRate}
                          onChange={(e) => handleInputChange('targetProfitRate', Number(e.target.value))}
                          className="w-16 px-2 py-1 text-sm bg-white border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-center"
                          min="10"
                          max="100"
                          step="0.1"
                        />
                        <span className="text-sm font-bold text-blue-600">%</span>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="1"
                        value={data.targetProfitRate}
                        onChange={(e) => handleInputChange('targetProfitRate', Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider-blue border border-slate-300"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-blue-500 mt-2">
                      <span>10%</span>
                      <span>55%</span>
                      <span>100%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 중앙: 핵심 결과 */}
          <div className="col-span-4 space-y-4">

            {/* 권장 판매가 */}
            <div className="bg-blue-500 rounded-xl p-6 text-white">
              <div className="text-center">
                <div className="text-sm text-blue-100 mb-2">권장 판매가</div>
                <div className="text-4xl font-bold mb-4">{formatCurrency(calculations.recommendedPrice)}</div>
                {selectedProduct && selectedOption && calculations.recommendedPrice > 0 && (
                  <button
                    onClick={applyToProduct}
                    className="w-full px-4 py-3 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    상품에 저장
                  </button>
                )}
              </div>
            </div>

            {/* 핵심 지표 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-xs text-slate-500 mb-1">개당 순이익</div>
                <div className={`text-2xl font-bold ${calculations.netProfit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatCurrency(calculations.netProfit)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-xs text-slate-500 mb-1">마진율</div>
                <div className="text-2xl font-bold text-slate-900">{calculations.actualMarginRate.toFixed(1)}%</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-xs text-slate-500 mb-1">순이익률</div>
                <div className="text-2xl font-bold text-slate-900">{calculations.actualProfitRate.toFixed(1)}%</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-xs text-slate-500 mb-1">투자 회수량</div>
                <div className="text-2xl font-bold text-slate-900">
                  {calculations.breakEvenQuantity > 0 ? `${Math.ceil(calculations.breakEvenQuantity)}개` : '-'}
                </div>
              </div>
            </div>

            {/* 투자 회수 상태 */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">투자 회수 분석</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">총 투자금</div>
                  <div className="text-lg font-bold text-red-500">{formatCurrency(calculations.totalInvestment)}</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">회수 필요량</div>
                  <div className="text-lg font-bold text-slate-900">
                    {calculations.breakEvenQuantity > 0 ? `${Math.ceil(calculations.breakEvenQuantity)}개` : '불가'}
                  </div>
                </div>
              </div>

              {calculations.breakEvenQuantity > 0 && calculations.breakEvenQuantity <= data.quantity && (
                <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg text-center text-sm font-medium">
                  ✅ 회수 가능
                </div>
              )}
              {calculations.breakEvenQuantity > data.quantity && calculations.breakEvenQuantity > 0 && (
                <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-center text-sm font-medium">
                  ⚠️ {Math.ceil(calculations.breakEvenQuantity - data.quantity)}개 추가 필요
                </div>
              )}
              {calculations.breakEvenQuantity <= 0 && (
                <div className="bg-red-50 text-red-800 p-3 rounded-lg text-center text-sm font-medium">
                  ❌ 회수 불가
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 상세 분석 */}
          <div className="col-span-4 space-y-4">

            {/* 원가 분석 */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">원가 분석</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-600">기본 매입가</span>
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(calculations.baseCostKrw)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-600">실제 개당 원가</span>
                  <span className="text-sm font-bold text-amber-600">{formatCurrency(calculations.actualCostPerItem)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-600">판매 부대비용</span>
                  <span className="text-sm font-bold text-blue-600">{formatCurrency(data.packagingCostKrw + data.domesticShippingKrw)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-sm font-semibold text-slate-900">총 비용</span>
                  <span className="text-sm font-bold text-red-600">{formatCurrency(calculations.totalCostPerItem)}</span>
                </div>
              </div>
            </div>

            {/* 전체 판매 수익 */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">전체 판매 수익 ({data.quantity}개)</h4>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <div className="text-xs text-emerald-600 mb-1">총 매출</div>
                  <div className="text-lg font-bold text-emerald-700">{formatCurrency(calculations.totalRevenue)}</div>
                </div>
                <div className="text-center p-3 bg-violet-50 rounded-lg">
                  <div className="text-xs text-violet-600 mb-1">ROI</div>
                  <div className={`text-lg font-bold ${calculations.roi > 0 ? 'text-violet-700' : 'text-red-500'}`}>
                    {calculations.roi.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg text-center ${calculations.totalNetProfit > 0
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-red-50 text-red-800'}`}>
                <div className="text-xs mb-1">순 총 수익</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(calculations.totalNetProfit)}
                </div>
                <div className="text-xs mt-1">
                  {calculations.totalNetProfit > 0 ? '✅ 수익 예상' : '❌ 손실 예상'}
                </div>
              </div>
            </div>

            {/* 최소 판매가 */}
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <div className="text-center">
                <div className="text-xs text-amber-600 mb-1">최소 판매가 (손익분기점)</div>
                <div className="text-2xl font-bold text-amber-800">
                  {formatCurrency(calculations.totalCostPerItem / (1 - data.channelFeePercentage / 100))}
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