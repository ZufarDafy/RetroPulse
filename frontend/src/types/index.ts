export type Language = 'id' | 'en' | 'zh';

export type KDSStatus = 'PENDING' | 'PREPARING' | 'SERVED' | 'CANCELLED';
export type PrintStatus = 'PRINTED' | 'QUEUED_FOR_REPRINT' | 'FAILED';
export type SyncStatus = 'SYNCED' | 'QUEUED_OFFLINE';

export interface MenuItem {
  id: string;
  name: Record<Language, string>;
  description: Record<Language, string>;
  category: Record<Language, string>;
  price: number;
  image_url: string;
  badge?: Record<Language, string>;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  subtotal: number;
}

export interface Order {
  id: string;
  idempotency_key: string;
  order_number: string;
  table_number: string;
  customer_name: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  kds_status: KDSStatus;
  print_status: PrintStatus;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  isOptimistic?: boolean;
}

export interface CreateOrderPayload {
  idempotency_key: string;
  table_number: string;
  customer_name?: string;
  payment_method?: string;
  items: {
    menu_item_id: string;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
  }[];
  client_created_at?: string;
}

export interface ChaosConfig {
  wifi_offline: boolean;
  bad_network_latency_ms: number;
  printer_status: 'CONNECTED' | 'PAPER_OUT' | 'DISCONNECTED';
  db_lock_simulated: boolean;
}

export type LogCategory = 'NETWORK' | 'HARDWARE' | 'UX_BEHAVIOR' | 'BACKEND';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface DiagnosticLog {
  id: string;
  timestamp: string;
  category: LogCategory;
  level: LogLevel;
  root_cause: string;
  latency_ms: number;
  message: string;
  metadata?: string;
}
