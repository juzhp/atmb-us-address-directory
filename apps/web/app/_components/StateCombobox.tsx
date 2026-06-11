'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface StateComboboxOption {
  code: string;
  label: string;
  searchText: string;
  count?: number;
}

interface StateComboboxProps {
  label: string;
  name: string;
  options: StateComboboxOption[];
  placeholder: string;
}

export function StateCombobox({ label, name, options, placeholder }: StateComboboxProps) {
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<StateComboboxOption | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => option.searchText.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  function selectOption(option: StateComboboxOption) {
    setSelected(option);
    setQuery(option.label);
    setIsOpen(false);
    setActiveIndex(0);
  }

  function clearSelection() {
    setSelected(null);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' && isOpen && filteredOptions[activeIndex]) {
      event.preventDefault();
      selectOption(filteredOptions[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div
      className="home-state-combobox"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
      ref={rootRef}
    >
      <label htmlFor={inputId}>{label}</label>
      <input name={name} type="hidden" value={selected?.code ?? ''} />
      <div className={isOpen ? 'home-state-control is-open' : 'home-state-control'}>
        <input
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={`${inputId}-listbox`}
          autoComplete="off"
          id={inputId}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={options.length ? placeholder : '暂无州数据'}
          role="combobox"
          type="text"
          value={query}
        />
        {selected ? (
          <button aria-label="清除州筛选" onClick={clearSelection} type="button">
            <X size={16} aria-hidden="true" />
          </button>
        ) : (
          <span aria-hidden="true">
            <ChevronDown size={18} />
          </span>
        )}
      </div>
      {isOpen ? (
        <div className="home-state-list" id={`${inputId}-listbox`} role="listbox">
          {filteredOptions.length ? (
            filteredOptions.map((option, index) => (
              <button
                aria-selected={selected?.code === option.code}
                className={index === activeIndex ? 'is-active' : undefined}
                key={option.code}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                role="option"
                type="button"
              >
                <span>{option.label}</span>
                {typeof option.count === 'number' ? <strong>{option.count}</strong> : null}
              </button>
            ))
          ) : (
            <p>没有匹配的州</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
