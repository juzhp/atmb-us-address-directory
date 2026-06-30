'use client';

import { Fragment, createElement, useRef } from 'react';
import { useServerInsertedHTML } from 'next/navigation';

import { parsePublicHeadCodeElements } from '../_lib/public-head-code-parser';

interface PublicHeadCodeProps {
  headCode: string;
}

export function PublicHeadCode({ headCode }: PublicHeadCodeProps) {
  // useServerInsertedHTML 的回调会在每次 SSR 流式 flush 时被调用，
  // 用一次性标记确保 Head 代码只注入一次，避免在源码里被重复插入多遍。
  const insertedRef = useRef(false);

  useServerInsertedHTML(() => {
    if (insertedRef.current) {
      return null;
    }

    const elements = parsePublicHeadCodeElements(headCode);

    if (!elements.length) {
      return null;
    }

    insertedRef.current = true;

    return createElement(
      Fragment,
      null,
      elements.map((element, index) => {
        const props: Record<string, unknown> = {
          key: `${element.tagName}-${index}`,
          ...element.attributes,
        };

        if (element.innerHTML !== null) {
          props.dangerouslySetInnerHTML = { __html: element.innerHTML };
        }

        return createElement(element.tagName, props);
      }),
    );
  });

  return null;
}
