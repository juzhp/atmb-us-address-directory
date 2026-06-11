'use client';

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface AdminToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

export function useAdminToasts() {
  const [toasts, setToasts] = useState<AdminToastItem[]>([]);

  function showToast(message: string, tone: ToastTone = 'info') {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, tone, message }]);
  }

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  return { toasts, showToast, dismissToast };
}

export function AdminToastStack({
  toasts,
  onDismiss,
}: {
  toasts: AdminToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="admin-toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <AdminToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function AdminToast({
  toast,
  onDismiss,
}: {
  toast: AdminToastItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 3000);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const Icon = toast.tone === 'success'
    ? CheckCircle2
    : toast.tone === 'error'
      ? XCircle
      : Info;

  return (
    <div className={`admin-toast ${toast.tone}`}>
      <Icon size={18} aria-hidden="true" />
      <span>{toast.message}</span>
      <button type="button" aria-label="关闭提示" onClick={() => onDismiss(toast.id)}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
