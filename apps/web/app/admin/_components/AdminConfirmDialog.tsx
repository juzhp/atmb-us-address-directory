'use client';

import { ReactNode } from 'react';

interface AdminConfirmDialogProps {
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isPending?: boolean;
  tone?: 'default' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
}

export function AdminConfirmDialog({
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  isPending = false,
  tone = 'default',
  onCancel,
  onConfirm,
}: AdminConfirmDialogProps) {
  return (
    <div className="admin-modal-backdrop">
      <section className="admin-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
        <div>
          <h2 id="admin-confirm-title">{title}</h2>
          <p>{description}</p>
        </div>
        <div className="admin-dialog-actions">
          <button disabled={isPending} type="button" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={tone === 'danger' ? 'danger' : 'primary'} disabled={isPending} type="button" onClick={onConfirm}>
            {isPending ? '处理中...' : confirmText}
          </button>
        </div>
      </section>
    </div>
  );
}
