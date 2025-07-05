import React from 'react';
import { Camera, BarChart3, ShoppingCart, Book, User } from 'lucide-react';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  cartCount: number;
  openCart: () => void;
}

const BottomNavigation: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  cartCount,
  openCart,
}) => (
  <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t">
    <div className="flex">
      <button
        onClick={() => setActiveTab('analyze')}
        className={`flex-1 py-3 px-2 flex flex-col items-center justify-center ${
          activeTab === 'analyze' ? 'text-green-600 bg-green-50' : 'text-gray-600'
        }`}
      >
        <Camera className="w-5 h-5 mb-1" />
        <span className="text-xs">Analyser</span>
      </button>
      <button
        onClick={() => setActiveTab('dashboard')}
        className={`flex-1 py-3 px-2 flex flex-col items-center justify-center ${
          activeTab === 'dashboard' ? 'text-green-600 bg-green-50' : 'text-gray-600'
        }`}
      >
        <BarChart3 className="w-5 h-5 mb-1" />
        <span className="text-xs">Tableau</span>
      </button>
      <button
        onClick={openCart}
        className={`flex-1 py-3 px-2 flex flex-col items-center justify-center relative ${
          activeTab === 'intrants' ? 'text-green-600 bg-green-50' : 'text-gray-600'
        }`}
      >
        <ShoppingCart className="w-5 h-5 mb-1" />
        <span className="text-xs">Intrants</span>
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {cartCount}
          </span>
        )}
      </button>
      <button
        onClick={() => setActiveTab('knowledge')}
        className={`flex-1 py-3 px-2 flex flex-col items-center justify-center ${
          activeTab === 'knowledge' ? 'text-green-600 bg-green-50' : 'text-gray-600'
        }`}
      >
        <Book className="w-5 h-5 mb-1" />
        <span className="text-xs">Connaissances</span>
      </button>
      <button
        onClick={() => setActiveTab('profile')}
        className={`flex-1 py-3 px-2 flex flex-col items-center justify-center ${
          activeTab === 'profile' ? 'text-green-600 bg-green-50' : 'text-gray-600'
        }`}
      >
        <User className="w-5 h-5 mb-1" />
        <span className="text-xs">Profil</span>
      </button>
    </div>
  </div>
);

export default BottomNavigation;
