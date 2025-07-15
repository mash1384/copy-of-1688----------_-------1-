# 🏪 BizManager - 1688 의류 사업자 관리 시스템

1688에서 의류를 수입하여 판매하는 사업자를 위한 종합 관리 시스템입니다.

## ✨ 주요 기능

### 📦 상품 관리
- 상품 등록 및 수정
- 옵션별 재고 관리
- 이미지 업로드 지원
- 1688 매입가 관리

### 💰 매입 관리
- 매입 내역 등록
- 배송비, 관세, 기타 비용 관리
- 실제 개당 원가 자동 계산
- 매입 통계 및 분석

### 📊 매출 관리
- 판매 내역 등록
- 채널별 수수료 관리
- 순이익 및 마진율 계산
- 매출 상세 분석

### 📈 재고 현황
- 실시간 재고 추적
- 재고 부족 알림
- 재고 가치 계산

### 🧮 마진 계산기
- 실시간 수익성 분석
- 마진율/순이익률 기준 가격 계산
- 투자 회수 분석
- 상품별 권장 판매가 저장

### 📋 대시보드
- 핵심 지표 요약
- 월별 매출/매입 분석
- 채널별 매출 현황
- 최근 활동 내역

## 🚀 시작하기

### 필요 조건
- Node.js 16.0 이상
- npm 또는 yarn

### 설치 및 실행

1. **저장소 클론**
   ```bash
   git clone https://github.com/YOUR_USERNAME/bizmanager-app.git
   cd bizmanager-app
   ```

2. **의존성 설치**
   ```bash
   npm install
   # 또는
   yarn install
   ```

3. **개발 서버 실행**
   ```bash
   npm run dev
   # 또는
   yarn dev
   ```

4. **브라우저에서 확인**
   - http://localhost:5173 접속

## 🛠️ 기술 스택

- **Frontend**: React 18, TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Icons**: Custom SVG Icons

## 📱 주요 화면

### 대시보드
- 총 매출, 매입 비용, 순이익 등 핵심 지표
- 월별 매출/매입 추이
- 채널별 매출 분석

### 상품 관리
- 상품 등록/수정/삭제
- 옵션별 재고 및 원가 관리
- 권장 판매가 확인

### 매입 관리
- 매입 내역 등록
- 실시간 원가 계산
- 매입 통계 분석

### 마진 계산기
- 다양한 계산 모드 지원
- 실시간 수익성 분석
- 투자 회수 시뮬레이션

## 🎯 사용 가이드

### 처음 사용하는 경우
1. **설정** 페이지에서 "샘플 데이터 불러오기" 클릭
2. 샘플 데이터로 각 기능 체험
3. 실제 데이터 입력 시작

### 실제 운영하는 경우
1. **설정** 페이지에서 "완전 초기화" 클릭
2. **상품 관리**에서 상품 등록
3. **매입 관리**에서 매입 내역 등록
4. **매출 관리**에서 판매 내역 등록

## 💡 주요 특징

- **실시간 계산**: 매입부터 판매까지 모든 비용을 고려한 정확한 수익성 분석
- **직관적 UI**: 사업자가 쉽게 사용할 수 있는 직관적인 인터페이스
- **데이터 영속성**: 브라우저 새로고침 후에도 데이터 유지
- **반응형 디자인**: 데스크톱과 모바일에서 모두 사용 가능

## 🔧 개발 정보

### 프로젝트 구조
```
src/
├── components/          # React 컴포넌트
│   ├── forms/          # 폼 컴포넌트
│   ├── icons/          # 아이콘 컴포넌트
│   ├── modals/         # 모달 컴포넌트
│   └── ui/             # UI 컴포넌트
├── types.ts            # TypeScript 타입 정의
├── constants.ts        # 상수 및 초기 데이터
└── App.tsx            # 메인 앱 컴포넌트
```

### 주요 컴포넌트
- `Dashboard`: 대시보드 화면
- `Products`: 상품 관리
- `Purchases`: 매입 관리
- `Sales`: 매출 관리
- `Inventory`: 재고 현황
- `MarginCalculator`: 마진 계산기
- `Settings`: 설정

## 📄 라이선스

MIT License

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 문의

프로젝트에 대한 문의사항이나 버그 리포트는 Issues 탭을 이용해주세요.

---

**Made with ❤️ for 1688 의류 사업자들**