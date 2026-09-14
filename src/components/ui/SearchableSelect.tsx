'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  required?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  disabled = false,
  emptyMessage = 'No matching options found.',
  required = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 250ms debounce on search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
      setDebouncedSearch('');
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Selected option
  const selectedOption = useMemo(
    () => options.find((opt) => opt.id === value),
    [options, value]
  );

  // Filtered options (capped at 25 for blazing DOM performance)
  const filteredOptions = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return options.slice(0, 25);
    }
    const q = debouncedSearch.toLowerCase().trim();
    return options
      .filter(
        (opt) =>
          opt.label.toLowerCase().includes(q) ||
          (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
      )
      .slice(0, 25);
  }, [options, debouncedSearch]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full text-xs">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100/80 cursor-pointer'
        } ${isOpen ? 'ring-2 ring-bce-cobalt/20 border-bce-cobalt' : ''}`}
      >
        <span className={`truncate ${selectedOption ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
          {selectedOption ? (
            <span>
              {selectedOption.label}
              {selectedOption.sublabel && (
                <span className="ml-1.5 font-normal text-slate-500">({selectedOption.sublabel})</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ml-2 ${
            isOpen ? 'rotate-180 text-bce-cobalt' : ''
          }`}
        />
      </button>

      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent border-none text-xs text-slate-900 focus:outline-none placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs">{emptyMessage}</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors text-xs ${
                      isSelected
                        ? 'bg-bce-navy text-amber-400 font-bold'
                        : 'text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="block truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span
                          className={`block text-[11px] truncate ${
                            isSelected ? 'text-amber-300/80' : 'text-slate-400'
                          }`}
                        >
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-amber-400" />}
                  </button>
                );
              })
            )}

            {options.length > 25 && !debouncedSearch && (
              <div className="px-3 py-1.5 text-[10px] text-slate-400 text-center bg-slate-50 rounded mt-1">
                Type to search all {options.length} items
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
