

import * as React from 'react';
import { useState } from 'react';
import { Product, Purchase, Sale, AppSettings, ProductOption } from './types';
import { INITIAL_PRODUCTS, INITIAL_PURCHASES, INITIAL_SALES, INITIAL_SETTINGS, EMPTY_PRODUCTS, EMPTY_PURCHASES, EMPTY_SALES, CNY_TO_KRW_RATE } from './constants';
import { DashboardIcon, ProductIcon, PurchaseIcon, SaleIcon, InventoryIcon, CalculatorIcon, SettingsIcon, LogoutIcon } from './components/icons/Icons';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Purchases from './components/Purchases';
import Sales from './components/Sales';
import Inventory from './components/Inventory';
import MarginCalculator from './components/MarginCalculator';
import Settings from './components/Settings';

type View = 'dashboard' | 'products' | 'purchases' | 'sales' | 'inventory' | 'calculator' | 'settings';

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
    }`}
  >
    {icon}
    <span className="ml-3">{label}</span>
  </button>
);

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [purchases, setPurchases] = useState<Purchase[]>(INITIAL_PURCHASES);
  const [sales, setSales] = useState<Sale[]>(INITIAL_SALES);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [activeView, setActiveView] = useState<View>('dashboard');

  const uuid = () => `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const handleAddProduct = (product: Product) => {
    setProducts(prev => [...prev, product]);
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  const handleUpdateProductOption = (productId: string, optionId: string, updates: Partial<ProductOption>) => {
    setProducts(prev => prev.map(product => {
      if (product.id === productId) {
        return {
          ...product,
          options: product.options.map(option => {
            if (option.id === optionId) {
              return { ...option, ...updates };
            }
            return option;
          })
        };
      }
      return product;
    }));
  };
  
  const handleDeleteProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleAddPurchase = (purchase: Omit<Purchase, 'id'>) => {
    const newPurchase: Purchase = { ...purchase, id: uuid() };
    setPurchases(prev => [...prev, newPurchase]);

    setProducts(prevProducts => {
        const newProducts = JSON.parse(JSON.stringify(prevProducts));

        // 1. Calculate total cost of the purchase in KRW
        const totalItemsCostCny = newPurchase.items.reduce(
            (sum, item) => sum + item.quantity * item.costCnyPerItem, 0
        );
        const totalItemsCostKrw = totalItemsCostCny * CNY_TO_KRW_RATE;


        const totalAdditionalCostsKrw = newPurchase.shippingCostKrw + newPurchase.customsFeeKrw + newPurchase.otherFeeKrw;
        const totalPurchaseCostKrw = totalItemsCostKrw + totalAdditionalCostsKrw;
        
        // 2. Calculate total quantity in the purchase
        const totalQuantity = newPurchase.items.reduce((sum, item) => sum + item.quantity, 0);

        // 3. Calculate the average landed cost per item for this specific purchase
        const averageLandedCostPerItemKrw = totalQuantity > 0 ? totalPurchaseCostKrw / totalQuantity : 0;

        if (averageLandedCostPerItemKrw <= 0) {
            // Nothing to update if cost is zero or negative, but still update stock
            newPurchase.items.forEach(item => {
                const product = newProducts.find((p: Product) => p.id === item.productId);
                if (!product) return;
                const option = product.options.find((o: any) => o.id === item.optionId);
                if (!option) return;
                option.stock += item.quantity;
            });
            return newProducts;
        }

        // 4. Update each product option's costOfGoods using moving average
        newPurchase.items.forEach(item => {
            const product = newProducts.find((p: Product) => p.id === item.productId);
            if (!product) return;

            const option = product.options.find((o: any) => o.id === item.optionId);
            if (!option) return;

            const oldTotalValue = option.costOfGoods * option.stock;
            const newItemsTotalValue = averageLandedCostPerItemKrw * item.quantity;
            const newTotalStock = option.stock + item.quantity;

            // Apply moving average formula
            option.costOfGoods = newTotalStock > 0 ? (oldTotalValue + newItemsTotalValue) / newTotalStock : averageLandedCostPerItemKrw;
            option.stock += item.quantity;
        });

        return newProducts;
    });
  };

  const handleAddSale = (sale: Omit<Sale, 'id'>) => {
    const newSale: Sale = { ...sale, id: uuid() };
    setSales(prev => [...prev, newSale]);

    setProducts(prevProducts => {
        const newProducts = JSON.parse(JSON.stringify(prevProducts));
        const product = newProducts.find((p: Product) => p.id === newSale.productId);
        if (product) {
            const option = product.options.find((o: any) => o.id === newSale.optionId);
            if (option) {
                option.stock -= newSale.quantity;
            }
        }
        return newProducts;
    });
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

  // 완전 초기화 (모든 데이터를 0으로)
  const handleCompleteReset = () => {
    if (window.confirm("정말로 모든 데이터를 완전히 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다!\n- 모든 상품 데이터 삭제\n- 모든 매입 내역 삭제\n- 모든 매출 내역 삭제\n- 재고 현황 초기화\n\n앱이 완전히 빈 상태로 초기화됩니다.")) {
      setProducts(EMPTY_PRODUCTS);
      setPurchases(EMPTY_PURCHASES);
      setSales(EMPTY_SALES);
      setSettings(INITIAL_SETTINGS);
      setActiveView('dashboard');
      alert("✅ 모든 데이터가 완전히 초기화되었습니다.\n이제 새로운 상품부터 등록해보세요!");
    }
  };

  // 샘플 데이터로 초기화
  const handleLoadSampleData = () => {
    if (window.confirm("샘플 데이터를 불러오시겠습니까?\n\n📦 포함되는 데이터:\n- 샘플 상품 2개 (셔츠, 바지)\n- 샘플 매입 내역 1건\n- 샘플 매출 내역 5건\n\n현재 데이터는 모두 교체됩니다.")) {
      setProducts(INITIAL_PRODUCTS);
      setPurchases(INITIAL_PURCHASES);
      setSales(INITIAL_SALES);
      setSettings(INITIAL_SETTINGS);
      setActiveView('dashboard');
      alert("✅ 샘플 데이터가 성공적으로 로드되었습니다!\n대시보드에서 데이터를 확인해보세요.");
    }
  };

  // 기존 함수명 변경 (혼동 방지)
  const handleResetAllData = handleLoadSampleData;

  const navItems = [
    { id: 'dashboard', label: '대시보드', icon: <DashboardIcon /> },
    { id: 'products', label: '상품 관리', icon: <ProductIcon /> },
    { id: 'inventory', label: '재고 현황', icon: <InventoryIcon /> },
    { id: 'purchases', label: '매입 관리', icon: <PurchaseIcon /> },
    { id: 'sales', label: '매출 관리', icon: <SaleIcon /> },
    { id: 'calculator', label: '마진 계산기', icon: <CalculatorIcon /> },
  ];
  
  const bottomNavItems = [
      { id: 'settings', label: '설정', icon: <SettingsIcon /> },
  ]

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard products={products} sales={sales} purchases={purchases} />;
      case 'products':
        return <Products products={products} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct}/>;
      case 'purchases':
        return <Purchases purchases={purchases} products={products} onAddPurchase={handleAddPurchase}/>;
      case 'sales':
        return <Sales sales={sales} products={products} settings={settings} onAddSale={handleAddSale}/>;
      case 'inventory':
        return <Inventory products={products} />;
      case 'calculator':
        return <MarginCalculator products={products} onUpdateProductOption={handleUpdateProductOption} />;
      case 'settings':
        return <Settings 
          settings={settings} 
          onUpdateSettings={handleUpdateSettings} 
          onResetAllData={handleResetAllData}
          onCompleteReset={handleCompleteReset}
          onLoadSampleData={handleLoadSampleData}
        />;
      default:
        return <Dashboard products={products} sales={sales} purchases={purchases} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white flex flex-col shadow-lg">
        <div className="flex items-center justify-center h-20 border-b">
          <h1 className="text-2xl font-bold text-blue-600">BizManager</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map(item => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeView === item.id}
              onClick={() => setActiveView(item.id as View)}
            />
          ))}
        </nav>
        <div className="px-4 py-6 border-t">
           {bottomNavItems.map(item => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={activeView === item.id}
                  onClick={() => setActiveView(item.id as View)}
                />
            ))}
           <div className="mt-2">
            <NavItem icon={<LogoutIcon />} label="로그아웃" isActive={false} onClick={() => {}} />
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;