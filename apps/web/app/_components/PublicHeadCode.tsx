'use client';

import { Fragment, createElement } from 'react';
import { useServerInsertedHTML } from 'next/navigation';

import { parsePublicHeadCodeElements } from '../_lib/public-head-code-parser';

interface PublicHeadCodeProps {
  headCode: string;
}

export function PublicHeadCode({ headCode }: PublicHeadCodeProps) {
  useServerInsertedHTML(() => {
    const elements = parsePublicHeadCodeElements(headCode);

    if (!elements.length) {
      return null;
    }

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
