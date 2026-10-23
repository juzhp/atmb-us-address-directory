'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// 默认只显示 lines 行，内容超出时才出现"展开 / 收起"按钮
export function ExpandableText({ text, lines = 2, className }: { text: string; lines?: number; className?: string }) {
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const expandedRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = bodyRef.current;
    if (!element) return;

    const check = () => {
      // 展开状态下没有裁剪，测不出是否溢出，保持已有判断
      if (expandedRef.current) return;
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  function toggle() {
    expandedRef.current = !expandedRef.current;
    setExpanded(expandedRef.current);
  }

  return (
    <div className={className ? `expandable-text ${className}` : 'expandable-text'}>
      <p
        ref={bodyRef}
        className={expanded ? 'expandable-text-body expanded' : 'expandable-text-body'}
        style={expanded ? undefined : { WebkitLineClamp: lines }}
      >
        {text}
      </p>
      {overflowing ? (
        <button type="button" aria-expanded={expanded} onClick={toggle}>
          {expanded ? '收起' : '展开'}
          {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
      ) : null}
    </div>
  );
}
