import { Product, Purchase, Sale, SalesChannel, AppSettings } from './types';

export const CNY_TO_KRW_RATE = 190;

export const INITIAL_SETTINGS: AppSettings = {
  defaultPackagingCostKrw: 500,
  defaultShippingCostKrw: 3000,
};

// 빈 데이터 상수 (완전 초기화용)
export const EMPTY_PRODUCTS: Product[] = [];
export const EMPTY_PURCHASES: Purchase[] = [];
export const EMPTY_SALES: Sale[] = [];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    name: '오버핏 코튼 셔츠',
    imageUrl: 'https://picsum.photos/id/1025/400/400',
    baseCostCny: 50,
    options: [
      { id: 'opt_1_1', name: '화이트 / M', sku: 'SHIRT-WH-M', stock: 50, costOfGoods: 11000 },
      { id: 'opt_1_2', name: '화이트 / L', sku: 'SHIRT-WH-L', stock: 40, costOfGoods: 11000 },
      { id: 'opt_1_3', name: '블랙 / M', sku: 'SHIRT-BL-M', stock: 30, costOfGoods: 11500 },
      { id: 'opt_1_4', name: '블랙 / L', sku: 'SHIRT-BL-L', stock: 5, costOfGoods: 11500 },
    ],
  },
  {
    id: 'prod_2',
    name: '와이드 데님 팬츠',
    imageUrl: 'https://picsum.photos/id/103/400/400',
    baseCostCny: 80,
    options: [
      { id: 'opt_2_1', name: '라이트블루 / S', sku: 'PANTS-LB-S', stock: 25, costOfGoods: 18000 },
      { id: 'opt_2_2', name: '라이트블루 / M', sku: 'PANTS-LB-M', stock: 15, costOfGoods: 18000 },
      { id: 'opt_2_3', name: '딥블루 / S', sku: 'PANTS-DB-S', stock: 20, costOfGoods: 18500 },
    ],
  },
];

export const INITIAL_PURCHASES: Purchase[] = [
    {
        id: 'pur_1',
        date: '2024-04-10',
        items: [
            { productId: 'prod_1', optionId: 'opt_1_1', quantity: 50, costCnyPerItem: 50 },
            { productId: 'prod_1', optionId: 'opt_1_2', quantity: 40, costCnyPerItem: 50 },
            { productId: 'prod_1', optionId: 'opt_1_3', quantity: 30, costCnyPerItem: 52 },
            { productId: 'prod_1', optionId: 'opt_1_4', quantity: 10, costCnyPerItem: 52 },
        ],
        shippingCostKrw: 150000,
        customsFeeKrw: 80000,
        otherFeeKrw: 20000
    }
];

export const INITIAL_SALES: Sale[] = [
    { id: 'sale_1', date: '2024-05-01', productId: 'prod_1', optionId: 'opt_1_1', quantity: 2, salePricePerItem: 29900, channel: SalesChannel.SMART_STORE, channelFeePercentage: 5.5, packagingCostKrw: 500, shippingCostKrw: 3000 },
    { id: 'sale_2', date: '2024-05-02', productId: 'prod_2', optionId: 'opt_2_1', quantity: 1, salePricePerItem: 45000, channel: SalesChannel.COUPANG, channelFeePercentage: 10.8, packagingCostKrw: 500, shippingCostKrw: 3000 },
    { id: 'sale_3', date: '2024-05-03', productId: 'prod_1', optionId: 'opt_1_3', quantity: 1, salePricePerItem: 31900, channel: SalesChannel.OWN_MALL, channelFeePercentage: 2.0, packagingCostKrw: 500, shippingCostKrw: 0 },
    { id: 'sale_4', date: '2024-05-04', productId: 'prod_1', optionId: 'opt_1_4', quantity: 5, salePricePerItem: 29900, channel: SalesChannel.SMART_STORE, channelFeePercentage: 5.5, packagingCostKrw: 1000, shippingCostKrw: 3000 },
    { id: 'sale_5', date: '2024-05-05', productId: 'prod_2', optionId: 'opt_2_2', quantity: 3, salePricePerItem: 45000, channel: SalesChannel.COUPANG, channelFeePercentage: 10.8, packagingCostKrw: 500, shippingCostKrw: 3000 },
];