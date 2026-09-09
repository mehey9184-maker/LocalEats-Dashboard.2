import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];

    // Always show page 1
    pages.push(1);

    if (currentPage > 3) {
      pages.push("ellipsis");
    }

    // Show pages around currentPage
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("ellipsis");
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 px-6 py-4 bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-xs">
      <div className="text-xs text-on-surface-variant font-medium">
        Showing Page <span className="font-bold text-on-surface">{currentPage}</span> of <span className="font-bold text-on-surface">{totalPages}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-xl text-on-surface hover:bg-surface-container-low active:scale-95 transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:active:scale-100 border border-outline-variant/10 flex items-center justify-center min-w-[36px] h-[36px] cursor-pointer"
          title="Previous Page"
        >
          <ArrowLeft size={16} />
        </button>
        {pageNumbers.map((page, idx) => {
          if (page === "ellipsis") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="w-9 h-9 flex items-center justify-center text-on-surface-variant/40 font-bold select-none text-xs"
              >
                •••
              </span>
            );
          }
          const isActive = page === currentPage;
          return (
            <button
              type="button"
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                "w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-95",
                isActive
                  ? "bg-primary text-white font-black shadow-md shadow-primary/20 scale-105"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low border border-outline-variant/5"
              )}
            >
              {page}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-xl text-on-surface hover:bg-surface-container-low active:scale-95 transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:active:scale-100 border border-outline-variant/10 flex items-center justify-center min-w-[36px] h-[36px] cursor-pointer"
          title="Next Page"
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
