'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

interface HostContact {
  id: number;
  name: string;
  department: string;
  phone?: string;
}

interface HostContactSearchProps {
  value: string;
  onChange: (value: string) => void;
  onValidChange: (valid: boolean) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export default function HostContactSearch({
  value,
  onChange,
  onValidChange,
  className,
  placeholder = '请输入受访人姓名',
  required = false,
}: HostContactSearchProps) {
  const [results, setResults] = useState<HostContact[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // 记录当前是否已从下拉中“选定”受访人；只有选定才视为有效（Q2 硬阻止：自由输入不自动放行）
  const selectedNameRef = useRef<string | null>(null);

  // 搜索 host_contacts
  const searchHostContacts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/host-contacts?query=${encodeURIComponent(query.trim())}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data || []);
        // 已选定且输入与选定一致时不重复弹出下拉
        setShowResults(query.trim() !== selectedNameRef.current);
        setHasSearched(true);
      }
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [onValidChange]);

  // 防抖搜索
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      searchHostContacts(value);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, searchHostContacts]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 当用户输入后，如果结果为空，标记为不匹配（硬阻止）；有结果但未选定 → 仍无效，需从下拉选择
  useEffect(() => {
    if (hasSearched && !isSearching && value.trim()) {
      if (results.length === 0) {
        setError('未找到该受访人，请联系管理员添加后重试');
        onValidChange(false);
      } else {
        setError('');
        // 仅当已从下拉选定且输入与选定完全一致时才有效（Q2 硬阻止：自由输入不自动放行）
        if (selectedNameRef.current && selectedNameRef.current === value.trim()) {
          onValidChange(true);
        } else {
          onValidChange(false);
        }
      }
    }
  }, [hasSearched, isSearching, value, results, onValidChange]);

  const handleSelect = (contact: HostContact) => {
    selectedNameRef.current = contact.name;
    onChange(contact.name);
    setShowResults(false);
    setError('');
    onValidChange(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    // 输入发生变化且与已选定受访人不一致 → 撤销选定，重新置为无效
    if (newValue.trim() === '' || newValue.trim() !== selectedNameRef.current) {
      selectedNameRef.current = null;
      setHasSearched(false);
      setError('');
      setShowResults(false);
      onValidChange(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={cn(
            'h-10 pr-8',
            error && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          required={required}
          autoComplete="off"
        />
        {isSearching && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}
        {!isSearching && (
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      {/* 搜索结果下拉 */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
          {results.map((contact) => (
            <button
              key={contact.id}
              type="button"
              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
              onClick={() => handleSelect(contact)}
            >
              <div className="font-medium text-gray-900">{contact.name}</div>
              <div className="text-sm text-gray-500">{contact.department}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
