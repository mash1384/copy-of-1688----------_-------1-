import * as React from 'react';
import { useMemo } from 'react';
import { Product, Sale, Purchase } from '../types';
import Card from './ui/Card';
import { CNY_TO_KRW_RATE } from '../constants';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const Dashboard: React.FC<DashboardProps> = ({ products, sales, purchases }) => {
  const {
    totalRevenue,
    totalProfit,
    totalSalesCount,
    totalPurchaseCost,
    totalPurchaseCount,
    totalInventoryValue,
    monthlyData,
    channelData,
    topProducts,
    purchaseData,
    recentActivity
  } = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalPurchaseCost = 0;
    const salesByDate: { [date: string]: { revenue: number, profit: number } } = {};
    const purchasesByDate: { [date: string]: { cost: number, quantity: number } } = {};
    const salesByChannel: { [key: string]: number } = {};
    const salesByProduct: { [key: string]: { quantity: number, revenue: number } } = {};

    // 매출 데이터 처리
    sales.forEach(sale => {
      const product = products.find(p => p.id === sale.productId);
      const option = product?.options.find(o => o.id === sale.optionId);
      if (!product || !option) return;

      const saleRevenue = sale.quantity * sale.salePricePerItem;
      const saleCost = sale.quantity * option.costOfGoods;
      const channelFee = saleRevenue * (sale.channelFeePercentage / 100);
      const otherCosts = (sale.packagingCostKrw * sale.quantity) + (sale.shippingCostKrw * sale.quantity);
      const saleProfit = saleRevenue - saleCost - channelFee - otherCosts;

      totalRevenue += saleRevenue;
      totalProfit += saleProfit;

      const date = sale.date.substring(0, 7); // Group by month
      if (!salesByDate[date]) {
        salesByDate[date] = { revenue: 0, profit: 0 };
      }
      salesByDate[date].revenue += saleRevenue;
      salesByDate[date].profit += saleProfit;

      if (!salesByChannel[sale.channel]) {
        salesByChannel[sale.channel] = 0;
      }
      salesByChannel[sale.channel] += saleRevenue;

      if (!salesByProduct[product.id]) {
        salesByProduct[product.id] = { quantity: 0, revenue: 0 };
      }
      salesByProduct[product.id].quantity += sale.quantity;
      salesByProduct[product.id].revenue += saleRevenue;
    });

    // 매입 데이터 처리
    purchases.forEach(purchase => {
      const itemsTotalCny = purchase.items.reduce((sum, item) => sum + item.costCnyPerItem * item.quantity, 0);
      const itemsTotalKrw = itemsTotalCny * CNY_TO_KRW_RATE;
      const additionalCosts = purchase.shippingCostKrw + purchase.customsFeeKrw + purchase.otherFeeKrw;
      const purchaseCost = itemsTotalKrw + additionalCosts;

      totalPurchaseCost += purchaseCost;

      const date = purchase.date.substring(0, 7); // Group by month
      if (!purchasesByDate[date]) {
        purchasesByDate[date] = { cost: 0, quantity: 0 };
      }
      purchasesByDate[date].cost += purchaseCost;
      purchasesByDate[date].quantity += purchase.items.reduce((sum, item) => sum + item.quantity, 0);
    });

    // 재고 가치 계산
    const totalInventoryValue = products.reduce((total, product) => {
      return total + product.options.reduce((optionTotal, option) => {
        return optionTotal + (option.stock * option.costOfGoods);
      }, 0);
    }, 0);

    // 월별 데이터 통합
    const allDates = new Set([...Object.keys(salesByDate), ...Object.keys(purchasesByDate)]);
    const monthlyData = Array.from(allDates)
      .map(date => ({
        date,
        매출: salesByDate[date]?.revenue || 0,
        순이익: salesByDate[date]?.profit || 0,
        매입비용: purchasesByDate[date]?.cost || 0,
        매입수량: purchasesByDate[date]?.quantity || 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const channelData = Object.entries(salesByChannel)
      .map(([name, value]) => ({ name, value }));

    const topProducts = Object.entries(salesByProduct)
      .map(([productId, data]) => {
        const product = products.find(p => p.id === productId);
        return { name: product?.name || '알 수 없음', ...data };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // 매입 통계
    const purchaseData = purchases.map(purchase => {
      const itemsTotalCny = purchase.items.reduce((sum, item) => sum + item.costCnyPerItem * item.quantity, 0);
      const itemsTotalKrw = itemsTotalCny * CNY_TO_KRW_RATE;
      const additionalCosts = purchase.shippingCostKrw + purchase.customsFeeKrw + purchase.otherFeeKrw;
      const totalCost = itemsTotalKrw + additionalCosts;
      const totalQuantity = purchase.items.reduce((sum, item) => sum + item.quantity, 0);

      return {
        date: purchase.date,
        cost: totalCost,
        quantity: totalQuantity,
        items: purchase.items.length
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 최근 활동
    const recentSales = sales.slice(-5).map(sale => ({
      type: '매출',
      date: sale.date,
      description: `${products.find(p => p.id === sale.productId)?.name || '알 수 없음'} ${sale.quantity}개 판매`,
      amount: sale.quantity * sale.salePricePerItem
    }));

    const recentPurchases = purchases.slice(-5).map(purchase => {
      const totalCost = purchase.items.reduce((sum, item) => sum + item.costCnyPerItem * item.quantity, 0) * CNY_TO_KRW_RATE +
        purchase.shippingCostKrw + purchase.customsFeeKrw + purchase.otherFeeKrw;
      return {
        type: '매입',
        date: purchase.date,
        description: `${purchase.items.length}개 상품 매입`,
        amount: totalCost
      };
    });

    const recentActivity = [...recentSales, ...recentPurchases]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);

    return {
      totalRevenue,
      totalProfit,
      totalSalesCount: sales.length,
      totalPurchaseCost,
      totalPurchaseCount: purchases.length,
      totalInventoryValue,
      monthlyData,
      channelData,
      topProducts,
      purchaseData,
      recentActivity
    };
  }, [products, sales, purchases]);

  const formatCurrency = (value: number) => `₩${Math.round(value).toLocaleString()}`;
  const formatNumber = (value: number) => `${value.toLocaleString()}`;

  return (
    <div>
      {/* 벤토 그리드 레이아웃 */}
      <div className="grid grid-cols-12 gap-3 auto-rows-min">
        
        {/* KPI 카드들 - 상단 6개 (2행) */}
        <Card className="col-span-2 p-2">
          <h3 className="text-gray-500 font-medium text-xs">총 매출</h3>
          <p className="text-lg font-bold text-gray-800 mt-1">{formatCurrency(totalRevenue)}</p>
        </Card>

        <Card className="col-span-2 p-2">
          <h3 className="text-gray-500 font-medium text-xs">총 매입 비용</h3>
          <p className="text-lg font-bold text-orange-600 mt-1">{formatCurrency(totalPurchaseCost)}</p>
        </Card>

        <Card className="col-span-2 p-2">
          <h3 className="text-gray-500 font-medium text-xs">총 순이익</h3>
          <p className={`text-lg font-bold mt-1 ${totalProfit < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(totalProfit)}
          </p>
        </Card>

        <Card className="col-span-2 p-2">
          <h3 className="text-gray-500 font-medium text-xs">마진율</h3>
          <p className="text-lg font-bold text-blue-600 mt-1">{totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%</p>
        </Card>

        <Card className="col-span-2 p-2">
          <h3 className="text-gray-500 font-medium text-xs">재고 가치</h3>
          <p className="text-lg font-bold text-purple-600 mt-1">{formatCurrency(totalInventoryValue)}</p>
        </Card>

        <Card className="col-span-2 p-2">
          <h3 className="text-gray-500 font-medium text-xs">매입 건수</h3>
          <p className="text-lg font-bold text-gray-800 mt-1">{formatNumber(totalPurchaseCount)}</p>
        </Card>

        {/* 재무 현황 시각화 - 간단한 바 차트 */}
        <Card className="col-span-7 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">재무 현황</h3>
          </div>
          
          <div className="space-y-4">
            {/* 간단한 바 차트 */}
            <div className="space-y-4">
              {(() => {
                const maxValue = Math.max(totalRevenue, totalPurchaseCost, Math.abs(totalProfit));
                const revenuePercent = maxValue > 0 ? (totalRevenue / maxValue) * 100 : 0;
                const costPercent = maxValue > 0 ? (totalPurchaseCost / maxValue) * 100 : 0;
                const profitPercent = maxValue > 0 ? (Math.abs(totalProfit) / maxValue) * 100 : 0;
                const isProfitPositive = totalProfit >= 0;
                
                return (
                  <>
                    {/* 총 매출 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">총 매출</span>
                        <span className="text-lg font-bold text-emerald-600">{formatCurrency(totalRevenue)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-lg h-3">
                        <div 
                          className="h-full bg-emerald-500 rounded-lg"
                          style={{ width: `${revenuePercent}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* 총 매입비용 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">총 매입비용</span>
                        <span className="text-lg font-bold text-orange-600">{formatCurrency(totalPurchaseCost)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-lg h-3">
                        <div 
                          className="h-full bg-orange-500 rounded-lg"
                          style={{ width: `${costPercent}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* 총 순이익 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">총 순이익</span>
                        <span className={`text-lg font-bold ${isProfitPositive ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatCurrency(totalProfit)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-lg h-3">
                        <div 
                          className={`h-full rounded-lg ${isProfitPositive ? 'bg-blue-500' : 'bg-red-500'}`}
                          style={{ width: `${profitPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            
            {/* 간단한 통계 */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200">
              <div className="text-center p-3 bg-emerald-50 rounded-lg">
                <div className="text-xs text-emerald-600 font-medium mb-1">순이익률</div>
                <div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
                </div>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-blue-600 font-medium mb-1">매입 비율</div>
                <div className="text-lg font-bold text-blue-700">
                  {totalRevenue > 0 ? ((totalPurchaseCost / totalRevenue) * 100).toFixed(1) : 0}%
                </div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600 font-medium mb-1">수익성</div>
                <div className={`text-sm font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {totalProfit >= 0 ? '수익' : '손실'}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 최근 활동 - 세로 긴 카드 */}
        <Card className="col-span-5 p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">최근 활동</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <p>최근 활동이 없습니다</p>
              </div>
            ) : (
              recentActivity.slice(0, 12).map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-xs hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${activity.type === '매출'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-orange-100 text-orange-600'
                      }`}>
                      {activity.type === '매출' ? '💰' : '📦'}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-800">{activity.description}</p>
                      <p className="text-xs text-gray-500">{new Date(activity.date).toLocaleDateString('ko-KR')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${activity.type === '매출' ? 'text-green-600' : 'text-orange-600'
                      }`}>
                      {activity.type === '매출' ? '+' : '-'}{formatCurrency(activity.amount)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* TOP 상품 */}
        <Card className="col-span-4 p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">매출 TOP 5 상품</h3>
          <div className="space-y-2">
            {topProducts.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                <p>매출 데이터가 없습니다</p>
              </div>
            ) : (
              topProducts.slice(0, 4).map((product, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                  <div className="flex items-center">
                    <div className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold mr-2">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800 text-xs">{product.name}</div>
                      <div className="text-xs text-gray-500">{product.quantity}개</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600 text-xs">{formatCurrency(product.revenue)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 채널별 매출 - 원형 시각화 그래프 */}
        <Card className="col-span-4 p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">채널별 매출</h3>
          <div className="space-y-3">
            {channelData.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl">📊</span>
                </div>
                <p>매출 데이터가 없습니다</p>
              </div>
            ) : (
              <>
                {/* 파이차트와 총매출 분리 레이아웃 */}
                <div className="space-y-4">
                  {/* 총 매출 표시 */}
                  <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                    <div className="text-sm text-gray-600 font-medium mb-1">총 매출</div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {formatCurrency(totalRevenue)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {channelData.length}개 채널
                    </div>
                  </div>

                  {/* 고급 인터랙티브 파이차트 */}
                  <div className="flex items-center justify-center relative">
                    <div className="relative w-48 h-48 group">
                      {/* 배경 그림자 */}
                      <div className="absolute inset-2 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full opacity-30 blur-sm"></div>
                      
                      <svg className="w-48 h-48 drop-shadow-lg" viewBox="0 0 200 200">
                        {/* 그라데이션 정의 */}
                        <defs>
                          {channelData.map((_, index) => (
                            <radialGradient key={`gradient-${index}`} id={`gradient-${index}`} cx="50%" cy="50%" r="50%">
                              <stop offset="0%" stopColor={COLORS[index % COLORS.length]} stopOpacity="0.9" />
                              <stop offset="100%" stopColor={COLORS[index % COLORS.length]} stopOpacity="0.7" />
                            </radialGradient>
                          ))}
                          
                          {/* 글로우 효과 */}
                          <filter id="glow">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                            <feMerge> 
                              <feMergeNode in="coloredBlur"/>
                              <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                          </filter>
                          
                          {/* 드롭 섀도우 */}
                          <filter id="dropshadow">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
                          </filter>
                        </defs>
                        
                        {(() => {
                          let cumulativeAngle = 0;
                          const centerX = 100;
                          const centerY = 100;
                          const radius = 80;
                          
                          // 파이 조각을 그리는 함수
                          const createPieSlice = (startAngle: number, endAngle: number) => {
                            const x1 = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
                            const y1 = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
                            const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
                            const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180);
                            
                            const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
                            
                            return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                          };
                          
                          return channelData
                            .sort((a, b) => b.value - a.value)
                            .map((channel, index) => {
                              const percentage = totalRevenue > 0 ? (channel.value / totalRevenue * 100) : 0;
                              const angle = (percentage / 100) * 360;
                              const startAngle = cumulativeAngle;
                              const endAngle = cumulativeAngle + angle;
                              cumulativeAngle += angle;
                              
                              const pathData = createPieSlice(startAngle, endAngle);
                              
                              return (
                                <g key={index}>
                                  {/* 파이 조각 - 로딩 애니메이션 추가 */}
                                  <path
                                    d={pathData}
                                    fill={`url(#gradient-${index})`}
                                    stroke="white"
                                    strokeWidth="2"
                                    className="transition-all duration-500 ease-out hover:scale-105 cursor-pointer"
                                    filter="url(#dropshadow)"
                                    style={{ 
                                      transformOrigin: '100px 100px',
                                      animation: `pieSlideIn 0.8s ease-out ${index * 0.15}s forwards`,
                                      opacity: 0,
                                      transform: 'scale(0) rotate(-90deg)'
                                    }}
                                    onMouseEnter={(e) => {
                                      // 호버 시 조각을 약간 밖으로 이동
                                      const element = e.currentTarget;
                                      const midAngle = (startAngle + endAngle) / 2;
                                      const offsetX = 10 * Math.cos((midAngle * Math.PI) / 180);
                                      const offsetY = 10 * Math.sin((midAngle * Math.PI) / 180);
                                      element.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(1.05)`;
                                      
                                      // 툴팁 표시
                                      const tooltip = document.getElementById('chart-tooltip');
                                      if (tooltip) {
                                        tooltip.style.display = 'block';
                                        tooltip.innerHTML = `
                                          <div class="bg-white p-4 rounded-xl shadow-2xl border border-gray-200 backdrop-blur-sm max-w-xs">
                                            <div class="flex items-center space-x-3 mb-2">
                                              <div class="w-4 h-4 rounded-full shadow-sm" style="background-color: ${COLORS[index % COLORS.length]}"></div>
                                              <span class="font-bold text-gray-800 text-lg">${channel.name}</span>
                                            </div>
                                            <div class="text-2xl font-bold text-gray-900 mb-1">${formatCurrency(channel.value)}</div>
                                            <div class="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-full inline-block">
                                              전체의 ${percentage.toFixed(1)}%
                                            </div>
                                          </div>
                                        `;
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      // 원래 위치로 복귀
                                      const element = e.currentTarget;
                                      element.style.transform = 'translate(0px, 0px) scale(1)';
                                      
                                      // 툴팁 숨기기
                                      const tooltip = document.getElementById('chart-tooltip');
                                      if (tooltip) {
                                        tooltip.style.display = 'none';
                                      }
                                    }}
                                  />
                                  
                                  {/* 호버 시 외곽 글로우 */}
                                  <path
                                    d={pathData}
                                    fill="none"
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth="4"
                                    className="opacity-0 hover:opacity-40 transition-opacity duration-300 pointer-events-none"
                                    filter="url(#glow)"
                                  />
                                </g>
                              );
                            });
                        })()}
                      </svg>
                    </div>
                    
                    {/* 툴팁 컨테이너 */}
                    <div 
                      id="chart-tooltip" 
                      className="absolute z-50 pointer-events-none"
                      style={{ display: 'none', top: '-10px', left: '100%', marginLeft: '10px' }}
                    ></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* 최근 매입 현황 - 채널별 매출 옆에 위치 */}
        {purchaseData.length > 0 && (
          <Card className="col-span-4 p-3">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">최근 매입 현황</h3>
            <div className="space-y-2">
              {purchaseData.slice(0, 6).map((purchase, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold">
                      📦
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">
                        {new Date(purchase.date).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="text-gray-500">
                        {purchase.items}종 · {purchase.quantity}개
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-orange-600">
                      {formatCurrency(purchase.cost)}
                    </div>
                    <div className="text-gray-500">
                      개당 {formatCurrency(purchase.cost / purchase.quantity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

      </div>
    </div>
  );
};

export default Dashboard;