import * as React from 'react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const UserProfile: React.FC = () => {
  const { currentUser, signOut } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('로그아웃 실패:', error);
      alert('로그아웃에 실패했습니다.');
    }
  };

  if (!currentUser) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition duration-200"
      >
        <img
          src={currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || '/default-avatar.png'}
          alt={currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '사용자'}
          className="w-8 h-8 rounded-full"
        />
        <div className="text-left">
          <div className="text-sm font-medium text-gray-900">
            {currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '사용자'}
          </div>
          <div className="text-xs text-gray-500">
            {currentUser.email}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isDropdownOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-900">
              {currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '사용자'}
            </div>
            <div className="text-xs text-gray-500">
              {currentUser.email}
            </div>
          </div>
          
          <button
            onClick={() => setIsDropdownOpen(false)}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition duration-200"
          >
            프로필 설정
          </button>
          
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition duration-200"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;