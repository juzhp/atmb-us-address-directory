import Link from 'next/link';
import { X } from 'lucide-react';

export interface ActiveFilterChip {
  key: string;
  label: string;
  value: string;
  removeHref: string;
}

interface ActiveFilterChipsProps {
  chips: ActiveFilterChip[];
  clearAllHref: string;
}

export function ActiveFilterChips({ chips, clearAllHref }: ActiveFilterChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="addresses-active-filters" aria-label="当前筛选条件">
      {chips.map((chip) => (
        <Link
          aria-label={`移除筛选：${chip.label} ${chip.value}`}
          className="addresses-filter-chip"
          href={chip.removeHref}
          key={chip.key}
        >
          <span>{chip.label}</span>
          <strong>{chip.value}</strong>
          <X size={13} aria-hidden="true" />
        </Link>
      ))}
      <Link className="addresses-clear-link" href={clearAllHref}>
        清除全部
      </Link>
    </div>
  );
}
