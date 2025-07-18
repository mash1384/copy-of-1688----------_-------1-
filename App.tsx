

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Product, Purchase, Sale, AppSettings, ProductOption } from './types';
import { 
  getProducts, 
  addProduct, 
  updateProduct, 
  deleteProduct,
  getSales,
  addSale,
  getPurchases,
  addPurchase,
  getSettings,
  updateSettings,
  updateProductOption,
  createSampleData,
  deleteAllData
} from './lib/database';
import { DashboardIcon, ProductIcon, PurchaseIcon, SaleIcon, InventoryIcon, CalculatorIcon, SettingsIcon } from './components/icons/Icons';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { lazy, Suspense } from 'react';
import Login from './components/Login';
import UserProfile from './components/UserProfile';

// 지연 로딩으로 성능 개선
const Dashboard = lazy(() => import('./components/Dashboard'));
const Products = lazy(() => import('./components/Products'));
const Purchases = lazy(() => import('./components/Purchases'));
const Sales = lazy(() => import('./components/Sales'));
const Inventory = lazy(() => import('./components/Inventory'));
const MarginCalculator = lazy(() => import('./components/MarginCalculator'));
const Settings = lazy(() => import('./components/Settings'));

type View = 'dashboard' | 'products' | 'purchases' | 'sales' | 'inventory' | 'calculator' | 'settings';

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
      }`}
  >
    {icon}
    <span className="ml-3">{label}</span>
  </button>
);

// 메인 앱 컴포넌트 (인증된 사용자용)
const MainApp: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ defaultPackagingCostKrw: 1000, defaultShippingCostKrw: 3000 });
  const [activeView, setActiveView] = useState<View>('dashboard');

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, salesData, purchasesData, settingsData] = await Promise.all([
          getProducts(),
          getSales(),
          getPurchases(),
          getSettings()
        ]);
        
        setProducts(productsData);
        setSales(salesData);
        setPurchases(purchasesData);
        setSettings(settingsData);
      } catch (error) {
        console.error('데이터 로딩 실패:', error);
      }
    };

    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const handleAddProduct = async (product: Product) => {
    try {
      const newProduct = await addProduct(product);
      setProducts(prev => [...prev, newProduct]);
    } catch (error) {
      console.error('상품 추가 실패:', error);
      alert('상품 추가에 실패했습니다.');
    }
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    try {
      await updateProduct(updatedProduct);
      setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    } catch (error) {
      console.error('상품 수정 실패:', error);
      alert('상품 수정에 실패했습니다.');
    }
  };

  const handleUpdateProductOption = async (productId: string, optionId: string, updates: Partial<ProductOption>) => {
    try {
      await updateProductOption(productId, optionId, updates);
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
    } catch (error) {
      console.error('상품 옵션 수정 실패:', error);
      alert('상품 옵션 수정에 실패했습니다.');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (error) {
      console.error('상품 삭제 실패:', error);
      alert('상품 삭제에 실패했습니다.');
    }
  };

  const handleAddPurchase = async (purchase: Omit<Purchase, 'id'>) => {
    try {
      await addPurchase(purchase);
      // 데이터 새로고침
      const [productsData, purchasesData] = await Promise.all([
        getProducts(),
        getPurchases()
      ]);
      setProducts(productsData);
      setPurchases(purchasesData);
    } catch (error) {
      console.error('매입 추가 실패:', error);
      alert('매입 추가에 실패했습니다.');
    }
  };

  const handleAddSale = async (sale: Omit<Sale, 'id'>) => {
    try {
      await addSale(sale);
      // 데이터 새로고침
      const [productsData, salesData] = await Promise.all([
        getProducts(),
        getSales()
      ]);
      setProducts(productsData);
      setSales(salesData);
    } catch (error) {
      console.error('매출 추가 실패:', error);
      alert('매출 추가에 실패했습니다.');
    }
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    try {
      await updateSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('설정 업데이트 실패:', error);
      alert('설정 업데이트에 실패했습니다.');
    }
  };

  // 완전 초기화 (모든 데이터를 0으로) - Supabase에서는 실제 DB 삭제
  const handleCompleteReset = async () => {
    if (window.confirm("정말로 모든 데이터를 완전히 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다!\n- 모든 상품 데이터 삭제\n- 모든 매입 내역 삭제\n- 모든 매출 내역 삭제\n- 재고 현황 초기화\n\n데이터베이스에서 완전히 삭제됩니다.")) {
      try {
        await deleteAllData();
        // 데이터 새로고침
        const [productsData, salesData, purchasesData, settingsData] = await Promise.all([
          getProducts(),
          getSales(),
          getPurchases(),
          getSettings()
        ]);
        
        setProducts(productsData);
        setSales(salesData);
        setPurchases(purchasesData);
        setSettings(settingsData);
        
        alert("✅ 모든 데이터가 성공적으로 삭제되었습니다.");
      } catch (error) {
        console.error('데이터 삭제 실패:', error);
        alert('데이터 삭제에 실패했습니다.');
      }
    }
  };

  // 샘플 데이터로 초기화 - Supabase에서는 실제 샘플 데이터 생성
  const handleLoadSampleData = async () => {
    if (window.confirm("샘플 데이터를 생성하시겠습니까?\n\n📦 생성될 데이터:\n- 샘플 상품 2개 (면 셔츠, 청바지)\n- 샘플 매입 내역 1건\n- 샘플 매출 내역 5건\n\n기존 데이터에 추가됩니다.")) {
      try {
        await createSampleData();
        // 데이터 새로고침
        const [productsData, salesData, purchasesData] = await Promise.all([
          getProducts(),
          getSales(),
          getPurchases()
        ]);
        
        setProducts(productsData);
        setSales(salesData);
        setPurchases(purchasesData);
        
        alert("✅ 샘플 데이터가 성공적으로 생성되었습니다!\n\n대시보드에서 확인해보세요.");
      } catch (error) {
        console.error('샘플 데이터 생성 실패:', error);
        alert('샘플 데이터 생성에 실패했습니다: ' + error.message);
      }
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
    const LoadingSpinner = () => (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
        </div>
      </div>
    );

    return (
      <Suspense fallback={<LoadingSpinner />}>
        {(() => {
          switch (activeView) {
            case 'dashboard':
              return <Dashboard products={products} sales={sales} purchases={purchases} />;
            case 'products':
              return <Products products={products} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} />;
            case 'purchases':
              return <Purchases purchases={purchases} products={products} onAddPurchase={handleAddPurchase} />;
            case 'sales':
              return <Sales sales={sales} products={products} settings={settings} onAddSale={handleAddSale} />;
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
        })()}
      </Suspense>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white flex flex-col shadow-lg">
        <div className="flex items-center justify-center h-20 border-b">
          <h1 className="text-2xl font-bold text-blue-600">Seller Roo</h1>
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
          <div className="mt-4">
            <UserProfile />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {renderContent()}
      </main>
    </div>
  );
};

// 루트 App 컴포넌트 (인증 상태에 따라 Login 또는 MainApp 렌더링)
const App: React.FC = () => {
  console.log('App 컴포넌트 렌더링 시작');
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

const AppContent: React.FC = () => {
  console.log('AppContent 컴포넌트 렌더링 시작');
  
  try {
    const { currentUser, loading } = useAuth();
    console.log('Auth 상태:', JSON.stringify({ 
      currentUser: !!currentUser, 
      loading,
      timestamp: new Date().toLocaleTimeString()
    }));

    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-white text-2xl font-bold">S</span>
            </div>
            <h1 className="text-2xl font-bold text-blue-600 mb-4">Seller Roo</h1>
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
            <p className="text-gray-600">시스템을 준비하고 있습니다...</p>
          </div>
        </div>
      );
    }

    return currentUser ? <MainApp /> : <Login />;
  } catch (error) {
    console.error('AppContent 렌더링 오류:', error);
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">오류가 발생했습니다</h2>
          <p className="text-gray-700 mb-4">앱을 로드하는 중 문제가 발생했습니다.</p>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
            {error instanceof Error ? error.message : '알 수 없는 오류'}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            페이지 새로고침
          </button>
        </div>
      </div>
    );
  }
};

export default App;