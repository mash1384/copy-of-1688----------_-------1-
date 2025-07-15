export enum SalesChannel {
  SMART_STORE = '스마트스토어',
  COUPANG = '쿠팡',
  OWN_MALL = '자사몰',
  OTHER = '기타',
}

export interface AppSettings {
  defaultPackagingCostKrw: number;
  defaultShippingCostKrw: number;
}

export interface ProductOption {
  id: string;
  name: string; // e.g., "블랙 / M"
  sku: string;
  stock: number;
  costOfGoods: number; // 개당 총 매입 원가 (KRW)
  recommendedPrice?: number; // 권장 판매가 (KRW) - 마진 계산기에서 설정
}

export interface Product {
  id: string;
  name: string;
  imageUrl: string; // URL or Base64 Data URL
  baseCostCny: number; // 1688 매입 원가 (위안)
  options: ProductOption[];
}

export interface PurchaseItem {
  productId: string;
  optionId: string;
  quantity: number;
  costCnyPerItem: number; // 당시 매입가 (위안)
}

export interface Purchase {
  id:string;
  date: string;
  items: PurchaseItem[];
  shippingCostKrw: number;
  customsFeeKrw: number;
  otherFeeKrw: number;
}

export interface Sale {
  id: string;
  date: string;
  productId: string;
  optionId: string;
  quantity: number;
  salePricePerItem: number; // 개당 판매가 (KRW)
  channel: SalesChannel;
  channelFeePercentage: number; // 판매 채널 수수료 (%)
  packagingCostKrw: number; // 포장비
  shippingCostKrw: number; // 국내 배송비
}