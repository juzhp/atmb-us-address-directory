'use client';

import { ReactNode } from 'react';

interface AdminConfirmDialogProps {
  title: string;
  description: ReactNode;
  // 放在说明段落之外的附加内容（如表格），避免块级元素嵌进 <p>
  content?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isPending?: boolean;
  tone?: 'default' | 'danger';
  size?: 'default' | 'wide';
  onCancel: () => void;
  onConfirm: () => void;
}

export function AdminConfirmDialog({
  title,
  description,
  content,
  confirmText = '确认',
  cancelText = '取消',
  isPending = false,
  tone = 'default',
  size = 'default',
  onCancel,
  onConfirm,
}: AdminConfirmDialogProps) {
  return (
    <div className="admin-modal-backdrop">
      <section
        className={size === 'wide' ? 'admin-confirm-dialog wide' : 'admin-confirm-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
      >
        <div>
          <h2 id="admin-confirm-title">{title}</h2>
          <p>{description}</p>
        </div>
        {content ? <div className="admin-confirm-content">{content}</div> : null}
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
