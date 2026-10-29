import type {
  MenuItem,
  Order,
  CreateOrderPayload,
  ChaosConfig,
  DiagnosticLog,
  LogCategory,
  KDSStatus,
} from '../types';

const API_BASE = '/api/v1';

// In-memory chaos state accessible to interceptor
let clientChaosConfig: ChaosConfig = {
  wifi_offline: false,
  bad_network_latency_ms: 0,
  printer_status: 'CONNECTED',
  db_lock_simulated: false,
};

export function setClientChaosConfig(config: ChaosConfig) {
  clientChaosConfig = { ...config };
}

export function getClientChaosConfig(): ChaosConfig {
  return clientChaosConfig;
}

// Client-side interceptor that enforces offline simulation & latency
async function interceptRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  // 1. Simulate WiFi Drop
  if (clientChaosConfig.wifi_offline) {
    // Artificial 120ms before dropping
    await new Promise((res) => setTimeout(res, 120));
    throw new Error('TypeError: Failed to fetch (Restaurant WiFi Drop Simulated: Device offline)');
  }

  // 2. Client latency if needed (backend also enforces latency)
  return requestFn();
}

export const api = {
  async getMenu(): Promise<MenuItem[]> {
    return interceptRequest(async () => {
      const res = await fetch(`${API_BASE}/menu`);
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      const json = await res.json();
      return json.data;
    });
  },

  async createOrder(payload: CreateOrderPayload, idempotencyKey: string): Promise<{ data: Order; idempotent_replay?: boolean }> {
    return interceptRequest(async () => {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      return {
        data: json.data,
        idempotent_replay: json.idempotent_replay,
      };
    });
  },

  async batchSyncOrders(orders: CreateOrderPayload[]): Promise<{ synced_count: number; duplicates_skipped: number; orders: Order[] }> {
    return interceptRequest(async () => {
      const res = await fetch(`${API_BASE}/orders/batch-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Batch sync failed: ${res.status}`);
      return json;
    });
  },

  async getOrders(status?: string): Promise<Order[]> {
    return interceptRequest(async () => {
      const url = status && status !== 'ALL' ? `${API_BASE}/orders?status=${status}` : `${API_BASE}/orders`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
      const json = await res.json();
      return json.data || [];
    });
  },

  async updateKDSStatus(orderId: string, status: KDSStatus): Promise<Order> {
    return interceptRequest(async () => {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update KDS status');
      return json.data;
    });
  },

  async reprintReceipt(orderId: string): Promise<Order> {
    return interceptRequest(async () => {
      const res = await fetch(`${API_BASE}/orders/${orderId}/reprint`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Reprint failed');
      return json.data;
    });
  },

  async getChaosConfig(): Promise<ChaosConfig> {
    const res = await fetch(`${API_BASE}/chaos/config`);
    if (!res.ok) throw new Error('Failed to fetch chaos config');
    const json = await res.json();
    setClientChaosConfig(json.data);
    return json.data;
  },

  async updateChaosConfig(config: Partial<ChaosConfig>): Promise<ChaosConfig> {
    const res = await fetch(`${API_BASE}/chaos/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const json = await res.json();
    if (!res.ok) throw new Error('Failed to update chaos config');
    setClientChaosConfig(json.data);
    return json.data;
  },

  async getLogs(category?: LogCategory | 'ALL'): Promise<DiagnosticLog[]> {
    const url = category && category !== 'ALL' ? `${API_BASE}/logs?category=${category}` : `${API_BASE}/logs`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch logs');
    const json = await res.json();
    return json.data || [];
  },

  async sendLog(log: Omit<DiagnosticLog, 'id' | 'timestamp'>): Promise<DiagnosticLog> {
    try {
      const res = await fetch(`${API_BASE}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
      const json = await res.json();
      return json.data;
    } catch {
      // Fallback: return mock object if server cannot be reached
      return {
        id: `local-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...log,
      };
    }
  },

  async clearLogs(): Promise<void> {
    const res = await fetch(`${API_BASE}/logs`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear logs');
  },
};
