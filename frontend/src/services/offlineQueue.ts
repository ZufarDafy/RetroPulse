import type { Order, CreateOrderPayload } from '../types';

const STORAGE_KEY = 'restopulse_offline_orders_v1';

export interface QueuedOfflineItem {
  order: Order;
  payload: CreateOrderPayload;
  queuedAt: string;
}

export function getOfflineQueue(): QueuedOfflineItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function enqueueOfflineOrder(order: Order, payload: CreateOrderPayload): void {
  const current = getOfflineQueue();
  // Prevent duplicate insertion in queue
  const exists = current.some((q) => q.payload.idempotency_key === payload.idempotency_key);
  if (!exists) {
    current.push({
      order: {
        ...order,
        sync_status: 'QUEUED_OFFLINE',
      },
      payload,
      queuedAt: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }
}

export function removeOfflineOrder(idempotencyKey: string): void {
  const current = getOfflineQueue();
  const filtered = current.filter((q) => q.payload.idempotency_key !== idempotencyKey);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}
