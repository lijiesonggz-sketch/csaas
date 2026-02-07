/**
 * Content Quality API Client
 *
 * API client for content quality management operations.
 *
 * @module frontend/lib/api/content-quality
 * @story 7-2
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface ContentQualityMetrics {
  averageRating: number;
  totalFeedback: number;
  lowRatedPushes: number;
  targetAchievement: number;
  ratingDistribution: Record<number, number>;
}

export interface LowRatedPush {
  pushId: string;
  title: string;
  radarType: 'tech' | 'industry' | 'compliance';
  averageRating: number;
  feedbackCount: number;
  createdAt: string;
}

export interface LowRatedPushesResponse {
  data: LowRatedPush[];
  meta: {
    total: number;
  };
}

export interface PushFeedbackDetail {
  push: {
    id: string;
    title: string;
    summary: string;
    fullContent: string | null;
    radarType: string;
    relevanceScore: number;
    source: string;
  };
  feedback: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    user: {
      id: string;
      name: string;
    };
  }>;
  optimizationSuggestions: string[];
  status: 'pending' | 'optimized' | 'ignored';
}

export interface QualityTrendDataPoint {
  date: string;
  value: number;
  tech?: number;
  industry?: number;
  compliance?: number;
}

export interface QualityTrends {
  averageRatingTrend: QualityTrendDataPoint[];
  lowRatedPushCountTrend: QualityTrendDataPoint[];
}

/**
 * Get content quality metrics
 */
export async function getContentQualityMetrics(token: string): Promise<ContentQualityMetrics> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/content-quality/metrics`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch content quality metrics: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * Get low-rated pushes
 */
export async function getLowRatedPushes(
  token: string,
  options?: {
    limit?: number;
    radarType?: 'tech' | 'industry' | 'compliance';
  },
): Promise<LowRatedPushesResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.radarType) params.append('radarType', options.radarType);

  const url = `${API_BASE_URL}/api/v1/admin/content-quality/low-rated${params.toString() ? `?${params.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch low-rated pushes: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * Get push feedback details
 */
export async function getPushFeedbackDetails(token: string, pushId: string): Promise<PushFeedbackDetail> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/content-quality/pushes/${pushId}/feedback`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch push feedback details: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * Mark push as optimized
 */
export async function markPushAsOptimized(token: string, pushId: string): Promise<{ message: string; status: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/content-quality/pushes/${pushId}/optimize`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to mark push as optimized: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * Mark push as ignored
 */
export async function markPushAsIgnored(token: string, pushId: string): Promise<{ message: string; status: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/content-quality/pushes/${pushId}/ignore`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to mark push as ignored: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * Get quality trends
 */
export async function getQualityTrends(token: string, range: string = '30d'): Promise<QualityTrends> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/content-quality/trends?range=${range}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch quality trends: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || result;
}
