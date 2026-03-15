export type Role = 'admin' | 'user';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  role: Role;
}

export interface UserInfo {
  id: number;
  username: string;
  role: Role;
  status: string;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  duration_minutes: number;
  price: string;
  enabled: boolean;
  group_tag?: string | null;
  available_stock: number;
}

export interface Wallet {
  balance: string;
}

export interface WalletTransaction {
  id: number;
  user_id: number;
  type: string;
  amount: string;
  balance_after: string;
  remark?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  order_no: string;
  user_id: number;
  product_id: number;
  resource_id: number;
  amount: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  start_at: string;
  expire_at: string;
  created_at: string;
  resource_name?: string | null;
}

export interface ReleaseOrderResult {
  order_id: number;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  refund_ratio: string;
  refund_amount: string;
  balance: string;
  released_at: string;
}

export interface Resource {
  id: number;
  name: string;
  host: string;
  port: number;
  protocol: string;
  status: 'IDLE' | 'BUSY' | 'DISABLED';
  enabled: boolean;
  current_user_id?: number | null;
  lease_expire_at?: string | null;
  group_tag?: string | null;
  health_status: string;
}

export interface AdminUser {
  id: number;
  username: string;
  role: Role;
  status: string;
  created_at: string;
  balance: string;
}
