export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed';

export interface Shop {
  id: number;
  name: string;
  logo_url: string | null;
  description: string;
  location: string;
  category: string;
  is_active: boolean;
  created_at: string;
  owner_id: string | null;
  rating?: number;
}

export interface MenuItem {
  id: number;
  shop_id: number;
  name: string;
  price: number;
  image_url: string;
  is_available: boolean;
  created_at: string;
  // Note: category and description were not in the user's CREATE TABLE for menu_items
  // but were used in the app logic. Keeping them as optional for now.
  category?: string;
  description?: string;
  stock_quantity?: number;
}

export interface Order {
  id: number;
  shop_id: number;
  user_id: string;
  product_name: string;
  total_price: number;
  status: OrderStatus;
  created_at: string;
  is_returning?: boolean;
}
