import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getClassroom,
  getClassroomDocuments,
  getDownloadUrl,
} from '../services/classroomService'
import DocumentViewerModal from '../../../components/common/DocumentViewerModal.jsx'
import {
  BookOpenIcon,
  ArchiveIcon,
  SearchIcon,
  ChevronLeftIcon,
  CopyIcon,
  CheckIcon,
  EyeIcon,
  DownloadIcon,
  SparklesIcon,
  HelpIcon,
  FileTextIcon,
} from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'

export default function StudentClassroomDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [classroom, setClassroom] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)

  // Xem tài liệu trong modal preview
  const [viewingDoc, setViewingDoc] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [classData, docsData] = await Promise.all([
        getClassroom(id),
        getClassroomDocuments(id),
      ])
      setClassroom(classData)
      setDocuments(docsData || [])
    } catch {
      notify('Không thể tải thông tin lớp học.', 'error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Sao chép mã lớp vào bộ nhớ tạm
  const handleCopyCode = () => {
    if (!classroom?.code) return
    navigator.clipboard.writeText(classroom.code)
    setCopiedCode(true)
    notify(`Đã sao chép mã lớp "${classroom.code}"!`)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // Tải file tài liệu gốc về máy
  const handleDownload = async (doc, e) => {
    if (e) e.stopPropagation()
    try {
      const url = await getDownloadUrl(doc.id)
      if (url) {
        window.open(url, '_blank')
      } else {
        notify('Không tìm thấy liên kết tải file.', 'error')
      }
    } catch {
      notify('Tải file thất bại.', 'error')
    }
  }

  // Lọc tài liệu theo từ khóa tìm kiếm
  const filteredDocuments = documents.filter((doc) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (doc.name || '').toLowerCase().includes(q) ||
      (doc.title || '').toLowerCase().includes(q) ||
      (doc.description || '').toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid #000000',
            borderTopColor: '#3b66f5',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontWeight: 800, fontSize: 16, color: '#374151' }}>
          Đang tải lớp học và tài liệu...
        </p>
      </div>
    )
  }

  if (!classroom) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center', padding: '0 20px' }}>
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '3px solid #000000',
            borderRadius: 16,
            boxShadow: '5px 5px 0px #000000',
            padding: 32,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>
            Không tìm thấy lớp học
          </h2>
          <p style={{ color: '#4b5563', marginBottom: 20 }}>
            Lớp học này có thể không tồn tại hoặc bạn chưa được thêm vào lớp.
          </p>
          <Link
            to="/student/classes"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 20px',
              backgroundColor: '#3b66f5',
              color: '#ffffff',
              fontWeight: 800,
              borderRadius: 10,
              border: '2px solid #000000',
              textDecoration: 'none',
              boxShadow: '2px 2px 0px #000000',
            }}
          >
            <ChevronLeftIcon size={18} /> Quay lại danh sách lớp
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* Nút quay lại */}
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/student/classes"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13.5,
            fontWeight: 800,
            color: '#000000',
            textDecoration: 'none',
            backgroundColor: '#ffffff',
            border: '2px solid #000000',
            borderRadius: 10,
            padding: '7px 14px',
            boxShadow: '2px 2px 0px #000000',
            transition: 'transform 0.1s ease',
          }}
        >
          <ChevronLeftIcon size={16} /> Danh sách lớp học
        </Link>
      </div>

      {/* Banner thông tin lớp học */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '3px solid #000000',
          borderRadius: 18,
          boxShadow: '5px 5px 0px #000000',
          padding: '28px 32px',
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 900,
                fontSize: 13.5,
                backgroundColor: '#f1f5f9',
                border: '2px solid #000000',
                borderRadius: 8,
                padding: '4px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Mã: {classroom.code}
              <button
                type="button"
                onClick={handleCopyCode}
                title="Sao chép mã lớp"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  color: copiedCode ? '#10b981' : '#4b5563',
                }}
              >
                {copiedCode ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              </button>
            </span>

            {classroom.subject && (
              <span
                style={{
                  backgroundColor: '#E5F970',
                  border: '2px solid #000000',
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: '#000000',
                }}
              >
                {classroom.subject}
              </span>
            )}

            <span
              style={{
                backgroundColor: '#dcfce7',
                color: '#15803d',
                border: '1.5px solid #16a34a',
                borderRadius: 8,
                padding: '3px 9px',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              Đang tham gia
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 13.5,
              fontWeight: 700,
              color: '#374151',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ArchiveIcon size={16} /> {documents.length} tài liệu môn học
            </span>
          </div>
        </div>

        <h1
          style={{
            fontSize: 26,
            fontWeight: 900,
            margin: '0 0 10px 0',
            color: '#000000',
            lineHeight: 1.25,
          }}
        >
          {classroom.name}
        </h1>

        <p
          style={{
            fontSize: 14.5,
            color: '#4b5563',
            margin: 0,
            lineHeight: 1.5,
            maxWidth: 820,
          }}
        >
          {classroom.description || 'Không có mô tả chi tiết cho lớp học này.'}
        </p>
      </div>

      {/* Thông báo cách ly tài liệu */}
      <div
        style={{
          backgroundColor: '#eff6ff',
          border: '2.5px solid #3b82f6',
          borderRadius: 14,
          padding: '14px 18px',
          boxShadow: '3px 3px 0px #3b82f6',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BookOpenIcon size={18} />
        </div>
        <div style={{ fontSize: 13.5, color: '#1e3a8a', lineHeight: 1.4 }}>
          <strong>Tài liệu học tập cô lập:</strong> Tất cả tài liệu dưới đây chỉ thuộc riêng lớp học này và được giảng viên quản lý. Bạn có thể xem trước, tải về, sinh Flashcard và làm đề thi trắc nghiệm Quiz trực tiếp từ tài liệu.
        </div>
      </div>

      {/* Thanh tiêu đề danh sách tài liệu + Tìm kiếm */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: '#000000' }}>
          Tài liệu bài giảng ({documents.length})
        </h2>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            backgroundColor: '#ffffff',
            border: '2px solid #000000',
            borderRadius: 10,
            padding: '8px 14px',
            boxShadow: '2.5px 2.5px 0px #000000',
            width: '100%',
            maxWidth: 360,
          }}
        >
          <SearchIcon size={16} style={{ color: '#6b7280' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tài liệu bài giảng..."
            style={{
              border: 'none',
              outline: 'none',
              fontSize: 13.5,
              fontWeight: 600,
              width: '100%',
              backgroundColor: 'transparent',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12,
                color: '#6b7280',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Danh sách tài liệu */}
      {filteredDocuments.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '2.5px solid #000000',
            borderRadius: 16,
            boxShadow: '4px 4px 0px #000000',
            padding: '40px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: '#f1f5f9',
              border: '2px solid #000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <ArchiveIcon size={24} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px 0' }}>
            {search ? 'Không tìm thấy tài liệu phù hợp' : 'Chưa có tài liệu nào'}
          </h3>
          <p style={{ fontSize: 13.5, color: '#6b7280', margin: 0 }}>
            {search
              ? 'Vui lòng kiểm tra lại từ khóa tìm kiếm.'
              : 'Giảng viên chưa tải tài liệu nào lên lớp học này. Vui lòng quay lại sau.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              style={{
                backgroundColor: '#ffffff',
                border: '2.5px solid #000000',
                borderRadius: 14,
                boxShadow: '3px 3px 0px #000000',
                padding: '18px 22px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                transition: 'transform 0.1s ease',
              }}
            >
              {/* Thông tin tài liệu */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: '1 1 340px' }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    backgroundColor: '#f1f5f9',
                    border: '2px solid #000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FileTextIcon size={22} />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        backgroundColor: '#000000',
                        color: '#ffffff',
                        padding: '2px 6px',
                        borderRadius: 5,
                        textTransform: 'uppercase',
                      }}
                    >
                      {doc.type || 'FILE'}
                    </span>

                    {doc.aiStatus === 'indexed' ? (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          border: '1px solid #16a34a',
                          padding: '1px 7px',
                          borderRadius: 6,
                        }}
                      >
                        ✓ AI Sẵn sàng
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #d97706',
                          padding: '1px 7px',
                          borderRadius: 6,
                        }}
                      >
                        Đang phân tích
                      </span>
                    )}

                    {doc.uploadedAt && (
                      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                        {doc.uploadedAt}
                      </span>
                    )}
                  </div>

                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      margin: '0 0 4px 0',
                      color: '#000000',
                      lineHeight: 1.35,
                    }}
                  >
                    {doc.name || doc.title}
                  </h3>

                  {doc.description && (
                    <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.4 }}>
                      {doc.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Nút hành động học tập & xem tài liệu */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {/* Xem trước */}
                <button
                  type="button"
                  onClick={() => setViewingDoc(doc)}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontWeight: 750,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0px #000000',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title="Xem trước nội dung tài liệu"
                >
                  <EyeIcon size={15} /> Xem trước
                </button>

                {/* Tải về */}
                <button
                  type="button"
                  onClick={(e) => handleDownload(doc, e)}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontWeight: 750,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0px #000000',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title="Tải file gốc về máy"
                >
                  <DownloadIcon size={15} /> Tải về
                </button>

                {/* Sinh Flashcard AI */}
                <button
                  type="button"
                  onClick={() => navigate(`/student/study/${doc.id}?tab=flashcards`, { state: { classroomId: classroom.id } })}
                  style={{
                    backgroundColor: '#fffbeb',
                    color: '#b45309',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    padding: '8px 13px',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0px #000000',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title="Tạo thẻ ghi nhớ Flashcard từ tài liệu này"
                >
                  <SparklesIcon size={15} /> Flashcard
                </button>

                {/* Làm Quiz kiểm tra */}
                <button
                  type="button"
                  onClick={() => navigate(`/student/study/${doc.id}?tab=quiz`, { state: { classroomId: classroom.id } })}
                  style={{
                    backgroundColor: '#f5f3ff',
                    color: '#6d28d9',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    padding: '8px 13px',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0px #000000',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title="Làm đề thi trắc nghiệm Quiz theo tài liệu này"
                >
                  <HelpIcon size={15} /> Làm Quiz
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal xem trước tài liệu */}
      {viewingDoc && (
        <DocumentViewerModal
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
          getDownloadUrl={getDownloadUrl}
        />
      )}
    </div>
  )
}
