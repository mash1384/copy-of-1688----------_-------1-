import * as React from 'react';
import { useState } from 'react';
import { Sale, Product, AppSettings } from '../types';
import Card from './ui/Card';
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
  }

  const handleOpenDetailModal = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedSale(null);
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">매출 관리</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 text-sm whitespace-nowrap">
          <PlusIcon className="w-4 h-4 mr-1.5" />
          새 매출 등록
        </button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">판매일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품 정보</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">판매가</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">채널/수수료</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">순이익/마진율</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(sale => {
                const { productName, optionName, profit, marginRate, costs } = getSaleDetails(sale);
                const costTooltip = `매입원가: ₩${Math.round(costs.totalCost).toLocaleString()}\n채널수수료: ₩${Math.round(costs.channelFee).toLocaleString()}\n포장/배송비: ₩${(costs.packagingCost + costs.shippingCost).toLocaleString()}`;

                return (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{productName}</div>
                      <div className="text-sm text-gray-500">{optionName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">₩{(sale.salePricePerItem * sale.quantity).toLocaleString()}</div>
                      <div className="text-sm text-gray-500">({sale.quantity}개)</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{sale.channel}</div>
                      <div className="text-sm text-gray-500">{sale.channelFeePercentage}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className={`font-semibold ${profit > 0 ? 'text-green-600' : 'text-red-600'}`} title={costTooltip}>
                        ₩{Math.round(profit).toLocaleString()}
                      </div>
                      <div className="text-gray-500">{marginRate.toFixed(1)}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleOpenDetailModal(sale)}
                        className="text-blue-600 hover:text-blue-900 transition duration-150 ease-in-out"
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
      </Card>
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
  );
};

export default Sales;