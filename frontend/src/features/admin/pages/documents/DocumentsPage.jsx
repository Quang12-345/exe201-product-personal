import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDocuments } from '../../hooks/useDocuments.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import Pagination from '../../components/Pagination.jsx'
import DocumentViewerModal from '../../../../components/common/DocumentViewerModal.jsx'
import IconSelect from '../../../../components/common/IconSelect.jsx'
import {
  aiStatusAll,
  aiStatusOptions,
  categoryAll,
  categoryOptions,
  fileTypeAll,
  fileTypeMeta,
  fileTypeOptions,
  subjectAll,
  subjectMeta,
  subjectOptions,
} from '../../services/filterMeta'
import {
  EditIcon,
  EyeIcon,
  FolderIcon,
  GridIcon,
  ListIcon,
  SearchIcon,
  TrashIcon,
} from '../../../../components/common/icons.jsx'
import { notify } from '../../../../components/common/toast.jsx'

const AI_STATUS = {
  indexed: { variant: 'success', label: 'Đã lập chỉ mục', dot: true },
  pending: { variant: 'neutral', label: 'Chờ xử lý' },
  error: { variant: 'danger', label: 'Lỗi', dot: true },
}

function newestTime(doc) {
  return doc.createdAt ? new Date(doc.createdAt).getTime() : 0
}

const PAGE_SIZE = 12

function DocumentsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { documents, loading, removeDocument } = useDocuments()
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [subject, setSubject] = useState('all')
  const [category, setCategory] = useState('all')
  const [type, setType] = useState('all')
  const [ai, setAi] = useState('all')
  const [deletingId, setDeletingId] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [view, setView] = useState('grid') // 'grid' | 'list'
  const [page, setPage] = useState(1)

  useEffect(() => {
    setQ(searchParams.get('q') || '')
  }, [searchParams])

  const shown = useMemo(() => {
    const keyword = q.trim().toLowerCase()
    return documents.filter(
      (doc) =>
        (keyword === '' || `${doc.name} ${doc.owner || ''} ${doc.subject || ''}`.toLowerCase().includes(keyword)) &&
        (subject === 'all' || doc.subject === subject) &&
        (category === 'all' || doc.category === category) &&
        (type === 'all' || doc.type === type) &&
        (ai === 'all' || doc.aiStatus === ai),
    )
  }, [documents, q, subject, category, type, ai])

  const latest = useMemo(
    () => documents.slice().sort((a, b) => newestTime(b) - newestTime(a)).slice(0, 6),
    [documents],
  )
  // Danh sách phẳng đã lọc, mới nhất lên trước (thay cho gom nhóm theo môn).
  const filtered = useMemo(
    () => shown.slice().sort((a, b) => newestTime(b) - newestTime(a)),
    [shown],
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const paged = useMemo(
    () => filtered.slice(pageStart, pageStart + PAGE_SIZE),
    [filtered, pageStart],
  )
  const hasFilter = q.trim() || subject !== 'all' || category !== 'all' || type !== 'all' || ai !== 'all'
  const clearFilters = () => { setQ(''); setSubject('all'); setCategory('all'); setType('all'); setAi('all') }

  useEffect(() => {
    setPage(1)
  }, [q, subject, category, type, ai])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const handleDelete = async (event, doc) => {
    event.stopPropagation()
    if (!window.confirm(`Xóa tài liệu "${doc.name}"? Hành động này không thể hoàn tác.`)) return
    setDeletingId(doc.id)
    try {
      await removeDocument(doc.id)
      notify('Xóa tài liệu thành công.')
    } catch {
      notify('Xóa thất bại. Vui lòng thử lại.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const renderActions = (doc, light = false) => (
    <div className={`dmrs-library-actions${light ? ' dmrs-library-actions--light' : ''}`}>
      <button type="button" className="dmrs-icon-btn" title="Xem tài liệu" onClick={(e) => { e.stopPropagation(); setViewing(doc) }}>
        <EyeIcon size={16} />
      </button>
      <button type="button" className="dmrs-icon-btn" title="Sửa tài liệu" onClick={(e) => { e.stopPropagation(); navigate(`/admin/documents/${doc.id}/edit`) }}>
        <EditIcon size={16} />
      </button>
      <button
        type="button"
        className="dmrs-icon-btn dmrs-icon-btn--danger"
        title="Xóa tài liệu"
        disabled={deletingId === doc.id}
        onClick={(e) => handleDelete(e, doc)}
      >
        <TrashIcon size={16} />
      </button>
    </div>
  )

  // Thẻ tài liệu (dùng cho cả "Mới nhất" và lưới chính) — đồng bộ với student/lecturer.
  const renderDocCard = (doc) => {
    const meta = fileTypeMeta(doc.type)
    const sm = subjectMeta(doc.subject)
    const st = AI_STATUS[doc.aiStatus] || AI_STATUS.pending
    const FileIcon = meta.icon
    return (
      <div key={doc.id} className="dmrs-doc-card" onClick={() => setViewing(doc)}>
        <div className="dmrs-doc-card-top">
          <span className="dmrs-doc-card-icon" style={{ '--c': meta.color }}><FileIcon size={20} /></span>
          {renderActions(doc)}
        </div>
        <strong className="dmrs-doc-card-title">{doc.name}</strong>
        <span className="dmrs-doc-card-meta">{doc.owner || '—'} · {doc.uploadedAt || 'Chưa rõ ngày'}</span>
        <div className="dmrs-doc-card-foot">
          <span className="dmrs-doc-tag" style={{ '--c': sm.color }}>{doc.subject || 'Khác'}</span>
          <StatusBadge variant={st.variant} dot={st.dot}>{st.label}</StatusBadge>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="dmrs-library-head">
        <div>
          <h1 className="dmrs-page-title">Kho tài liệu</h1>
          <p className="dmrs-page-sub">Quản lý toàn bộ tài liệu theo môn học, quy định và người tải lên.</p>
        </div>
        <div className="dmrs-library-total">
          <span className="dmrs-library-total-icon"><FolderIcon size={22} /></span>
          <div className="dmrs-library-total-meta">
            <span>Tổng tài liệu</span>
            <strong>{documents.length}</strong>
          </div>
        </div>
      </div>

      <section className="dmrs-card dmrs-library-feature">
        <div className="dmrs-library-feature-head">
          <div>
            <h2 className="dmrs-card-title">Tài liệu tải lên mới nhất</h2>
            <p className="dmrs-muted">Theo dõi nhanh các tài liệu vừa được đưa vào hệ thống.</p>
          </div>
          <strong>{documents.length}</strong>
        </div>
        {latest.length === 0 ? (
          <p className="dmrs-muted">Chưa có tài liệu nào.</p>
        ) : (
          <div className="dmrs-doc-grid">
            {latest.map(renderDocCard)}
          </div>
        )}
      </section>

      <div className="dmrs-card dmrs-toolbar dmrs-library-toolbar">
        <div className="dmrs-search dmrs-search--inline">
          <SearchIcon size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm kiếm tên tài liệu, người tải..." />
        </div>
        <IconSelect
          value={category}
          onChange={setCategory}
          options={categoryOptions}
          allOption={categoryAll}
          placeholder="Tất cả phân loại"
        />
        <IconSelect
          value={subject}
          onChange={setSubject}
          options={subjectOptions}
          allOption={subjectAll}
          placeholder="Tất cả môn học"
        />
        <IconSelect
          value={type}
          onChange={setType}
          options={fileTypeOptions}
          allOption={fileTypeAll}
          placeholder="Loại tệp"
        />
        <IconSelect
          value={ai}
          onChange={setAi}
          options={aiStatusOptions}
          allOption={aiStatusAll}
          placeholder="Trạng thái AI"
        />
        <div className="dmrs-view-toggle" role="group" aria-label="Cách hiển thị">
          <button type="button" className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')} aria-label="Dạng lưới" title="Dạng lưới">
            <GridIcon size={18} />
          </button>
          <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')} aria-label="Dạng danh sách" title="Dạng danh sách">
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="dmrs-loading">Đang tải...</p>
      ) : (
        <div className="dmrs-library-main">
            {filtered.length === 0 ? (
              <div className="dmrs-card dmrs-library-empty">
                <FolderIcon size={34} />
                <h3>{hasFilter ? 'Không tìm thấy tài liệu phù hợp' : 'Chưa có tài liệu nào'}</h3>
                <p className="dmrs-muted">{hasFilter ? 'Thử đổi từ khóa hoặc bỏ bớt bộ lọc.' : 'Các tài liệu sẽ xuất hiện tại đây.'}</p>
                {hasFilter && <button type="button" className="dmrs-link-btn" onClick={clearFilters}>Xóa bộ lọc</button>}
              </div>
            ) : (
              <>
                <div className="dmrs-lib-resultbar">
                  <span className="dmrs-muted">{filtered.length} tài liệu{hasFilter ? ' (đã lọc)' : ''}</span>
                  {hasFilter && <button type="button" className="dmrs-link-btn" onClick={clearFilters}>Xóa bộ lọc</button>}
                </div>
                <div className={`dmrs-doc-grid${view === 'list' ? ' is-list' : ''}`}>
                  {paged.map(renderDocCard)}
                </div>
                <Pagination
                  current={currentPage}
                  total={totalPages}
                  info={`Hiển thị ${pageStart + 1}-${Math.min(pageStart + paged.length, filtered.length)} / ${filtered.length} tài liệu`}
                  onChange={setPage}
                />
              </>
            )}
        </div>
      )}

      {viewing && <DocumentViewerModal doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

export default DocumentsPage
