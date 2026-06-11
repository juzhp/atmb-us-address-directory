'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'atmb_public_address_clicked_rows';
const ROW_SELECTOR = '[data-address-row-id]';

function readClickedRows() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return new Set<string>(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function writeClickedRows(rows: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(rows).slice(-500)));
  } catch {
    // Ignore storage failures; hover and active states still work.
  }
}

export function AddressRowClickState() {
  useEffect(() => {
    const clickedRows = readClickedRows();
    const rows = Array.from(document.querySelectorAll<HTMLElement>(ROW_SELECTOR));

    rows.forEach((row) => {
      const id = row.dataset.addressRowId;
      if (id && clickedRows.has(id)) {
        row.classList.add('is-clicked');
      }
    });

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const row = target?.closest<HTMLElement>(ROW_SELECTOR);
      const id = row?.dataset.addressRowId;

      if (!row || !id) {
        return;
      }

      row.classList.add('is-clicked');
      clickedRows.add(id);
      writeClickedRows(clickedRows);
    };

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return null;
}
