import React from "react";

const TAG_PATTERN =
  /<(script|noscript|style)\b([^>]*)>([\s\S]*?)<\/\1>|<(meta|link)\b([^>]*)\/?>/gi;

export function renderCustomHeadCode(headCode) {
  if (!headCode || !headCode.trim()) {
    return null;
  }

  const nodes = [];
  let match;
  let index = 0;

  while ((match = TAG_PATTERN.exec(headCode)) !== null) {
    if (match[1]) {
      const tagName = match[1].toLowerCase();
      const attrs = parseAttributes(match[2] || "");
      const innerHtml = match[3] || "";
      nodes.push(renderContainerTag(tagName, attrs, innerHtml, index));
      index += 1;
      continue;
    }

    const tagName = (match[4] || "").toLowerCase();
    const attrs = parseAttributes(match[5] || "");
    nodes.push(React.createElement(tagName, { key: `head-code-${index}`, ...attrs }));
    index += 1;
  }

  return nodes.length > 0 ? nodes : null;
}

function renderContainerTag(tagName, attrs, innerHtml, index) {
  const key = `head-code-${index}`;

  if (tagName === "script" || tagName === "style") {
    return React.createElement(tagName, {
      key,
      ...attrs,
      dangerouslySetInnerHTML: { __html: innerHtml }
    });
  }

  if (tagName === "noscript") {
    return React.createElement(tagName, {
      key,
      ...attrs,
      dangerouslySetInnerHTML: { __html: innerHtml }
    });
  }

  return null;
}

function parseAttributes(input) {
  const attrs = {};
  const pattern = /([^\s=/>]+)(?:=("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;

  while ((match = pattern.exec(input)) !== null) {
    const name = normalizeAttributeName(match[1]);
    if (!name) {
      continue;
    }

    const value = match[3] ?? match[4] ?? match[5];
    if (value === undefined) {
      attrs[name] = true;
      continue;
    }

    attrs[name] = value;
  }

  return attrs;
}

function normalizeAttributeName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  const map = {
    async: "async",
    crossorigin: "crossOrigin",
    charset: "charSet",
    class: "className",
    defer: "defer",
    href: "href",
    id: "id",
    integrity: "integrity",
    media: "media",
    name: "name",
    nonce: "nonce",
    rel: "rel",
    src: "src",
    type: "type",
    content: "content",
    property: "property",
    "http-equiv": "httpEquiv",
    referrerpolicy: "referrerPolicy"
  };

  return map[normalized] ?? normalized;
}
