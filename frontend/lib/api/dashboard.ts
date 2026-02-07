/**
 * Dashboard API Client
 *
 * API client for admin dashboard operations.
 *
 * @module frontend/lib/api/dashboard
 * @story 7-1
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface HealthMetrics {
  availability: {
    current: number;
    target: number;
    status: string;
    uptime: number;
    downtime: number;
  };
  pushSuccessRate: {
    current: number;
    target: number;
    status: string;
    totalPushes: number;
    successfulPushes: number;
    failedPushes: number;
  };
  aiCost: {
    today: number;
    thisMonth: number;
    avgPerClient: number;
    target: number;
    status: string;
  };
  customerActivity: {
    totalCustomers: number;
    activeCustomers: number;
    activityRate: number;
    target: number;
    status: string;
  };
  lastUpdated?: string; // ISO timestamp for cache invalidation
}

export interface Alert {
  id: string;
  alertType: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  status: 'unresolved' | 'resolved' | 'ignored';
  metadata?: Record<string, any>;
  occurredAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface AlertsResponse {
  data: Alert[];
  meta: {
    total: number;
    unresolved: number;
    severityCounts: {
      high: number;
      medium: number;
      low: number;
    };
  };
}

export interface TrendData {
  metric: string;
  range: string;
  data: Array<{
    date: string;
    value: number;
  }>;
}

/**
 * Get system health metrics
 */
export async function getHealthMetrics(token: string): Promise<HealthMetrics> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/dashboard/health`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch health metrics: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * Get alerts with filters
 */
export async function getAlerts(
  token: string,
  filters?: {
    status?: 'unresolved' | 'resolved' | 'ignored';
    severity?: 'high' | 'medium' | 'low';
    alertType?: string;
    limit?: number;
    offset?: number;
  },
): Promise<AlertsResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.severity) params.append('severity', filters.severity);
  if (filters?.alertType) params.append('alertType', filters.alertType);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const url = `${API_BASE_URL}/api/v1/admin/dashboard/alerts${params.toString() ? `?${params.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch alerts: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * Resolve an alert
 */
export async function resolveAlert(token: string, alertId: string): Promise<Alert> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/admin/dashboard/alerts/${alertId}/resolve`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to resolve alert: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * Get trend data for a metric
 */
export async function getTrendData(
  token: string,
  metric: 'availability' | 'push_success_rate' | 'ai_cost' | 'customer_activity',
  range: '7d' | '30d' | '90d' = '30d',
): Promise<TrendData> {
  const params = new URLSearchParams({
    metric,
    range,
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/admin/dashboard/trends?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch trend data: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || result;
}
