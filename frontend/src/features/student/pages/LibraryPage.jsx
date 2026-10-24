import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getLibraryDocuments,
  markDocumentViewed,
} from '../services/libraryService'
import DocumentViewerModal from '../../../components/common/DocumentViewerModal.jsx'
import IconSelect from '../../../components/common/IconSelect.jsx'
import Pagination from '../../../components/common/Pagination.jsx'
import {
  categoryAll,
  categoryOptions,
  fileTypeAll,
  fileTypeMeta,
  fileTypeOptions,
  subjectAll,
  subjectMeta,
  subjectOptions,
} from '../../admin/services/filterMeta'
import {
  BotIcon,
  EyeIcon,
  FolderIcon,
  GridIcon,
  ListIcon,
  SearchIcon,
  SparklesIcon,
  GraduationCapIcon,
  UsersIcon,
} from '../../../components/common/icons.jsx'

// Kho tài liệu sinh viên chỉ hiển thị tài liệu khả dụng do backend phân quyền.
const PAGE_SIZE = 12

function LibraryPage() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState(null)
  const [viewing, setViewing] = useState(null)

  // Chỉ lọc theo các thuộc tính hữu ích cho tài liệu đã sẵn sàng với sinh viên.
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [subject, setSubject] = useState('all')
  const [classroom, setClassroom] = useState('all')
  const [type, setType] = useState('all')
  const [view, setView] = useState('grid') // 'grid' | 'list'
  const [page, setPage] = useState(1)

  useEffect(() => {
    getLibraryDocuments().then(setDocs)
  }, [])

  const classroomOptions = useMemo(() => {
    const map = new Map()
    ;(docs || []).forEach((d) => {
      if (d.classroomId && d.classroomName) {
        map.set(d.classroomId, d.classroomName)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({
      value: id,
      label: `Lớp ${name}`,
      icon: UsersIcon,
      color: '#4f46e5',
    }))
  }, [docs])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (docs || []).filter((d) => {
      if (category !== 'all' && d.category !== category) return false
      if (subject !== 'all' && d.subject !== subject) return false
      if (type !== 'all' && d.type !== type) return false
      if (classroom !== 'all' && d.classroomId !== classroom) return false
      if (term) {
        const hay = `${d.name} ${d.author} ${d.subject} ${d.classroomName || ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [docs, q, category, subject, type, classroom])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const paged = useMemo(
    () => filtered.slice(pageStart, pageStart + PAGE_SIZE),
    [filtered, pageStart],
  )

  useEffect(() => {
    setPage(1)
  }, [q, category, subject, type, classroom])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  if (!docs) return <p className="st-loading">Đang tải...</p>

  const hasFilter = q.trim() || category !== 'all' || subject !== 'all' || type !== 'all' || classroom !== 'all'
  const clearFilters = () => { setQ(''); setCategory('all'); setSubject('all'); setType('all'); setClassroom('all') }

  const handleViewDocument = (doc) => {
    setViewing({ ...doc, isNew: false })
    setDocs((current) => current.map((item) => (
      item.id === doc.id ? { ...item, isNew: false } : item
    )))
    markDocumentViewed(doc.id).catch(() => {})
  }

  return (
    <div className="st-wrap">
      <div className="st-library-head">
        <div>
          <h1 className="st-title">Kho tài liệu</h1>
          <p className="st-sub">Tra cứu tài liệu học tập theo môn học, loại tệp hoặc tìm kiếm nhanh.</p>
        </div>
        <div className="st-library-total">
          <span className="st-library-total-icon"><FolderIcon size={22} /></span>
          <div className="st-library-total-meta">
            <span>Tổng tài liệu</span>
            <strong>{docs.length.toLocaleString('vi-VN')}</strong>
          </div>
        </div>
      </div>

      {/* Toolbar: tìm kiếm + lọc + đổi cách hiển thị */}
      <div className="st-card st-lib-toolbar">
        <div className="st-search st-lib-search">
          <SearchIcon size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm kiếm tài liệu, môn học, người tải..."
          />
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
          placeholder="Tất cả loại tệp"
        />
        {classroomOptions.length > 0 && (
          <IconSelect
            value={classroom}
            onChange={setClassroom}
            options={classroomOptions}
            allOption={{ label: 'Tất cả lớp học', icon: UsersIcon, color: '#4f46e5' }}
            placeholder="Tất cả lớp học"
          />
        )}
        <div className="st-view-toggle" role="group" aria-label="Cách hiển thị">
          <button
            type="button"
            className={view === 'grid' ? 'is-active' : ''}
            onClick={() => setView('grid')}
            aria-label="Dạng lưới"
            title="Dạng lưới"
          >
            <GridIcon size={18} />
          </button>
          <button
            type="button"
            className={view === 'list' ? 'is-active' : ''}
            onClick={() => setView('list')}
            aria-label="Dạng danh sách"
            title="Dạng danh sách"
          >
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      <div className="st-library-main">
          {docs.length === 0 ? (
            <div className="st-card st-library-empty">
              <FolderIcon size={34} />
              <h3>Chưa có tài liệu nào</h3>
              <p className="st-muted">Khi giảng viên đăng tài liệu khả dụng, chúng sẽ xuất hiện tại đây.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="st-card st-library-empty">
              <SearchIcon size={30} />
              <h3>Không tìm thấy tài liệu phù hợp</h3>
              <p className="st-muted">Thử đổi từ khóa hoặc bỏ bớt bộ lọc.</p>
              <button type="button" className="st-clear-filter" onClick={clearFilters}>Xóa bộ lọc</button>
            </div>
          ) : (
            <>
              <div className="st-lib-resultbar">
                <span className="st-muted">{filtered.length} tài liệu{hasFilter ? ' (đã lọc)' : ''}</span>
                {hasFilter && (
                  <button type="button" className="st-clear-filter" onClick={clearFilters}>Xóa bộ lọc</button>
                )}
              </div>
              <div className={`st-doc-grid${view === 'list' ? ' is-list' : ''}`}>
                {paged.map((doc) => {
                  const meta = fileTypeMeta(doc.type)
                  const sm = subjectMeta(doc.subject)
                  const Icon = meta.icon
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      className="st-doc-card"
                      onClick={() => handleViewDocument(doc)}
                    >
                      <span className="st-doc-card-icon" style={{ '--c': meta.color }}>
                        <Icon size={20} />
                      </span>
                      <span className="st-doc-card-body">
                        <strong className="st-doc-card-title">
                          {doc.name}
                          {doc.isNew && <span className="st-new-badge" aria-label="Tài liệu mới" />}
                        </strong>
                        <span className="st-doc-card-meta">
                          {doc.author} · {doc.classroomName ? `Lớp ${doc.classroomName} · ` : ''}{doc.date || 'Chưa rõ ngày'}
                        </span>
                      </span>
                      <span className="st-doc-card-foot">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                          <span className="st-doc-tag" style={{ '--c': sm.color }}>{doc.subject}</span>
                          {doc.classroomName && (
                            <span
                              className="st-doc-tag"
                              style={{ '--c': '#4f46e5', fontWeight: 600 }}
                              title={`Lớp học: ${doc.classroomName}`}
                            >
                              Lớp {doc.classroomName}
                            </span>
                          )}
                        </div>
                        <span className="st-doc-card-actions">
                          <span
                            className="st-doc-view"
                            title="Ôn tập Flashcard & Quiz"
                            style={{ color: '#1a56db', background: '#eff6ff' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/student/study/${doc.id}`)
                            }}
                          >
                            <GraduationCapIcon size={15} />
                          </span>
                          <span className="st-badge st-badge--neutral">{doc.type || 'FILE'}</span>
                          <span className="st-doc-view"><EyeIcon size={15} /></span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <Pagination
                current={currentPage}
                total={totalPages}
                info={`Hiển thị ${pageStart + 1}-${Math.min(pageStart + paged.length, filtered.length)} / ${filtered.length} tài liệu`}
                onChange={setPage}
                classPrefix="st"
              />
            </>
          )}
      </div>

      <div className="st-card st-help-card st-library-help">
        <SparklesIcon size={26} className="st-help-spark" />
        <h3>Cần hỗ trợ tìm kiếm?</h3>
        <p>Sử dụng Chat AI để tìm nhanh tài liệu theo mô tả hoặc tóm tắt nội dung tài liệu ngay tức thì.</p>
        <button className="st-help-btn" onClick={() => navigate('/student/chat')}>
          <BotIcon size={16} /> Thử Chat AI ngay
        </button>
      </div>

      {viewing && <DocumentViewerModal doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

export default LibraryPage
