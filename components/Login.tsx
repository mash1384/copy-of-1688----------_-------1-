import * as React from 'react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (error) {
      console.error('로그인 실패:', error);
      alert('로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* 로고 및 제목 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">B</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">BizManager</h1>
          <p className="text-gray-600">1688 의류 사업자 관리 시스템</p>
        </div>

        {/* 기능 소개 */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">주요 기능</h2>
          <div className="space-y-3">
            <div className="flex items-center text-sm text-gray-600">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
              상품 및 재고 관리
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
              매입/매출 내역 관리
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
              마진 계산 및 수익성 분석
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
              실시간 대시보드
            </div>
          </div>
        </div>

        {/* 구글 로그인 버튼 */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white border-2 border-gray-300 rounded-lg px-6 py-3 flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-700">로그인 중...</span>
            </div>
          ) : (
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-gray-700 font-medium">Google로 로그인</span>
            </div>
          )}
        </button>

        {/* 안내 메시지 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            로그인하면 데이터가 클라우드에 안전하게 저장됩니다
          </p>
        </div>

        {/* 데모 모드 안내 */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <span className="text-yellow-600 text-lg mr-2">💡</span>
            <div>
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">데모 모드</h3>
              <p className="text-xs text-yellow-700">
                현재는 로컬 저장소를 사용합니다. Firebase 설정 후 클라우드 동기화가 가능합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;