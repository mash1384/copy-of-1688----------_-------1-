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
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">대시보드</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <Card>
          <div>
            <h3 className="text-gray-500 font-medium text-sm">총 매출</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(totalRevenue)}</p>
          </div>
        </Card>

        <Card>
          <div>
            <h3 className="text-gray-500 font-medium text-sm">총 매입 비용</h3>
            <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(totalPurchaseCost)}</p>
          </div>
        </Card>

        <Card>
          <div>
            <h3 className="text-gray-500 font-medium text-sm">총 순이익</h3>
            <p className={`text-2xl font-bold mt-1 ${totalProfit < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(totalProfit)}
            </p>
          </div>
        </Card>

        <Card>
          <div>
            <h3 className="text-gray-500 font-medium text-sm">마진율</h3>
            <p className="text-2xl font-bold text-blue-600 mt-1">{totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%</p>
          </div>
        </Card>

        <Card>
          <div>
            <h3 className="text-gray-500 font-medium text-sm">재고 가치</h3>
            <p className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(totalInventoryValue)}</p>
          </div>
        </Card>

        <Card>
          <div>
            <h3 className="text-gray-500 font-medium text-sm">매입 건수</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{formatNumber(totalPurchaseCount)}</p>
          </div>
        </Card>
      </div>

      {/* 데이터 분석 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">월별 매출 vs 매입</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">월</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">매출</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">매입비용</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">순이익</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  monthlyData.map((data, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3">{data.date}</td>
                      <td className="py-2 px-3 text-right font-medium text-green-600">
                        {formatCurrency(data.매출)}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-orange-600">
                        {formatCurrency(data.매입비용)}
                      </td>
                      <td className={`py-2 px-3 text-right font-medium ${data.순이익 > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(data.순이익)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">채널별 매출 비중</h3>
          <div className="space-y-3">
            {channelData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>매출 데이터가 없습니다</p>
              </div>
            ) : (
              channelData.map((channel, index) => {
                const percentage = totalRevenue > 0 ? (channel.value / totalRevenue * 100) : 0;
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div
                        className="w-4 h-4 rounded-full mr-3"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <span className="font-medium text-gray-800">{channel.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-800">{formatCurrency(channel.value)}</div>
                      <div className="text-sm text-gray-500">{percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">매출 TOP 5 상품</h3>
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>매출 데이터가 없습니다</p>
              </div>
            ) : (
              topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.quantity}개 판매</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">{formatCurrency(product.revenue)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">최근 활동</h3>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>최근 활동이 없습니다</p>
              </div>
            ) : (
              recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${activity.type === '매출'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-orange-100 text-orange-600'
                      }`}>
                      {activity.type === '매출' ? '💰' : '📦'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{activity.description}</p>
                      <p className="text-xs text-gray-500">{new Date(activity.date).toLocaleDateString('ko-KR')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${activity.type === '매출' ? 'text-green-600' : 'text-orange-600'
                      }`}>
                      {activity.type === '매출' ? '+' : '-'}{formatCurrency(activity.amount)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* 매입 분석 섹션 */}
      {purchaseData.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">최근 매입 현황</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
              <h4 className="text-orange-600 font-medium text-sm">평균 매입 비용</h4>
              <p className="text-2xl font-bold text-orange-800 mt-1">
                {formatCurrency(totalPurchaseCost / totalPurchaseCount)}
              </p>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <h4 className="text-blue-600 font-medium text-sm">평균 매입 수량</h4>
              <p className="text-2xl font-bold text-blue-800 mt-1">
                {Math.round(purchaseData.reduce((sum, p) => sum + p.quantity, 0) / purchaseData.length)}개
              </p>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <h4 className="text-purple-600 font-medium text-sm">평균 상품 종류</h4>
              <p className="text-2xl font-bold text-purple-800 mt-1">
                {Math.round(purchaseData.reduce((sum, p) => sum + p.items, 0) / purchaseData.length)}종
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">날짜</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">매입 비용</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">수량</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">상품 종류</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">개당 평균 원가</th>
                </tr>
              </thead>
              <tbody>
                {purchaseData.slice(0, 10).map((purchase, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {new Date(purchase.date).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-orange-600">
                      {formatCurrency(purchase.cost)}
                    </td>
                    <td className="py-3 px-4 text-right">{purchase.quantity}개</td>
                    <td className="py-3 px-4 text-right">{purchase.items}종</td>
                    <td className="py-3 px-4 text-right font-medium">
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
  );
};

export default Dashboard;