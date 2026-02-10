'use client';

import { toast } from 'sonner';

/**
 * Message utility compatible with antd/message API.
 * Supports: message.success(msg), message.success(msg, duration)
 * Duration is in seconds (matching antd API), converted to milliseconds for sonner.
 */
const withDuration = (
  fn: typeof toast.success,
  msg: string,
  duration?: number,
) => {
  if (duration !== undefined) {
    return fn(msg, { duration: duration * 1000 });
  }
  return fn(msg);
};

export const message = {
  success: (msg: string, duration?: number) => withDuration(toast.success, msg, duration),
  error: (msg: string, duration?: number) => withDuration(toast.error, msg, duration),
  warning: (msg: string, duration?: number) => withDuration(toast.warning, msg, duration),
  info: (msg: string, duration?: number) => withDuration(toast.info, msg, duration),
};

// Also export as showMessage for alternative naming
export const showMessage = message;
