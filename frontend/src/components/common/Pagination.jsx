import { ChevronLeftIcon, ChevronRightIcon } from './icons.jsx'

function pageList(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 3) return [1, 2, 3, '...', total]
  if (current >= total - 2) return [1, '...', total - 2, total - 1, total]
  return [1, '...', current, '...', total]
}

function Pagination({
  current = 1,
  total = 1,
  info,
  onChange = () => {},
  classPrefix = 'dmrs',
}) {
  const safeTotal = Math.max(1, total)
  const safeCurrent = Math.min(Math.max(1, current), safeTotal)
  const pages = pageList(safeCurrent, safeTotal)
  const pagesClass = classPrefix === 'st' ? 'st-pages' : `${classPrefix}-pagination-pages`

  return (
    <div className={`${classPrefix}-pagination`}>
      {info && <span className={`${classPrefix}-pagination-info`}>{info}</span>}
      <div className={pagesClass}>
        <button
          type="button"
          className={`${classPrefix}-page-btn`}
          disabled={safeCurrent === 1}
          onClick={() => onChange(safeCurrent - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeftIcon size={16} />
        </button>
        {pages.map((page, index) =>
          page === '...' ? (
            <span key={`gap-${index}`} className={`${classPrefix}-page-gap`}>...</span>
          ) : (
            <button
              key={page}
              type="button"
              className={`${classPrefix}-page-btn${page === safeCurrent ? ' is-active' : ''}`}
              onClick={() => onChange(page)}
              aria-current={page === safeCurrent ? 'page' : undefined}
            >
              {page}
            </button>
          ),
        )}
        <button
          type="button"
          className={`${classPrefix}-page-btn`}
          disabled={safeCurrent === safeTotal}
          onClick={() => onChange(safeCurrent + 1)}
          aria-label="Trang sau"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>
    </div>
  )
}

export default Pagination
