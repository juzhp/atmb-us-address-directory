'use client';

import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useState } from 'react';

import { ExpandableText } from './ExpandableText';

export interface BlacklistReasonListItem {
  id: number;
  reason: string;
  sourceUrl: string | null;
  approvedAt: string;
}

const VISIBLE_COUNT = 2;

// 同一地址的问题反馈默认只展示前两条，其余折叠，避免条数多时把列表撑得太高
export function BlacklistReasonList({ reasons }: { reasons: BlacklistReasonListItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = reasons.length - VISIBLE_COUNT;
  const visible = expanded || hiddenCount <= 0 ? reasons : reasons.slice(0, VISIBLE_COUNT);

  return (
    <div className="blacklist-reason-list">
      <ol className="blacklist-reasons">
        {visible.map((item) => (
          <li key={item.id}>
            <ExpandableText text={item.reason} />
            <div className="blacklist-reason-meta">
              <span>收录于 {item.approvedAt}</span>
              {item.sourceUrl ? (
                <a href={item.sourceUrl} rel="nofollow noreferrer noopener" target="_blank">
                  <ExternalLink size={14} aria-hidden="true" />
                  来源链接
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {hiddenCount > 0 ? (
        <button className="blacklist-reasons-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? '收起' : `展开其余 ${hiddenCount} 条反馈`}
          {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
      ) : null}
    </div>
  );
}
