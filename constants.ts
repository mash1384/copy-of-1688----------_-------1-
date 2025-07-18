// 상수 정의
export const CNY_TO_KRW_RATE = 200; // 위안-원 환율 (대략적인 값, 실제로는 API에서 가져와야 함)

// 기본 설정값
export const DEFAULT_PACKAGING_COST_KRW = 1000;
export const DEFAULT_SHIPPING_COST_KRW = 3000;

// 판매 채널별 기본 수수료율 (%)
export const DEFAULT_CHANNEL_FEES = {
  '스마트스토어': 3.5,
  '쿠팡': 8.0,
  '자사몰': 0,
  '기타': 5.0
};