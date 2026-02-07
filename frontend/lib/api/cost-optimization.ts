/**
 * Cost Optimization API Client
 *
 * API client for AI cost optimization operations.
 *
 * @module frontend/lib/api/cost-optimization
 * @story 7-4
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface CostMetrics {
  totalCost: number;
  averageCostPerOrganization: number;
  topCostOrganizations: Array<{
    organizationId: string;
    organizationName: string;
    cost: number;
    count: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface OrganizationCostDetails {
  organizationId: string;
  organizationName: string;
  totalCost: number;
  costBreakdown: Array<{
    taskType: string;
    cost: number;
    count: number;
    percentage: number;
  }>;
  isExceeded: boolean;
  threshold: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface CostTrend {
  date: string;
  cost: number;
  count: number;
}

export interface CostTrendsResponse {
  trends: CostTrend[];
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface OptimizationSuggestion {
  organizationId: string;
  organizationName: string;
  currentCost: number;
  estimatedCostAfterOptimization: number;
  potentialSavings: number;
  savingsPercentage: number;
  suggestions: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface BatchOptimizeResult {
  success: number;
  failed: number;
  results: Array<{
    organizationId: string;
    organizationName: string;
    status: 'success' | 'failed';
    message: string;
  }>;
}

/**
 * Get cost metrics overview
 */
export async function getCostMetrics(token: string): Promise<CostMetrics> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/cost-optimization/metrics`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch cost metrics: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get organization cost details
 */
export async function getOrganizationCost(
  token: string,
  organizationId: string,
): Promise<OrganizationCostDetails> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/admin/cost-optimization/organizations/${organizationId}/cost`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch organization cost: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get cost trends
 */
export async function getCostTrends(
  token: string,
  days: number = 30,
): Promise<CostTrendsResponse> {
  const params = new URLSearchParams({ days: days.toString() });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/admin/cost-optimization/trends?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch cost trends: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get optimization suggestions
 */
export async function getOptimizationSuggestions(
  token: string,
  organizationId?: string,
): Promise<OptimizationSuggestion[]> {
  const params = new URLSearchParams();
  if (organizationId) {
    params.append('organizationId', organizationId);
  }

  const url = `${API_BASE_URL}/api/v1/admin/cost-optimization/suggestions${params.toString() ? `?${params.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch optimization suggestions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Export cost report
 */
export async function exportCostReport(
  token: string,
  params: {
    format?: 'csv' | 'excel';
    startDate?: string;
    endDate?: string;
    organizationId?: string;
  } = {},
): Promise<Blob> {
  const queryParams = new URLSearchParams();
  if (params.format) queryParams.append('format', params.format);
  if (params.startDate) queryParams.append('startDate', params.startDate);
  if (params.endDate) queryParams.append('endDate', params.endDate);
  if (params.organizationId) queryParams.append('organizationId', params.organizationId);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/admin/cost-optimization/export?${queryParams.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to export cost report: ${response.statusText}`);
  }

  return response.blob();
}

/**
 * Batch optimize organizations
 */
export async function batchOptimize(
  token: string,
  dto: {
    organizationIds: string[];
    action: 'switch_model' | 'enable_caching' | 'optimize_prompts';
    notes?: string;
  },
): Promise<BatchOptimizeResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/admin/cost-optimization/batch-optimize`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to batch optimize: ${response.statusText}`);
  }

  return response.json();
}
