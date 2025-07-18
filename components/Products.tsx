
import * as React from 'react';
import { useState, useMemo } from 'react';
import { Product } from '../types';
import Card from './ui/Card';
import Modal from './ui/Modal';
import { EditIcon, DeleteIcon, PlusIcon } from './icons/Icons';
import ProductForm from './forms/ProductForm';

interface ProductsProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
}

const Products: React.FC<ProductsProps> = ({ products, onAddProduct, onUpdateProduct, onDeleteProduct }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'value'>('name');

  // 상품 데이터 계산
  const productData = useMemo(() => {
    let filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'stock':
          const aStock = a.options.reduce((sum, opt) => sum + opt.stock, 0);
          const bStock = b.options.reduce((sum, opt) => sum + opt.stock, 0);
          return bStock - aStock;
        case 'value':
          const aValue = a.options.reduce((sum, opt) => sum + (opt.stock * opt.costOfGoods), 0);
          const bValue = b.options.reduce((sum, opt) => sum + (opt.stock * opt.costOfGoods), 0);
          return bValue - aValue;
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, searchTerm, sortBy]);

  // 통계 계산
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalOptions = products.reduce((sum, product) => sum + product.options.length, 0);
    const totalStock = products.reduce((sum, product) => 
      sum + product.options.reduce((optSum, opt) => optSum + opt.stock, 0), 0);
    const totalValue = products.reduce((sum, product) => 
      sum + product.options.reduce((optSum, opt) => optSum + (opt.stock * opt.costOfGoods), 0), 0);
    const lowStockProducts = products.filter(product => 
      product.options.some(opt => opt.stock <= 10)).length;

    return { totalProducts, totalOptions, totalStock, totalValue, lowStockProducts };
  }, [products]);

  const handleOpenModal = (product: Product | null) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSaveProduct = (product: Product) => {
    if (editingProduct) {
      onUpdateProduct(product);
    } else {
      onAddProduct(product);
    }
    handleCloseModal();
  };

  const handleDelete = (productId: string) => {
    if (window.confirm("정말로 이 상품을 삭제하시겠습니까? 관련된 모든 데이터가 영향을 받을 수 있습니다.")) {
      onDeleteProduct(productId);
    }
  };

  const formatCurrency = (value: number) => `₩${Math.round(value).toLocaleString()}`;

  const getStockStatus = (stock: number) => {
    if (stock <= 0) return { color: 'text-red-600', bg: 'bg-red-100', label: '품절' };
    if (stock <= 5) return { color: 'text-red-600', bg: 'bg-red-100', label: '긴급' };
    if (stock <= 10) return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: '부족' };
    return { color: 'text-green-600', bg: 'bg-green-100', label: '양호' };
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 헤더 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                🛍️
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">상품 관리</h1>
                <p className="text-slate-600 mt-1">상품 등록 및 정보 관리</p>
              </div>
            </div>
            <button
              onClick={() => handleOpenModal(null)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              새 상품 등록
            </button>
          </div>
        </div>

        {/* 통계 대시보드 */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">총 상품 수</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalProducts}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-lg">🛍️</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">총 옵션 수</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalOptions}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 text-lg">🏷️</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">총 재고량</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalStock.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 text-lg">📦</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">재고 가치</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.totalValue)}</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 text-lg">💰</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">재고 부족</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.lowStockProducts}</p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 text-lg">⚠️</span>
              </div>
            </div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="상품명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name">상품명순</option>
                <option value="stock">재고량순</option>
                <option value="value">가치순</option>
              </select>
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  그리드
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  테이블
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 상품 목록 */}
        {productData.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🛍️</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">등록된 상품이 없습니다</h3>
            <p className="text-slate-600 mb-6">첫 번째 상품을 등록해보세요</p>
            <button
              onClick={() => handleOpenModal(null)}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              상품 등록하기
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* 그리드 뷰 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {productData.map(product => {
              const totalStock = product.options.reduce((sum, opt) => sum + opt.stock, 0);
              const totalValue = product.options.reduce((sum, opt) => sum + (opt.stock * opt.costOfGoods), 0);
              const stockStatus = getStockStatus(totalStock);

              return (
                <div key={product.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-square relative overflow-hidden">
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                        {stockStatus.label}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2">{product.name}</h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">옵션 수</span>
                        <span className="font-medium">{product.options.length}개</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">총 재고</span>
                        <span className="font-medium">{totalStock.toLocaleString()}개</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">재고 가치</span>
                        <span className="font-medium text-blue-600">{formatCurrency(totalValue)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <DeleteIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 테이블 뷰 */
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">상품</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">옵션</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">매입 원가</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">권장 판매가</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">재고</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">관리</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {productData.map(product => (
                    <React.Fragment key={product.id}>
                      {product.options.map((option, index) => (
                        <tr key={option.id} className="hover:bg-slate-50 transition-colors">
                          {index === 0 && (
                            <td className="px-6 py-4 whitespace-nowrap align-top" rowSpan={product.options.length}>
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-12 w-12">
                                  <img className="h-12 w-12 rounded-lg object-cover border border-slate-200" src={product.imageUrl} alt={product.name} />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-slate-900">{product.name}</div>
                                </div>
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{option.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatCurrency(option.costOfGoods)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {option.recommendedPrice ? (
                              <div className="flex flex-col">
                                <span className="text-blue-600 font-semibold">{formatCurrency(option.recommendedPrice)}</span>
                                <span className="text-xs text-slate-400">마진계산기 설정</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">미설정</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center">
                              <span className={`font-bold ${option.stock <= 10 ? 'text-red-600' : 'text-slate-900'}`}>
                                {option.stock.toLocaleString()}
                              </span>
                              <span className="text-slate-500 ml-1">개</span>
                            </div>
                          </td>
                          {index === 0 && (
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top" rowSpan={product.options.length}>
                              <div className="flex justify-end items-start space-x-2">
                                <button 
                                  onClick={() => handleOpenModal(product)} 
                                  className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50"
                                >
                                  <EditIcon />
                                </button>
                                <button 
                                  onClick={() => handleDelete(product.id)} 
                                  className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50"
                                >
                                  <DeleteIcon />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingProduct ? "상품 수정" : "새 상품 등록"}>
          <ProductForm
            productToEdit={editingProduct}
            onSave={handleSaveProduct}
            onCancel={handleCloseModal}
          />
        </Modal>
      </div>
    </div>
  );
};

export default Products;
