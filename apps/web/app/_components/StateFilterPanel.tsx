import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import {
  PUBLIC_VISIBLE_STATE_COUNT,
  splitPublicStateLinks,
  type PublicStateLink,
} from '../_lib/public-address-data';

interface StateFilterPanelProps {
  states: PublicStateLink[];
  selectedState: string;
  buildHref: (stateCode: string) => string;
}

const STATE_FILTER_NOTE = '州也是筛选条件，默认展示当前条件下地址最多的州，展开后查看全部州/地区。';

export function StateFilterPanel({ states, selectedState, buildHref }: StateFilterPanelProps) {
  const { visible, hidden } = splitPublicStateLinks(states, selectedState);

  return (
    <div className="addresses-state-filter">
      <div className="addresses-state-head">
        <div>
          <h2>州筛选</h2>
          <p>{STATE_FILTER_NOTE}</p>
        </div>
        {selectedState ? (
          <Link className="addresses-clear-link" href={buildHref('')}>
            清除州筛选
          </Link>
        ) : null}
      </div>
      <div className="addresses-state-grid">
        {visible.map((state) => (
          <StateFilterLink buildHref={buildHref} key={state.code} selectedState={selectedState} state={state} />
        ))}
      </div>
      {hidden.length > 0 ? (
        <details className="addresses-state-details">
          <summary>
            展开全部 {states.length} 个州/地区
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <div className="addresses-state-grid addresses-state-grid-more">
            {hidden.map((state) => (
              <StateFilterLink buildHref={buildHref} key={state.code} selectedState={selectedState} state={state} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function StateFilterPanelSkeleton() {
  return (
    <div className="addresses-state-filter" aria-busy="true">
      <div className="addresses-state-head">
        <div>
          <h2>州筛选</h2>
          <p>{STATE_FILTER_NOTE}</p>
        </div>
      </div>
      <div className="addresses-state-grid">
        {Array.from({ length: PUBLIC_VISIBLE_STATE_COUNT }).map((_, index) => (
          <span aria-hidden="true" className="addresses-state-link addresses-state-skeleton" key={index} />
        ))}
      </div>
    </div>
  );
}

function StateFilterLink({
  buildHref,
  selectedState,
  state,
}: {
  buildHref: (stateCode: string) => string;
  selectedState: string;
  state: PublicStateLink;
}) {
  const isActive = selectedState === state.code;
  const classNames = ['addresses-state-link'];

  if (isActive) classNames.push('active');
  if (state.count === 0) classNames.push('is-empty');

  return (
    <Link
      aria-pressed={isActive}
      className={classNames.join(' ')}
      href={buildHref(isActive ? '' : state.code)}
    >
      <span className="addresses-state-name">
        {state.zhName}
        <small>{state.name} ({state.code})</small>
      </span>
      <span className="addresses-state-count">{state.count}</span>
    </Link>
  );
}
