import * as React from 'react';
import { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import Card from './ui/Card';
import { ResetDataIcon } from './icons/Icons';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onResetAllData: () => void;
  onCompleteReset: () => void;
  onLoadSampleData: () => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings, onResetAllData, onCompleteReset, onLoadSampleData }) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: Number(value) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800">설정</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-700 border-b pb-2">기본 비용 설정</h2>
          <p className="text-sm text-gray-500">
            매출 등록 시 자동으로 적용될 기본 비용을 설정합니다. 각 판매 건마다 개별적으로 수정할 수 있습니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="defaultPackagingCostKrw" className="block text-sm font-medium text-gray-700">기본 포장비 (KRW)</label>
              <input
                type="number"
                id="defaultPackagingCostKrw"
                name="defaultPackagingCostKrw"
                value={formData.defaultPackagingCostKrw}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="defaultShippingCostKrw" className="block text-sm font-medium text-gray-700">기본 국내 배송비 (KRW)</label>
              <input
                type="number"
                id="defaultShippingCostKrw"
                name="defaultShippingCostKrw"
                value={formData.defaultShippingCostKrw}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>
          <div className="flex justify-end items-center">
            {isSaved && <span className="text-green-600 text-sm mr-4">성공적으로 저장되었습니다!</span>}
            <button
              type="submit"
              className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-300"
            >
              설정 저장
            </button>
          </div>
        </form>
      </Card>
      {/* 데이터 관리 섹션 */}
      <Card>
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-blue-600 border-b border-blue-200 pb-2">📊 데이터 관리</h2>
          <p className="text-sm text-gray-600">
            앱의 데이터를 관리하고 초기화할 수 있습니다. 각 옵션의 차이점을 확인하고 신중하게 선택해주세요.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 샘플 데이터 로드 */}
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">📦</span>
                <h3 className="text-lg font-semibold text-green-800">샘플 데이터 로드</h3>
              </div>
              <p className="text-sm text-green-700 mb-4">
                앱 사용법을 익히기 위한 샘플 데이터를 불러옵니다.
              </p>
              <ul className="text-xs text-green-600 mb-4 space-y-1">
                <li>• 샘플 상품 2개 (셔츠, 바지)</li>
                <li>• 샘플 매입 내역 1건</li>
                <li>• 샘플 매출 내역 5건</li>
                <li>• 완전한 비즈니스 시나리오</li>
              </ul>
              <button
                type="button"
                onClick={onLoadSampleData}
                className="w-full bg-green-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-green-700 transition duration-300"
              >
                샘플 데이터 불러오기
              </button>
            </div>

            {/* 완전 초기화 */}
            <div className="bg-red-50 p-6 rounded-lg border border-red-200">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-3">🗑️</span>
                <h3 className="text-lg font-semibold text-red-800">완전 초기화</h3>
              </div>
              <p className="text-sm text-red-700 mb-4">
                모든 데이터를 완전히 삭제하고 빈 상태로 시작합니다.
              </p>
              <ul className="text-xs text-red-600 mb-4 space-y-1">
                <li>• 모든 상품 데이터 삭제</li>
                <li>• 모든 매입 내역 삭제</li>
                <li>• 모든 매출 내역 삭제</li>
                <li>• ⚠️ 되돌릴 수 없음</li>
              </ul>
              <button
                type="button"
                onClick={onCompleteReset}
                className="w-full bg-red-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-red-700 transition duration-300"
              >
                <ResetDataIcon className="inline mr-2" />
                완전 초기화
              </button>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="flex items-start">
              <span className="text-yellow-600 text-xl mr-3">💡</span>
              <div>
                <h4 className="font-semibold text-yellow-800 mb-2">사용 가이드</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• <strong>처음 사용하시는 경우:</strong> "샘플 데이터 불러오기"를 추천합니다</li>
                  <li>• <strong>실제 데이터로 시작하려는 경우:</strong> "완전 초기화" 후 상품부터 등록하세요</li>
                  <li>• <strong>데이터 백업:</strong> 중요한 데이터는 별도로 기록해두시기 바랍니다</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;