import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getField, getFieldDocuments, getMostViewed } from '../services/libraryService'
import DocumentViewerModal from '../../../components/common/DocumentViewerModal.jsx'
import FilterDropdown from '../../../components/common/FilterDropdown.jsx'
import { DOC_TYPE_FILTERS, classifyDocType } from '../../../constants/docTypes'
import {
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  LinkIcon,
  YouTubeIcon,
  CalendarIcon,
  EyeIcon,
  DownloadIcon,
  TrendingUpIcon,
  StarIcon,
  SparklesIcon,
} from '../../../components/common/icons.jsx'
import { comingSoon } from '../../../components/common/comingSoon.jsx'

const TYPE_VARIANT = { PDF: 'danger', DOCX: 'info', SLIDE: 'success' }
const MV_ICON = { trending: TrendingUpIcon, star: StarIcon, sparkles: SparklesIcon }
const DOC_TYPE_ICON = {
  youtube: YouTubeIcon,
  link: LinkIcon,
}

function DocTypeIcon({ doc, size = 18 }) {
  const Icon = DOC_TYPE_ICON[classifyDocType(doc)] || FileTextIcon
  return <Icon size={size} />
}

// Trang Kho tài liệu theo lĩnh vực: bộ lọc + bảng tài liệu + xem nhiều.
function LibraryFieldPage() {
  const { fieldId } = useParams()
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState([]) // lọc theo loại tệp
  const [yearFilter, setYearFilter] = useState([]) // lọc theo năm tải lên
  const [sort, setSort] = useState('newest') // newest | oldest | name
  const [viewing, setViewing] = useState(null) // tài liệu đang xem trong popup

  useEffect(() => {
    Promise.all([getField(fieldId), getFieldDocuments(), getMostViewed()]).then(
      ([field, docs, viewed]) => setData({ field, docs, viewed })
    )
  }, [fieldId])

  const docs = data?.docs || []
  // Năm tải lên: lấy từ created_at (ổn định) thay vì cắt chuỗi ngày đã định dạng.
  const yearOf = (d) => (d.createdAt ? String(new Date(d.createdAt).getFullYear()) : '')
  // Tùy chọn bộ lọc dựng từ dữ liệu thật (đã loại trùng + sắp xếp hợp lý).
  const typeOpts = useMemo(() => {
    const present = new Set(docs.map(classifyDocType))
    return DOC_TYPE_FILTERS.filter((t) => present.has(t.value)).map((t) => {
      const Icon = DOC_TYPE_ICON[t.value] || FileTextIcon
      return { ...t, icon: <Icon size={16} /> }
    })
  }, [docs])
  const yearOpts = useMemo(() => {
    const years = [...new Set(docs.map(yearOf).filter(Boolean))].sort((a, b) => Number(b) - Number(a))
    return years.map((y) => ({ value: y, label: y, color: '#10b981', icon: <CalendarIcon size={16} /> }))
  }, [docs])

  if (!data) return <p className="st-loading">Đang tải...</p>
  const { field, viewed } = data
  const keyword = q.trim().toLowerCase()
  const shownDocs = docs
    .filter(
      (d) =>
        (keyword === '' || `${d.name} ${d.author || ''}`.toLowerCase().includes(keyword)) &&
        (typeFilter.length === 0 || typeFilter.includes(classifyDocType(d))) &&
        (yearFilter.length === 0 || yearFilter.includes(yearOf(d)))
    )
    .sort((a, b) => {
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '', 'vi')
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return sort === 'oldest' ? ta - tb : tb - ta
    })
  const hasFilter = q.trim() || typeFilter.length || yearFilter.length || sort !== 'newest'
  const clearFilters = () => { setQ(''); setTypeFilter([]); setYearFilter([]); setSort('newest') }

  return (
    <div className="st-wrap">
      <div className="st-breadcrumb">
        <Link to="/student/library">Kho tài liệu</Link> <span>›</span> <strong>{field.name}</strong>
      </div>

      <div className="st-field-header">
        <div>
          <h1 className="st-title">{field.name}</h1>
          <p className="st-sub">Khám phá và truy cập các tài liệu học tập, giáo trình chuyên ngành và nghiên cứu khoa học thuộc lĩnh vực {field.name}.</p>
        </div>
      </div>

      <div className="st-card st-filter-bar">
        <div className="st-search st-filter-search">
          <SearchIcon size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm kiếm tên tài liệu..." />
        </div>
        <FilterDropdown label="Loại tệp" options={typeOpts} selected={typeFilter} onChange={setTypeFilter} />
        <FilterDropdown label="Năm tải lên" options={yearOpts} selected={yearFilter} onChange={setYearFilter} searchable />
        <select className="st-sort-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sắp xếp">
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="name">Tên A-Z</option>
        </select>
        {hasFilter ? <button className="st-clear-filter" onClick={clearFilters}>Xóa bộ lọc</button> : null}
      </div>

      <div className="st-card st-table-card">
        <table className="st-table">
          <thead>
            <tr><th>Tên tài liệu</th><th>Tác giả / Nguồn</th><th>Ngày tải lên</th><th>Loại</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {shownDocs.map((d) => (
              <tr key={d.id} className="st-doc-row" onClick={() => setViewing(d)}>
                <td className="st-doc-name"><DocTypeIcon doc={d} size={18} /> {d.name}</td>
                <td className="st-muted">{d.author}</td>
                <td className="st-muted">{d.date}</td>
                <td><span className={'st-badge st-badge--' + (TYPE_VARIANT[d.type] || 'neutral')}>{d.type}</span></td>
                <td>
                  <div className="st-row-actions">
                    <button className="st-icon-btn" aria-label="Xem" onClick={(e) => { e.stopPropagation(); setViewing(d) }}><EyeIcon size={16} /></button>
                    <button className="st-icon-btn" aria-label="Tải" onClick={(e) => { e.stopPropagation(); comingSoon('Tải xuống đang được phát triển 🚧') }}><DownloadIcon size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="st-pagination">
          <span className="st-muted">Hiển thị <strong>{shownDocs.length}</strong> trên <strong>{docs.length}</strong> tài liệu</span>
          <div className="st-pages">
            <span className="st-muted">Trang 1/10</span>
            <button className="st-page-btn" onClick={() => comingSoon('Phân trang đang được phát triển 🚧')}><ChevronLeftIcon size={16} /></button>
            <button className="st-page-btn" onClick={() => comingSoon('Phân trang đang được phát triển 🚧')}><ChevronRightIcon size={16} /></button>
          </div>
        </div>
      </div>

      <h2 className="st-section-title">Được xem nhiều gần đây</h2>
      <div className="st-viewed-grid">
        {viewed.map((v) => {
          const Icon = MV_ICON[v.icon] || StarIcon
          return (
            <div key={v.id} className="st-viewed-card">
              <div className="st-viewed-top">
                <span className="st-viewed-tag">{v.tag}</span>
                <Icon size={16} />
              </div>
              <h3 className="st-viewed-title">{v.title}</h3>
              <p className="st-muted">{v.desc}</p>
              <span className="st-viewed-views"><EyeIcon size={14} /> {v.views}</span>
            </div>
          )
        })}
      </div>

      {viewing && <DocumentViewerModal doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

export default LibraryFieldPage
