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

    // 월별 데이터 통합 및 투자회수율 계산
    const allDates = new Set([...Object.keys(salesByDate), ...Object.keys(purchasesByDate)]);
    const monthlyData = Array.from(allDates)
      .map(date => ({
        date,
        매출: salesByDate[date]?.revenue || 0,
        순이익: salesByDate[date]?.profit || 0,
        매입비용: purchasesByDate[date]?.cost || 0,
        매입수량: purchasesByDate[date]?.quantity || 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((data, index, array) => {
        // 누적 투자금액과 누적 매출 계산
        const cumulativeInvestment = array.slice(0, index + 1).reduce((sum, d) => sum + d.매입비용, 0);
        const cumulativeRevenue = array.slice(0, index + 1).reduce((sum, d) => sum + d.매출, 0);
        const recoveryRate = cumulativeInvestment > 0 ? (cumulativeRevenue / cumulativeInvestment) * 100 : 0;

        return {
          ...data,
          투자회수율: recoveryRate
        };
      });

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

        {/* 채널별 매출 - 순위만 */}
        <Card className="col-span-3 p-3">
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
              <div className="space-y-2">
                <div className="text-sm text-gray-600 font-medium text-center mb-3">채널별 순위</div>
                {channelData
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 3)
                  .map((channel, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${index === 0 ? 'bg-yellow-500' :
                          index === 1 ? 'bg-gray-400' :
                            'bg-orange-500'
                          }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800">{channel.name}</div>
                          <div className="text-xs text-gray-500">
                            {((channel.value / totalRevenue) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          {formatCurrency(channel.value)}
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </Card>

        {/* 최근 매입 현황 - 두 번째 줄 오른쪽 */}
        <Card className="col-span-4 p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">최근 매입 현황</h3>
          <div className="space-y-2">
            {purchaseData.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl">📦</span>
                </div>
                <p>매입 데이터가 없습니다</p>
              </div>
            ) : (
              purchaseData.slice(0, 5).map((purchase, index) => (
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
              ))
            )}
          </div>
        </Card>

        {/* 월별 성과 요약 - 바차트 */}
        <Card className="col-span-4 p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">월별 성과 요약</h3>
          <div className="space-y-3">
            {monthlyData.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl">📊</span>
                </div>
                <p>데이터가 없습니다</p>
              </div>
            ) : (
              <>
                {/* 범례 */}
                <div className="flex items-center justify-center space-x-4 text-xs">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                    <span className="text-gray-600">매출</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                    <span className="text-gray-600">순이익</span>
                  </div>
                </div>

                {/* 세로 바 그래프 */}
                <div className="relative h-72 bg-gradient-to-b from-gray-50 to-white rounded-lg border border-gray-100 p-4 overflow-hidden">
                  {(() => {
                    // 최대 5개월로 고정
                    const maxMonths = 5;
                    const chartData = monthlyData.slice(-Math.min(maxMonths, monthlyData.length));
                    if (chartData.length === 0) return null;

                    // 상대적 비율 계산을 위한 최대값 찾기 (0이 아닌 값들만)
                    const revenueValues = chartData.map(d => d.매출).filter(v => v > 0);
                    const profitValues = chartData.map(d => Math.abs(d.순이익)).filter(v => v > 0);

                    const maxRevenue = revenueValues.length > 0 ? Math.max(...revenueValues) : 1;
                    const maxProfit = profitValues.length > 0 ? Math.max(...profitValues) : 1;

                    // 개월 수에 따른 반응형 차트 크기 조절
                    const getResponsiveStyles = (monthCount: number) => {
                      switch (monthCount) {
                        case 1:
                          return { barWidth: 'w-16', spacing: 'space-x-0', fontSize: 'text-sm' };
                        case 2:
                          return { barWidth: 'w-14', spacing: 'space-x-6', fontSize: 'text-sm' };
                        case 3:
                          return { barWidth: 'w-12', spacing: 'space-x-4', fontSize: 'text-xs' };
                        case 4:
                          return { barWidth: 'w-10', spacing: 'space-x-3', fontSize: 'text-xs' };
                        case 5:
                          return { barWidth: 'w-8', spacing: 'space-x-2', fontSize: 'text-xs' };
                        default:
                          return { barWidth: 'w-8', spacing: 'space-x-2', fontSize: 'text-xs' };
                      }
                    };

                    const { barWidth, spacing, fontSize } = getResponsiveStyles(chartData.length);

                    return (
                      <div className="w-full h-full flex">
                        {/* Y축 라벨 영역 */}
                        <div className="w-12 flex flex-col justify-between text-xs text-gray-500 py-4 pr-2">
                          <span className="text-right">최대</span>
                          <span className="text-right">75%</span>
                          <span className="text-right">50%</span>
                          <span className="text-right">25%</span>
                          <span className="text-right">최소</span>
                        </div>
                        
                        {/* 차트 영역 */}
                        <div className="flex-1 relative">
                          <div className={`w-full h-full flex items-end justify-center ${spacing}`}>
                            {chartData.map((data, index) => {
                              // 상대적 비율로 높이 계산 (최대값은 100%, 최소값은 10%)
                              const revenueHeight = data.매출 > 0
                                ? Math.max(10, (data.매출 / maxRevenue) * 100)
                                : 0;

                              const profitHeight = Math.abs(data.순이익) > 0
                                ? Math.max(10, (Math.abs(data.순이익) / maxProfit) * 100)
                                : 0;

                              const isProfitPositive = data.순이익 >= 0;

                              return (
                                <div key={index} className="flex-1 flex flex-col items-center space-y-3 group relative">
                                  {/* 통합 툴팁 (호버 시 표시) - 고정 위치 */}
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -top-20 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-xl z-20 pointer-events-none min-w-max">
                                    <div className="p-3 space-y-2">
                                      <div className="text-center font-bold text-gray-800 text-sm border-b border-gray-100 pb-2">
                                        {new Date(data.date + '-01').toLocaleDateString('ko-KR', { month: 'short' })}
                                      </div>
                                      <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="text-center">
                                          <div className="text-emerald-600 font-medium">매출</div>
                                          <div className="font-bold text-emerald-700">{formatCurrency(data.매출)}</div>
                                        </div>
                                        <div className="text-center">
                                          <div className={`font-medium ${isProfitPositive ? 'text-blue-600' : 'text-red-600'}`}>순이익</div>
                                          <div className={`font-bold ${isProfitPositive ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(data.순이익)}</div>
                                        </div>
                                      </div>
                                      <div className="text-center text-xs text-gray-600 pt-1 border-t border-gray-100">
                                        마진율: {data.매출 > 0 ? ((data.순이익 / data.매출) * 100).toFixed(1) : 0}%
                                      </div>
                                    </div>
                                    {/* 툴팁 화살표 */}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200"></div>
                                  </div>

                                  {/* 바 그래프 컨테이너 */}
                                  <div className="flex items-end justify-center space-x-4 h-52">
                                {/* 매출 바 */}
                                <div className="flex flex-col items-center">
                                  <div className="relative flex flex-col justify-end h-44">
                                    <div
                                      className={`${barWidth} bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 rounded-t-lg transition-colors duration-300 ease-out hover:from-emerald-700 hover:via-emerald-600 hover:to-emerald-500 shadow-lg cursor-pointer`}
                                      style={{
                                        height: `${revenueHeight}%`,
                                        minHeight: data.매출 > 0 ? '8px' : '0px'
                                      }}
                                    ></div>
                                  </div>
                                  <div className={`${fontSize} font-medium text-emerald-600 mt-2`}>매출</div>
                                </div>

                                {/* 순이익 바 */}
                                <div className="flex flex-col items-center">
                                  <div className="relative flex flex-col justify-end h-44">
                                    <div
                                      className={`${barWidth} rounded-t-lg transition-colors duration-300 ease-out shadow-lg cursor-pointer ${isProfitPositive
                                        ? 'bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400 hover:from-blue-700 hover:via-blue-600 hover:to-blue-500'
                                        : 'bg-gradient-to-t from-red-600 via-red-500 to-red-400 hover:from-red-700 hover:via-red-600 hover:to-red-500'
                                        }`}
                                      style={{
                                        height: `${profitHeight}%`,
                                        minHeight: Math.abs(data.순이익) > 0 ? '8px' : '0px'
                                      }}
                                    ></div>
                                  </div>
                                  <div className={`${fontSize} font-medium mt-2 ${isProfitPositive ? 'text-blue-600' : 'text-red-600'}`}>
                                    순이익
                                  </div>
                                </div>
                              </div>

                              {/* 월 라벨 */}
                              <div className="text-sm font-bold text-gray-800 text-center bg-gray-100 px-3 py-1 rounded-full">
                                {new Date(data.date + '-01').toLocaleDateString('ko-KR', { month: 'short' })}
                              </div>
                            </div>
                              );
                            })}
                          </div>
                          
                          {/* Y축 가이드라인 */}
                          <div className="absolute inset-0 pointer-events-none">
                            {[25, 50, 75].map((percent) => (
                              <div
                                key={percent}
                                className="absolute w-full border-t border-gray-300 border-dashed opacity-25"
                                style={{ bottom: `${percent}%` }}
                              ></div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 요약 통계 */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                  <div className="text-center p-2 bg-emerald-50 rounded-lg">
                    <div className="text-xs text-emerald-600 font-medium mb-1">평균 매출</div>
                    <div className="text-sm font-bold text-emerald-700">
                      {formatCurrency(monthlyData.slice(-4).reduce((sum, d) => sum + d.매출, 0) / Math.min(4, monthlyData.length))}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <div className="text-xs text-blue-600 font-medium mb-1">평균 순이익</div>
                    <div className="text-sm font-bold text-blue-700">
                      {formatCurrency(monthlyData.slice(-4).reduce((sum, d) => sum + d.순이익, 0) / Math.min(4, monthlyData.length))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* 재고 현황 */}
        <Card className="col-span-4 p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">재고 현황</h3>
          <div className="space-y-3">
            {/* 재고 요약 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-xs text-purple-600 font-medium mb-1">총 재고 가치</div>
                <div className="text-lg font-bold text-purple-700">
                  {formatCurrency(totalInventoryValue)}
                </div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-xs text-orange-600 font-medium mb-1">총 상품 수</div>
                <div className="text-lg font-bold text-orange-700">
                  {products.length}개
                </div>
              </div>
            </div>

            {/* 재고 부족 상품 */}
            <div className="space-y-2">
              <div className="text-xs text-gray-600 font-medium">재고 부족 상품</div>
              {(() => {
                const lowStockProducts = products
                  .flatMap(product =>
                    product.options
                      .filter(option => option.stock <= 5)
                      .map(option => ({
                        productName: product.name,
                        optionName: option.name,
                        stock: option.stock
                      }))
                  )
                  .slice(0, 3);

                return lowStockProducts.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-xs">
                    <span className="text-green-600">✅ 재고 부족 상품 없음</span>
                  </div>
                ) : (
                  lowStockProducts.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-200">
                      <div>
                        <div className="font-medium text-gray-800 text-xs">{item.productName}</div>
                        <div className="text-xs text-gray-500">{item.optionName}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-red-600 text-xs">{item.stock}개</div>
                        <div className="text-xs text-red-500">부족</div>
                      </div>
                    </div>
                  ))
                );
              })()}
            </div>
          </div>
        </Card>



      </div>
    </div>
  );
};

export default Dashboard;