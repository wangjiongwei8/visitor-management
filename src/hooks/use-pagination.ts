import { useState, useMemo, useEffect, useRef } from 'react';

interface UsePaginationProps<T> {
  data: T[];
  pageSize?: number;
}

interface UsePaginationReturn<T> {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  paginatedData: T[];
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setPageSize: (size: number) => void;
  startIndex: number;
  endIndex: number;
}

export function usePagination<T>({
  data,
  pageSize: initialPageSize = 20,
}: UsePaginationProps<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const prevDataRef = useRef(data);

  // 当数据源变化时（新查询结果），自动重置到第一页
  useEffect(() => {
    if (data !== prevDataRef.current) {
      prevDataRef.current = data;
      setCurrentPage(1);
    }
  }, [data]);

  const totalPages = useMemo(() => {
    return Math.ceil(data.length / pageSize);
  }, [data.length, pageSize]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, data.length);

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setCurrentPage(1); // 重置到第一页
  };

  return {
    currentPage,
    totalPages,
    pageSize,
    paginatedData,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    startIndex,
    endIndex,
  };
}
