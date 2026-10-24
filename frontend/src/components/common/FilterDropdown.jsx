import { useState } from 'react'
import { FilterIcon, ChevronDownIcon, SearchIcon } from './icons.jsx'
import './FilterDropdown.css'

// Dropdown lọc đa chọn (multi-select) có ô tìm kiếm + icon màu cho từng mục.
// options: [{ value, label, color? }]  | selected: string[] | onChange(next: string[])
function FilterDropdown({ label = 'Tất cả', options = [], selected = [], onChange, searchable = false }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const shown = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options

  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val])

  const text = selected.length ? `${label} (${selected.length})` : label

  return (
    <div className="fd">
      <button type="button" className={'fd-trigger' + (open ? ' is-open' : '')} onClick={() => setOpen((o) => !o)}>
        <FilterIcon size={16} />
        <span className="fd-trigger-text">{text}</span>
        <ChevronDownIcon size={16} className={'fd-caret' + (open ? ' is-open' : '')} />
      </button>

      {open && (
        <>
          <div className="fd-backdrop" onClick={() => setOpen(false)} />
          <div className="fd-panel">
            {searchable && (
              <div className="fd-search">
                <SearchIcon size={16} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={label} autoFocus />
              </div>
            )}
            <div className="fd-list">
              {shown.map((o) => (
                <label key={o.value} className="fd-item">
                  <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                  <span className="fd-icon" style={{ background: (o.color || '#94a3b8') + '22', color: o.color || '#64748b' }}>
                    {o.icon}
                  </span>
                  <span className="fd-label">{o.label}</span>
                </label>
              ))}
              {shown.length === 0 && <p className="fd-empty">Không có kết quả</p>}
            </div>
            {selected.length > 0 && (
              <button type="button" className="fd-clear" onClick={() => onChange([])}>Bỏ chọn tất cả</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default FilterDropdown
