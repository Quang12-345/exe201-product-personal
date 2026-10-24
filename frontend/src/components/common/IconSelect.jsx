import { useState, useRef, useEffect, useMemo } from 'react'
import { CheckIcon, ChevronDownIcon, SearchIcon } from './icons.jsx'
import './IconSelect.css'

// Bỏ dấu tiếng Việt + thường hoá để tìm kiếm "không dấu" (gõ "lap trinh" ra "Lập trình").
function norm(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

// Dropdown chọn-một có badge icon màu cho từng giá trị (thay <select> trơn).
// options: [{ value, label, icon: Component, color: '#hex' }]
// value 'all' (hoặc rỗng) hiển thị placeholder; allOption tuỳ chọn icon/màu cho dòng "Tất cả".
// searchable: hiện ô tìm trong dropdown. Mặc định tự bật khi danh sách dài (>8 mục).
export default function IconSelect({
  value,
  onChange,
  options,
  placeholder = 'Tất cả',
  allOption,
  className = '',
  searchable,
  clearable = true,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  // Mặc định LUÔN hiện ô tìm nhanh ở mọi bộ lọc; truyền searchable={false} để tắt.
  const canSearch = searchable ?? true

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Mở dropdown → xoá từ khoá cũ và focus ô tìm.
  useEffect(() => {
    if (open) {
      setQuery('')
      if (canSearch) {
        const id = window.setTimeout(() => inputRef.current?.focus(), 0)
        return () => window.clearTimeout(id)
      }
    }
    return undefined
  }, [open, canSearch])

  const isAll = !value || value === 'all'
  const selected = options.find((o) => o.value === value)
  const TriggerIcon = isAll ? allOption?.icon : selected?.icon
  const triggerColor = isAll ? allOption?.color : selected?.color
  const triggerLabel = isAll ? placeholder : selected?.label || placeholder

  const filtered = useMemo(() => {
    const term = norm(query.trim())
    if (!term) return options
    return options.filter((o) => norm(o.label).includes(term))
  }, [options, query])

  const choose = (v) => {
    onChange(v)
    setOpen(false)
  }

  return (
    <div className={`dmrs-iselect ${open ? 'is-open' : ''} ${className}`} ref={ref}>
      <button
        type="button"
        className="dmrs-iselect-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {TriggerIcon ? (
          <span
            className={`dmrs-iselect-badge ${isAll ? 'dmrs-iselect-badge--muted' : ''}`}
            style={triggerColor ? { '--badge': triggerColor } : undefined}
          >
            <TriggerIcon size={14} />
          </span>
        ) : null}
        <span className="dmrs-iselect-text">{triggerLabel}</span>
        <ChevronDownIcon size={16} className="dmrs-iselect-caret" />
      </button>

      {open && (
        <div className="dmrs-iselect-menu" role="listbox">
          {canSearch && (
            <div className="dmrs-iselect-search">
              <SearchIcon size={15} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm nhanh..."
                aria-label="Tìm trong danh sách"
              />
            </div>
          )}

          {/* Dòng "Tất cả ..." chỉ hiện khi chưa gõ tìm kiếm (ẩn khi clearable=false, vd form bắt buộc chọn). */}
          {clearable && !query.trim() && (
            <button
              type="button"
              role="option"
              aria-selected={isAll}
              className={`dmrs-iselect-opt ${isAll ? 'is-active' : ''}`}
              onClick={() => choose('all')}
            >
              <span className="dmrs-iselect-badge dmrs-iselect-badge--muted">
                {allOption?.icon ? <allOption.icon size={14} /> : null}
              </span>
              <span className="dmrs-iselect-opt-label">{placeholder}</span>
              {isAll && <CheckIcon size={16} className="dmrs-iselect-check" />}
            </button>
          )}

          {filtered.map((o) => {
            const Icon = o.icon
            const active = value === o.value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                className={`dmrs-iselect-opt ${active ? 'is-active' : ''}`}
                onClick={() => choose(o.value)}
              >
                <span className="dmrs-iselect-badge" style={{ '--badge': o.color }}>
                  {Icon ? <Icon size={14} /> : null}
                </span>
                <span className="dmrs-iselect-opt-label">{o.label}</span>
                {active && <CheckIcon size={16} className="dmrs-iselect-check" />}
              </button>
            )
          })}

          {filtered.length === 0 && <p className="dmrs-iselect-empty">Không có kết quả</p>}
        </div>
      )}
    </div>
  )
}
