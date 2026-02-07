/**
 * Feedback API Client
 *
 * API client for push feedback operations.
 *
 * @module frontend/lib/api/feedback
 * @story 7-2
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface PushFeedback {
  id: string;
  pushId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface SubmitFeedbackRequest {
  rating: number;
  comment?: string;
}

export interface UserFeedbackResponse {
  data: PushFeedback | null;
}

/**
 * Submit feedback for a push
 */
export async function submitPushFeedback(
  token: string,
  pushId: string,
  data: SubmitFeedbackRequest,
): Promise<PushFeedback> {
  const response = await fetch(`${API_BASE_URL}/api/v1/radar/pushes/${pushId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error('您已经对该推送提交过反馈');
    }
    if (response.status === 404) {
      throw new Error('推送不存在');
    }
    throw new Error(`Failed to submit feedback: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get current user's feedback for a push
 */
export async function getUserFeedback(
  token: string,
  pushId: string,
): Promise<PushFeedback | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/radar/pushes/${pushId}/feedback`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get user feedback: ${response.statusText}`);
  }

  const result: UserFeedbackResponse = await response.json();
  return result.data;
}
