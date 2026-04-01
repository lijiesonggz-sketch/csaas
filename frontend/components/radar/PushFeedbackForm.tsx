/**
 * PushFeedbackForm Component
 *
 * Allows users to submit ratings and comments for radar pushes.
 * Includes 5-star rating, optional comment, and success state.
 *
 * @module frontend/components/radar
 * @story 7-2
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { submitPushFeedback, getUserFeedback, PushFeedback } from '@/lib/api/feedback'
import { cn } from '@/lib/utils'

interface PushFeedbackFormProps {
  pushId: string
  token: string
  onSubmit?: (rating: number, comment: string) => void
}

export function PushFeedbackForm({ pushId, token, onSubmit }: PushFeedbackFormProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [existingFeedback, setExistingFeedback] = useState<PushFeedback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Check for existing feedback on mount
  useEffect(() => {
    const checkExistingFeedback = async () => {
      try {
        const feedback = await getUserFeedback(token, pushId)
        if (feedback) {
          setExistingFeedback(feedback)
          setSubmitted(true)
        }
      } catch (err) {
        // Silently handle error - user can still submit feedback
      } finally {
        setLoading(false)
      }
    }

    checkExistingFeedback()
  }, [pushId, token])

  const handleSubmit = async () => {
    if (rating === 0) return

    setSubmitting(true)
    setError(null)

    try {
      const feedback = await submitPushFeedback(token, pushId, {
        rating,
        comment: comment.trim() || undefined,
      })

      setExistingFeedback(feedback)
      setSubmitted(true)

      if (onSubmit) {
        onSubmit(rating, comment)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交反馈失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (submitted && existingFeedback) {
    return (
      <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
        <Alert className="rounded-sm border-[#059669] bg-green-50">
          <AlertDescription className="text-[#059669]">
            <p className="text-sm font-medium">
              感谢您的反馈！您已评分: {existingFeedback.rating} 星
            </p>
            {existingFeedback.comment && (
              <p className="mt-1 text-sm">评论: {existingFeedback.comment}</p>
            )}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
      <h4 className="text-sm font-medium text-[#1E3A5F] mb-1">内容评分</h4>
      <p className="text-xs text-[#94A3B8] mb-3">您的反馈帮助我们改进服务</p>

      {/* 5-Star Rating */}
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1 hover:scale-110 transition-transform focus:outline-none"
            aria-label={`${star} 星`}
          >
            <Star
              className={cn(
                'w-6 h-6',
                (hoverRating || rating) >= star ? 'fill-amber-400 text-amber-400' : 'text-[#E2E8F0]'
              )}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-[#94A3B8]">
          {rating > 0 ? `${rating} 星` : '请选择评分'}
        </span>
      </div>

      {/* Comment Textarea */}
      <div className="mb-3">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="可选：请输入您的反馈（如内容质量、相关性等）"
          rows={2}
          maxLength={1000}
          className="rounded-sm border-[#E2E8F0]"
        />
        <p className="mt-1 text-xs text-[#94A3B8] text-right">
          {comment.length}/1000
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive" className="mb-3 rounded-sm">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={rating === 0 || submitting}
        className={cn(
          'rounded-sm',
          rating === 0 || submitting
            ? 'bg-[#94A3B8] hover:bg-[#7a8ba3]'
            : 'bg-[#1E3A5F] hover:bg-[#152a47]'
        )}
      >
        {submitting ? '提交中...' : '提交反馈'}
      </Button>
    </div>
  )
}
