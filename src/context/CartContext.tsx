import React, { createContext, useState, ReactNode } from 'react';
import { CartItem, Product } from '../types';

interface CartContextValue {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
}

export const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: Product, quantity = 1) => {
    const item: CartItem = {
      id: product.product_id,
      product,
      quantity,
      totalPrice: product.unit_price * quantity,
    };
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].quantity += quantity;
        updated[idx].totalPrice =
          updated[idx].product.unit_price * updated[idx].quantity;
        return updated;
      }
      return [...prev, item];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev.map(item =>
        item.id === productId
          ? {
              ...item,
              quantity: Math.max(1, item.quantity + delta),
              totalPrice:
                item.product.unit_price * Math.max(1, item.quantity + delta),
            }
          : item
      )
    );
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};
