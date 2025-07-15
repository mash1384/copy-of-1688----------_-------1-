
import * as React from 'react';
import { useState } from 'react';
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


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">상품 관리</h1>
        <button
          onClick={() => handleOpenModal(null)}
          className="inline-flex items-center justify-center bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 text-sm whitespace-nowrap"
        >
          <PlusIcon className="w-4 h-4 mr-1.5" />
          새 상품 등록
        </button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">옵션</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">매입 원가</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">권장 판매가</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">재고</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map(product => (
                <React.Fragment key={product.id}>
                  {product.options.map((option, index) => (
                    <tr key={option.id}>
                      {index === 0 && (
                        <td className="px-6 py-4 whitespace-nowrap align-top" rowSpan={product.options.length}>
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <img className="h-10 w-10 rounded-lg object-cover" src={product.imageUrl} alt={product.name} />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{option.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₩{Math.round(option.costOfGoods).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {option.recommendedPrice ? (
                          <div className="flex flex-col">
                            <span className="text-blue-600 font-semibold">₩{option.recommendedPrice.toLocaleString()}</span>
                            <span className="text-xs text-gray-400">마진계산기 설정</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">미설정</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span className={`${option.stock <= 10 ? 'text-red-500' : 'text-gray-900'}`}>
                          {option.stock}
                        </span>
                      </td>
                      {index === 0 && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top" rowSpan={product.options.length}>
                          <div className="flex justify-end items-start space-x-2">
                            <button onClick={() => handleOpenModal(product)} className="text-blue-600 hover:text-blue-900"><EditIcon /></button>
                            <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900"><DeleteIcon /></button>
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
      </Card>
      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingProduct ? "상품 수정" : "새 상품 등록"}>
        <ProductForm
          productToEdit={editingProduct}
          onSave={handleSaveProduct}
          onCancel={handleCloseModal}
        />
      </Modal>
    </div>
  );
};

export default Products;
