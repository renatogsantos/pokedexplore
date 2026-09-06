"use client";

import { useEffect, useRef, useState } from "react";

export default function useThreeRowPagination({ selector, fallbackColumns = 2 } = {}) {
  const gridRef = useRef(null);
  const [pageSize, setPageSize] = useState(fallbackColumns * 3);

  useEffect(() => {
    const grid = selector ? document.querySelector(selector) : gridRef.current;
    if (!grid || typeof window === "undefined") return;

    const updatePageSize = () => {
      const columns = Number.parseInt(
        window.getComputedStyle(grid).getPropertyValue("--cards-per-row"),
        10,
      );
      setPageSize(Math.max(1, Number.isFinite(columns) ? columns : fallbackColumns) * 3);
    };

    updatePageSize();
    const observer = new ResizeObserver(updatePageSize);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [fallbackColumns, selector]);

  return { gridRef, pageSize };
}
