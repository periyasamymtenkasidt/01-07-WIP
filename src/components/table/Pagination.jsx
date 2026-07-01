import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  fromEntry,
  toEntry,
  totalCount,
}) {
  const changePage = (page) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange?.(page);
  };

  const getDesktopPages = () => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4)
      return [1, 2, 3, 4, 5, "...", totalPages];
    if (currentPage >= totalPages - 3)
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  };

  const getMobilePages = () => {
    if (totalPages <= 4)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage === 1) return [1, 2, "...", totalPages];
    if (currentPage === totalPages) return [1, "...", totalPages - 1, totalPages];
    return [1, "...", currentPage, "...", totalPages];
  };

  const navBtn = (disabled) =>
    `flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 ${
      disabled
        ? "text-text-subtle cursor-not-allowed opacity-40"
        : "text-text-muted hover:bg-bg-soft hover:text-text cursor-pointer"
    }`;

  const pageBtn = (isActive) =>
    `min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
      isActive
        ? "bg-primary text-white shadow-sm"
        : "text-text-muted hover:bg-bg-soft hover:text-text"
    }`;

  const renderPages = (pages) =>
    pages.map((page, i) =>
      page === "..." ? (
        <span
          key={`ellipsis-${i}`}
          className="w-8 h-8 flex items-center justify-center text-text-subtle text-sm select-none"
        >
          ···
        </span>
      ) : (
        <button
          key={page}
          onClick={() => changePage(page)}
          aria-current={currentPage === page ? "page" : undefined}
          className={pageBtn(currentPage === page)}
        >
          {page}
        </button>
      )
    );

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3  shrink-0">
      {/* Entry count */}
      <p className="text-xs text-text-muted shrink-0">
        {totalCount === 0 ? (
          "No entries"
        ) : (
          <>
            Showing{" "}
            <span className="font-semibold text-text">{fromEntry}–{toEntry}</span>
            {" "}of{" "}
            <span className="font-semibold text-text">{totalCount}</span>
            {" "}entries
          </>
        )}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {totalPages > 1 && (
          <span className="text-xs text-text-muted sm:hidden">
            Page <span className="font-semibold text-text">{currentPage}</span> of {totalPages}
          </span>
        )}

        <nav aria-label="Pagination" className="flex items-center gap-0.5">
          <button
            onClick={() => changePage(1)}
            disabled={currentPage === 1}
            className={navBtn(currentPage === 1)}
            title="First page"
          >
            <ChevronsLeft size={14} />
          </button>

          <button
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
            className={navBtn(currentPage === 1)}
            title="Previous page"
          >
            <ChevronLeft size={14} />
          </button>

          <div className="hidden sm:flex items-center gap-0.5">
            {renderPages(getDesktopPages())}
          </div>

          <div className="flex sm:hidden items-center gap-0.5">
            {renderPages(getMobilePages())}
          </div>

          <button
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={navBtn(currentPage === totalPages)}
            title="Next page"
          >
            <ChevronRight size={14} />
          </button>

          <button
            onClick={() => changePage(totalPages)}
            disabled={currentPage === totalPages}
            className={navBtn(currentPage === totalPages)}
            title="Last page"
          >
            <ChevronsRight size={14} />
          </button>
        </nav>
      </div>
    </div>
  );
}
