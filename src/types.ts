export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type DeliveryStatus = 'finding_rider' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
export type UserVehicle = 'Road' | 'MTB' | 'E-Bike' | 'Motor';

export interface Shop {
  id: string | number;
  name: string;
  logo_url?: string | null;
  description?: string;
  location?: string;
  city?: string;
  category?: string;
  owner_id: string | null;
  rating?: number;
  cash_trust_enabled?: boolean;
  allow_external_riders?: boolean;
  auto_look_for_rider?: boolean;
  delivery_radius_enabled?: boolean;
  delivery_radius_km?: number;
  lat?: number;
  lng?: number;
  updated_at?: string;
}

export interface RiderProfile {
  id: string;
  name: string;
  full_name: string;
  phone: string;
  is_online: boolean;
  status?: 'online' | 'offline' | 'paused' | 'busy';
  vehicle_type: UserVehicle;
  verification_status: 'verified' | 'pending' | 'rejected';
  rating: number;
  total_earnings: number;
  total_deliveries: number;
  active_points: number;
  photo_url?: string;
  city?: string;
  current_latitude?: number;
  current_longitude?: number;
  updated_at: string;
}

export interface DeliveryOrder {
  id: string;
  customer_name: string;
  restaurant_name?: string;
  shop_id: string | number;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  total_price: number;
  delivery_fee: number;
  delivery_status: DeliveryStatus;
  status: OrderStatus;
  order_type: 'delivery' | 'pickup';
  rider_id?: string | null;
  items?: string[];
  product_name?: string;
  created_at: string;
  updated_at: string;
  distance_km?: number;
  phone?: string;
  merchant_rating?: number;
  merchant_feedback?: string;
  rider?: RiderProfile;
  rider_dist_to_shop?: number;
  price?: number; // legacy compat
}

export interface ShopConnection {
  id: string;
  rider_id: string;
  shop_id: string | number;
  shop_name?: string;
  expires_at: string;
  created_at: string;
}

export interface MenuItem {
  id: number;
  shop_id: number;
  name: string;
  price: number;
  image_url: string;
  is_available: boolean;
  created_at: string;
  category?: string;
  description?: string;
  stock_quantity?: number | null;
}

export interface Order {
  id: string;
  shop_id: number;
  user_id: string;
  product_name: string;
  product_variant?: string;
  total_price: number;
  price?: number; // Database field
  lat?: number;
  lng?: number;
  status: OrderStatus;
  payment_method?: string;
  country?: string;
  created_at: string;
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes?: string;
  acceptance_message?: string;
  is_returning?: boolean;
  accepted_at?: string;
  completed_at?: string;
  estimated_delivery_time?: string;
  items?: (string | { name: string; price: number; quantity: number })[];
  coupon_code?: string;
  discount_amount?: number;
  delivery_fee?: number;
  rider_id?: string;
  restaurant_name?: string;
  delivery_status?:
    | "finding_rider"
    | "accepted"
    | "picked_up"
    | "delivered"
    | "cancelled";
  order_type?: "delivery" | "collection";
  merchant_rating?: number;
  merchant_feedback?: string;
  terminal_masked_card?: string;
  terminal_sync_status?: string;
}

