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
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gray-800">대시보드</h1>

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

        {/* 월별 데이터 - 넓은 카드 */}
        <Card className="col-span-7 p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">월별 매출 vs 매입</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1 px-2 font-semibold text-gray-700">월</th>
                  <th className="text-right py-1 px-2 font-semibold text-gray-700">매출</th>
                  <th className="text-right py-1 px-2 font-semibold text-gray-700">매입비용</th>
                  <th className="text-right py-1 px-2 font-semibold text-gray-700">순이익</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-gray-500 text-xs">
                      데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  monthlyData.slice(-6).map((data, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-1 px-2">{data.date}</td>
                      <td className="py-1 px-2 text-right font-medium text-green-600">
                        {formatCurrency(data.매출)}
                      </td>
                      <td className="py-1 px-2 text-right font-medium text-orange-600">
                        {formatCurrency(data.매입비용)}
                      </td>
                      <td className={`py-1 px-2 text-right font-medium ${data.순이익 > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(data.순이익)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 최근 활동 - 세로 긴 카드 */}
        <Card className="col-span-5 p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">최근 활동</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                <p>최근 활동이 없습니다</p>
              </div>
            ) : (
              recentActivity.slice(0, 8).map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                  <div className="flex items-center space-x-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${activity.type === '매출'
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

        {/* 채널별 매출 */}
        <Card className="col-span-4 p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">채널별 매출</h3>
          <div className="space-y-2">
            {channelData.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                <p>매출 데이터가 없습니다</p>
              </div>
            ) : (
              channelData.map((channel, index) => {
                const percentage = totalRevenue > 0 ? (channel.value / totalRevenue * 100) : 0;
                return (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <span className="font-medium text-gray-800 text-xs">{channel.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-800 text-xs">{formatCurrency(channel.value)}</div>
                      <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* 매입 분석 - 넓은 카드 */}
        {purchaseData.length > 0 && (
          <Card className="col-span-12 p-3">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">최근 매입 현황</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-2 rounded border border-orange-200">
                <h4 className="text-orange-600 font-medium text-xs">평균 매입 비용</h4>
                <p className="text-sm font-bold text-orange-800 mt-1">
                  {formatCurrency(totalPurchaseCost / totalPurchaseCount)}
                </p>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-2 rounded border border-blue-200">
                <h4 className="text-blue-600 font-medium text-xs">평균 매입 수량</h4>
                <p className="text-sm font-bold text-blue-800 mt-1">
                  {Math.round(purchaseData.reduce((sum, p) => sum + p.quantity, 0) / purchaseData.length)}개
                </p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-2 rounded border border-purple-200">
                <h4 className="text-purple-600 font-medium text-xs">평균 상품 종류</h4>
                <p className="text-sm font-bold text-purple-800 mt-1">
                  {Math.round(purchaseData.reduce((sum, p) => sum + p.items, 0) / purchaseData.length)}종
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1 px-2 font-semibold text-gray-700">날짜</th>
                    <th className="text-right py-1 px-2 font-semibold text-gray-700">매입 비용</th>
                    <th className="text-right py-1 px-2 font-semibold text-gray-700">수량</th>
                    <th className="text-right py-1 px-2 font-semibold text-gray-700">상품 종류</th>
                    <th className="text-right py-1 px-2 font-semibold text-gray-700">개당 평균 원가</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseData.slice(0, 5).map((purchase, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-1 px-2">
                        {new Date(purchase.date).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="py-1 px-2 text-right font-medium text-orange-600">
                        {formatCurrency(purchase.cost)}
                      </td>
                      <td className="py-1 px-2 text-right">{purchase.quantity}개</td>
                      <td className="py-1 px-2 text-right">{purchase.items}종</td>
                      <td className="py-1 px-2 text-right font-medium">
                        {formatCurrency(purchase.cost / purchase.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
};

export default Dashboard;