export interface Product {
  product_id: string;
  name: string;
  unit_price: number;
  category: string;
  recommendation_tag?: string;
  target_pests?: string[];
  latitude?: number;
  longitude?: number;
  distance?: string;
  isRecommended?: boolean;
  [key: string]: any;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  totalPrice: number;
}
