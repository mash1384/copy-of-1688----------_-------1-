import * as React from 'react';
import { Sale, Product } from '../../types';
import Modal from '../ui/Modal';

interface SaleDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: Sale | null;
    products: Product[];
}

const formatCurrency = (value: number) => `₩${Math.round(value).toLocaleString()}`;

const DetailRow: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`flex justify-between py-2 ${className}`}>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="text-sm text-gray-900">{value}</dd>
    </div>
);

const SaleDetailModal: React.FC<SaleDetailModalProps> = ({ isOpen, onClose, sale, products }) => {
    if (!sale) return null;

    const product = products.find(p => p.id === sale.productId);
    const option = product?.options.find(o => o.id === sale.optionId);

    if (!product || !option) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="매출 상세 정보">
                <p>상품 정보를 찾을 수 없습니다. 삭제되었을 수 있습니다.</p>
            </Modal>
        );
    }

    const totalRevenue = sale.quantity * sale.salePricePerItem;
    const costOfGoods = sale.quantity * option.costOfGoods;
    const channelFee = totalRevenue * (sale.channelFeePercentage / 100);
    const totalPackagingCost = sale.packagingCostKrw * sale.quantity;
    const totalShippingCost = sale.shippingCostKrw * sale.quantity;
    const totalCosts = costOfGoods + channelFee + totalPackagingCost + totalShippingCost;
    const profit = totalRevenue - totalCosts;
    const marginRate = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`매출 상세 정보 (ID: ${sale.id})`}>
            <div className="space-y-6">
                {/* Product Info */}
                <div className="flex items-center space-x-4">
                    <img src={product.imageUrl} alt={product.name} className="h-16 w-16 rounded-lg object-cover" />
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">{product.name}</h3>
                        <p className="text-sm text-gray-500">{option.name}</p>
                        <p className="text-sm text-gray-500">판매일: {sale.date}</p>
                    </div>
                </div>

                {/* Calculation Breakdown */}
                <div className="space-y-4">
                    {/* Revenue Section */}
                    <div>
                        <h4 className="font-semibold text-gray-700 border-b pb-1 mb-2">수익(+)</h4>
                        <dl className="divide-y divide-gray-200">
                            <DetailRow label="개당 판매가" value={`${formatCurrency(sale.salePricePerItem)}`} />
                            <DetailRow label="판매 수량" value={`${sale.quantity}개`} />
                            <DetailRow label="총 매출" value={formatCurrency(totalRevenue)} className="font-bold bg-green-50" />
                        </dl>
                    </div>

                    {/* Costs Section */}
                    <div>
                        <h4 className="font-semibold text-gray-700 border-b pb-1 mb-2">비용(-)</h4>
                        <dl className="divide-y divide-gray-200">
                            <DetailRow label="매입 원가" value={`${formatCurrency(costOfGoods)} (${formatCurrency(option.costOfGoods)}/개)`} />
                            <DetailRow label={`채널 수수료 (${sale.channelFeePercentage}%)`} value={formatCurrency(channelFee)} />
                            <DetailRow label="포장비" value={`${formatCurrency(totalPackagingCost)} (${formatCurrency(sale.packagingCostKrw)}/개)`} />
                            <DetailRow label="국내 배송비" value={`${formatCurrency(totalShippingCost)} (${formatCurrency(sale.shippingCostKrw)}/개)`} />
                            <DetailRow label="총 비용" value={formatCurrency(totalCosts)} className="font-bold bg-red-50" />
                        </dl>
                    </div>

                    {/* Summary Section */}
                    <div>
                        <h4 className="font-semibold text-gray-700 border-b pb-1 mb-2">요약</h4>
                        <dl className="space-y-2">
                            <div className="flex justify-between items-center bg-gray-100 p-3 rounded-md">
                                <dt className="text-lg font-bold text-gray-800">최종 순이익</dt>
                                <dd className={`text-xl font-bold ${profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(profit)}
                                </dd>
                            </div>
                            <div className="flex justify-between items-center bg-gray-100 p-3 rounded-md">
                                <dt className="text-lg font-bold text-gray-800">마진율</dt>
                                <dd className="text-xl font-bold text-blue-600">
                                    {marginRate.toFixed(2)}%
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t">
                    <button
                        onClick={onClose}
                        className="inline-flex items-center justify-center bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition duration-200 text-sm whitespace-nowrap"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default SaleDetailModal;