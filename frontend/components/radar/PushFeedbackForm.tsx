/**
 * PushFeedbackForm Component
 *
 * Allows users to submit ratings and comments for radar pushes.
 * Includes 5-star rating, optional comment, and success state.
 *
 * @module frontend/components/radar
 * @story 7-2
 */

'use client';

import React, { useState, useEffect } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';
import { submitPushFeedback, getUserFeedback, PushFeedback } from '@/lib/api/feedback';

interface PushFeedbackFormProps {
  pushId: string;
  token: string;
  onSubmit?: (rating: number, comment: string) => void;
}

export function PushFeedbackForm({ pushId, token, onSubmit }: PushFeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState<PushFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing feedback on mount
  useEffect(() => {
    const checkExistingFeedback = async () => {
      try {
        const feedback = await getUserFeedback(token, pushId);
        if (feedback) {
          setExistingFeedback(feedback);
          setSubmitted(true);
        }
      } catch (err) {
        // Silently handle error - user can still submit feedback
        // Error is not critical to the user experience
      } finally {
        setLoading(false);
      }
    };

    checkExistingFeedback();
  }, [pushId, token]);

  const handleSubmit = async () => {
    if (rating === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const feedback = await submitPushFeedback(token, pushId, {
        rating,
        comment: comment.trim() || undefined,
      });

      setExistingFeedback(feedback);
      setSubmitted(true);

      if (onSubmit) {
        onSubmit(rating, comment);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交反馈失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (submitted && existingFeedback) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200" data-testid="feedback-success-message">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                感谢您的反馈！您已评分: {existingFeedback.rating} 星
              </p>
              {existingFeedback.comment && (
                <p className="mt-1 text-sm text-green-600">
                  评论: {existingFeedback.comment}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200" data-testid="push-feedback-form">
      <h4 className="text-sm font-medium text-gray-900 mb-1">内容评分</h4>
      <p className="text-xs text-gray-500 mb-3">您的反馈帮助我们改进服务</p>

      {/* 5-Star Rating */}
      <div className="flex items-center space-x-1 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1 hover:scale-110 transition-transform focus:outline-none"
            data-testid={`star-rating-${star}`}
            aria-label={`${star} 星`}
          >
            {(hoverRating || rating) >= star ? (
              <StarIcon className="h-6 w-6 text-yellow-400" />
            ) : (
              <StarOutlineIcon className="h-6 w-6 text-gray-300" />
            )}
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-600">
          {rating > 0 ? `${rating} 星` : '请选择评分'}
        </span>
      </div>

      {/* Comment Textarea */}
      <div className="mb-3">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="可选：请输入您的反馈（如内容质量、相关性等）"
          rows={2}
          maxLength={1000}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="feedback-comment"
        />
        <p className="mt-1 text-xs text-gray-500 text-right">
          {comment.length}/1000
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={rating === 0 || submitting}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        data-testid="submit-feedback-button"
      >
        {submitting ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            提交中...
          </span>
        ) : (
          '提交反馈'
        )}
      </button>
    </div>
  );
}
