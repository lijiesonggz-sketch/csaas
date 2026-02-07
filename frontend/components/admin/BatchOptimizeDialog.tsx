/**
 * BatchOptimizeDialog Component
 *
 * Dialog for batch optimization of organizations.
 *
 * @module frontend/components/admin
 * @story 7-4
 */

'use client';

import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface BatchOptimizeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrganizations: Array<{
    id: string;
    name: string;
  }>;
  onConfirm: (action: string, notes: string) => Promise<void>;
}

export function BatchOptimizeDialog({
  isOpen,
  onClose,
  selectedOrganizations,
  onConfirm,
}: BatchOptimizeDialogProps) {
  const [action, setAction] = useState<'switch_model' | 'enable_caching' | 'optimize_prompts'>(
    'switch_model',
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const actionLabels = {
    switch_model: '切换模型',
    enable_caching: '启用缓存',
    optimize_prompts: '优化提示词',
  };

  const actionDescriptions = {
    switch_model: '将AI模型切换为更经济的版本（如从qwen-max切换到qwen-plus）',
    enable_caching: '启用AI响应缓存以减少重复调用',
    optimize_prompts: '优化提示词以减少token使用量',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onConfirm(action, notes);
      setNotes('');
      onClose();
    } catch (error) {
      console.error('Batch optimize failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Dialog */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">批量优化</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Selected organizations */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  已选择 {selectedOrganizations.length} 个客户
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {selectedOrganizations.map((org) => (
                    <div
                      key={org.id}
                      className="text-sm text-gray-600 py-1 px-2 hover:bg-gray-50 rounded"
                    >
                      {org.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  优化操作 <span className="text-red-500">*</span>
                </label>
                <select
                  value={action}
                  onChange={(e) =>
                    setAction(e.target.value as 'switch_model' | 'enable_caching' | 'optimize_prompts')
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">{actionDescriptions[action]}</p>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入优化备注（可选）"
                />
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>注意：</strong>
                  批量优化操作将立即应用到所选的所有客户。请确认操作无误后再提交。
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading || selectedOrganizations.length === 0}
                className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '处理中...' : '确认优化'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
