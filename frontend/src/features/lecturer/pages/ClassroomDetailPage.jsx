import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getClassroom,
  getClassroomDocuments,
  uploadClassroomDocument,
  getClassroomStudents,
  addStudentToClassroom,
  removeStudentFromClassroom,
} from '../services/classroomService'
import { deleteDocument, getDownloadUrl } from '../services/documentService'
import DocumentViewerModal from '../../../components/common/DocumentViewerModal.jsx'
import {
  BookOpenIcon,
  UploadIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
  ArchiveIcon,
  FileTextIcon,
  SparklesIcon,
} from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'

const ACCEPT = '.pdf,.docx,.pptx,.txt,.md,.markdown,.mp4,.webm,.mov,.mkv,.avi'

export default function ClassroomDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [classroom, setClassroom] = useState(null)
  const [documents, setDocuments] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('documents') // 'documents' | 'students'

  // Modal tải tài liệu lên lớp
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  // Modal thêm sinh viên vào lớp
  const [showAddStudentModal, setShowAddStudentModal] = useState(false)
  const [studentCode, setStudentCode] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [studentNote, setStudentNote] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)
  const [studentError, setStudentError] = useState('')

  // Xem chi tiết tài liệu
  const [viewingDoc, setViewingDoc] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [classData, docsData, studentsData] = await Promise.all([
        getClassroom(id),
        getClassroomDocuments(id),
        getClassroomStudents(id),
      ])
      setClassroom(classData)
      setDocuments(docsData)
      setStudents(studentsData)
    } catch (err) {
      console.error(err)
      notify('Không thể tải thông tin lớp học.', 'error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Xử lý upload tài liệu cô lập cho lớp
  const handleUploadSubmit = async (e) => {
    e.preventDefault()
    if (!uploadFile) {
      setUploadError('Vui lòng chọn tệp tài liệu.')
      return
    }

    setUploading(true)
    setUploadError('')
    try {
      await uploadClassroomDocument(id, {
        file: uploadFile,
        title: uploadTitle.trim() || uploadFile.name,
        description: uploadDesc.trim(),
      })
      notify(`Đã tải tài liệu lên lớp ${classroom?.name || ''} thành công!`)
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadTitle('')
      setUploadDesc('')
      // Tải lại danh sách tài liệu
      const updatedDocs = await getClassroomDocuments(id)
      setDocuments(updatedDocs)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Tải lên thất bại. Vui lòng thử lại.'
      setUploadError(typeof msg === 'string' ? msg : 'Lỗi hệ thống khi tải tệp.')
    } finally {
      setUploading(false)
    }
  }

  // Xử lý xóa tài liệu
  const handleDeleteDocument = async (doc) => {
    if (!window.confirm(`Xác nhận xóa tài liệu "${doc.name}" khỏi lớp học này?`)) return
    try {
      await deleteDocument(doc.id)
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      notify('Đã xóa tài liệu khỏi lớp học.')
    } catch (err) {
      notify('Xóa tài liệu thất bại.', 'error')
    }
  }

  // Xử lý tải xuống tài liệu gốc
  const handleDownloadDocument = async (doc) => {
    try {
      const url = await getDownloadUrl(doc.id)
      if (url) window.open(url, '_blank')
      else notify('Không có đường dẫn tải tệp.', 'error')
    } catch {
      notify('Không thể lấy liên kết tải tệp.', 'error')
    }
  }

  // Xử lý thêm sinh viên vào lớp
  const handleAddStudentSubmit = async (e) => {
    e.preventDefault()
    if (!studentCode.trim() || !studentName.trim()) {
      setStudentError('Vui lòng nhập mã sinh viên và họ tên.')
      return
    }

    setAddingStudent(true)
    setStudentError('')
    try {
      await addStudentToClassroom(id, {
        student_code: studentCode.trim(),
        full_name: studentName.trim(),
        email: studentEmail.trim() || null,
        note: studentNote.trim() || null,
      })
      notify('Đã thêm sinh viên vào lớp thành công!')
      setShowAddStudentModal(false)
      setStudentCode('')
      setStudentName('')
      setStudentEmail('')
      setStudentNote('')
      // Tải lại danh sách sinh viên
      const updatedStudents = await getClassroomStudents(id)
      setStudents(updatedStudents)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Thêm sinh viên thất bại.'
      setStudentError(typeof msg === 'string' ? msg : 'Lỗi khi thêm sinh viên.')
    } finally {
      setAddingStudent(false)
    }
  }

  // Xử lý gỡ sinh viên khỏi lớp
  const handleRemoveStudent = async (st) => {
    if (!window.confirm(`Gỡ sinh viên "${st.full_name}" (${st.student_code}) khỏi lớp?`)) return
    try {
      await removeStudentFromClassroom(id, st.id)
      setStudents((prev) => prev.filter((s) => s.id !== st.id))
      notify('Đã gỡ sinh viên khỏi lớp.')
    } catch {
      notify('Gỡ sinh viên thất bại.', 'error')
    }
  }

  // Sao chép mã lớp học
  const copyClassCode = () => {
    if (classroom?.code) {
      navigator.clipboard.writeText(classroom.code)
      notify('Đã sao chép mã lớp vào bộ nhớ tạm!')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <p className="dmrs-muted">Đang tải dữ liệu lớp học...</p>
      </div>
    )
  }

  if (!classroom) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <h2>Không tìm thấy lớp học</h2>
        <button
          className="dmrs-btn dmrs-btn--light"
          style={{ marginTop: 16 }}
          onClick={() => navigate('/lecturer/classes')}
        >
          ← Quay lại danh sách lớp
        </button>
      </div>
    )
  }

  return (
    <div className="lec-page-anim" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Breadcrumb & Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={() => navigate('/lecturer/classes')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
            color: '#1f2937',
            padding: 0,
          }}
        >
          ← Quay lại danh sách lớp học
        </button>
      </div>

      {/* Classroom Hero Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '2.5px solid #000000',
          borderRadius: 16,
          boxShadow: '4px 4px 0px #000000',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#000000', letterSpacing: '-0.5px' }}>
                {classroom.name}
              </h1>
              {classroom.subject && (
                <span
                  style={{
                    backgroundColor: '#E5F970',
                    border: '1.5px solid #000000',
                    borderRadius: 6,
                    padding: '2px 10px',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {classroom.subject}
                </span>
              )}
            </div>
            <p style={{ margin: 0, color: '#4b5563', fontSize: 14.5, fontWeight: 500 }}>
              {classroom.description || 'Không có mô tả cho lớp học này.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Mã lớp với nút copy */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#f1f5f9',
                border: '2px solid #000000',
                borderRadius: 10,
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              <span style={{ color: '#64748b', fontSize: 12 }}>MÃ LỚP:</span>
              <strong style={{ fontFamily: 'monospace', fontSize: 15 }}>{classroom.code}</strong>
              <button
                type="button"
                onClick={copyClassCode}
                title="Sao chép mã lớp"
                style={{
                  background: '#ffffff',
                  border: '1px solid #000000',
                  borderRadius: 6,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Isolation Notice Banner */}
        <div
          style={{
            backgroundColor: '#EFF6FF',
            border: '2px solid #2563EB',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              backgroundColor: '#2563EB',
              color: '#ffffff',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            🔒
          </div>
          <div style={{ fontSize: 13.5, color: '#1e3a8a', lineHeight: 1.4 }}>
            <strong>Không gian dữ liệu cô lập tuyệt đối:</strong> Mọi tài liệu tải lên lớp học này chỉ dành riêng cho{' '}
            <strong>{classroom.name}</strong>. Các lớp học khác và kho tài liệu ngoài sẽ không thể nhìn thấy hoặc truy cập vào dữ liệu này.
          </div>
        </div>

        {/* Quick Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 4 }}>
          <div
            style={{
              backgroundColor: '#fafafa',
              border: '2px solid #000000',
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Tài liệu riêng</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#000000', marginTop: 4 }}>{documents.length}</div>
          </div>
          <div
            style={{
              backgroundColor: '#fafafa',
              border: '2px solid #000000',
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Sinh viên tham gia</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#000000', marginTop: 4 }}>
              {students.length} <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>(Không giới hạn)</span>
            </div>
          </div>
          <div
            style={{
              backgroundColor: '#fafafa',
              border: '2px solid #000000',
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Trạng thái cô lập</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#059669', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }}></span>
              Bảo mật lớp học
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '2.5px solid #000000', paddingBottom: 0 }}>
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          style={{
            padding: '12px 20px',
            fontWeight: 800,
            fontSize: 15,
            border: '2px solid #000000',
            borderBottom: activeTab === 'documents' ? '2px solid #ffffff' : '2px solid #000000',
            marginBottom: -2.5,
            backgroundColor: activeTab === 'documents' ? '#ffffff' : '#f1f5f9',
            borderRadius: '10px 10px 0 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ArchiveIcon size={18} /> Tài liệu lớp học ({documents.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('students')}
          style={{
            padding: '12px 20px',
            fontWeight: 800,
            fontSize: 15,
            border: '2px solid #000000',
            borderBottom: activeTab === 'students' ? '2px solid #ffffff' : '2px solid #000000',
            marginBottom: -2.5,
            backgroundColor: activeTab === 'students' ? '#ffffff' : '#f1f5f9',
            borderRadius: '10px 10px 0 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <UsersIcon size={18} /> Danh sách sinh viên ({students.length})
        </button>
      </div>

      {/* TAB CONTENT: TÀI LIỆU */}
      {activeTab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Kho tài liệu riêng của lớp</h2>
              <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: 13.5 }}>
                Tài liệu ở đây được xử lý vector RAG riêng và không rò rỉ sang các lớp khác.
              </p>
            </div>
            <button
              type="button"
              className="lec-btn-create"
              onClick={() => {
                setShowUploadModal(true)
                setUploadError('')
              }}
            >
              <span className="lec-plus-icon">+</span> Tải tài liệu lên lớp này
            </button>
          </div>

          {documents.length === 0 ? (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '2px dashed #000000',
                borderRadius: 14,
                padding: '48px 24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 42, marginBottom: 12 }}>📚</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0' }}>Chưa có tài liệu nào trong lớp này</h3>
              <p style={{ color: '#6b7280', fontSize: 14, maxWidth: 460, margin: '0 auto 20px auto' }}>
                Hãy tải lên giáo trình, bài tập, slide hoặc tài liệu chuyên ngành dành riêng cho các sinh viên lớp{' '}
                <strong>{classroom.name}</strong>.
              </p>
              <button
                type="button"
                className="lec-btn-create"
                onClick={() => {
                  setShowUploadModal(true)
                  setUploadError('')
                }}
              >
                <UploadIcon size={16} /> Tải tài liệu ngay
              </button>
            </div>
          ) : (
            <div className="lec-table-box">
              <table className="lec-subm-table">
                <thead>
                  <tr>
                    <th>Tên tài liệu</th>
                    <th>Loại</th>
                    <th>Trạng thái AI</th>
                    <th>Ngày tải lên</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className="lec-student-name" style={{ fontSize: 14.5 }}>
                            {doc.name}
                          </span>
                          {doc.description && (
                            <span style={{ fontSize: 12.5, color: '#6b7280' }}>{doc.description}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            backgroundColor: '#f1f5f9',
                            border: '1.5px solid #000000',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontWeight: 800,
                            fontSize: 11.5,
                          }}
                        >
                          {doc.type || 'DOC'}
                        </span>
                      </td>
                      <td>
                        {doc.aiStatus === 'indexed' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              border: '1.5px solid #16a34a',
                              borderRadius: 6,
                              padding: '2px 8px',
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
                            Sẵn sàng AI
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                              border: '1.5px solid #d97706',
                              borderRadius: 6,
                              padding: '2px 8px',
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#d97706' }}></span>
                            Đang xử lý
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="lec-subm-date">{doc.uploadedAt || 'Mới đây'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <button
                            type="button"
                            className="dmrs-btn dmrs-btn--light"
                            style={{ padding: '4px 10px', fontSize: 12.5 }}
                            onClick={() => setViewingDoc(doc)}
                          >
                            Xem
                          </button>
                          <button
                            type="button"
                            className="dmrs-btn dmrs-btn--light"
                            style={{ padding: '4px 10px', fontSize: 12.5 }}
                            onClick={() => handleDownloadDocument(doc)}
                          >
                            Tải về
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc)}
                            style={{
                              background: '#fee2e2',
                              border: '1.5px solid #ef4444',
                              color: '#b91c1c',
                              borderRadius: 6,
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="Xóa tài liệu"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: SINH VIÊN */}
      {activeTab === 'students' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Danh sách sinh viên trong lớp</h2>
              <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: 13.5 }}>
                Chỉ những sinh viên được thêm vào lớp mới có quyền truy cập vào tài liệu và bài tập của lớp này.
              </p>
            </div>
            <button
              type="button"
              className="lec-btn-create"
              onClick={() => {
                setShowAddStudentModal(true)
                setStudentError('')
              }}
            >
              <PlusIcon size={16} /> Thêm sinh viên
            </button>
          </div>

          {students.length === 0 ? (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '2px dashed #000000',
                borderRadius: 14,
                padding: '48px 24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 42, marginBottom: 12 }}>👥</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0' }}>Chưa có sinh viên nào trong lớp này</h3>
              <p style={{ color: '#6b7280', fontSize: 14, maxWidth: 460, margin: '0 auto 20px auto' }}>
                Thêm danh sách sinh viên tham gia lớp {classroom.name} để cấp quyền học tập.
              </p>
              <button
                type="button"
                className="lec-btn-create"
                onClick={() => {
                  setShowAddStudentModal(true)
                  setStudentError('')
                }}
              >
                <PlusIcon size={16} /> Thêm sinh viên ngay
              </button>
            </div>
          ) : (
            <div className="lec-table-box">
              <table className="lec-subm-table">
                <thead>
                  <tr>
                    <th>Mã SV</th>
                    <th>Họ và tên</th>
                    <th>Email</th>
                    <th>Ghi chú</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => (
                    <tr key={st.id}>
                      <td>
                        <strong style={{ fontFamily: 'monospace', fontSize: 13.5 }}>{st.student_code}</strong>
                      </td>
                      <td>
                        <span className="lec-student-name">{st.full_name}</span>
                      </td>
                      <td>
                        <span style={{ color: '#4b5563', fontSize: 13 }}>{st.email || '—'}</span>
                      </td>
                      <td>
                        <span style={{ color: '#6b7280', fontSize: 13 }}>{st.note || '—'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveStudent(st)}
                            style={{
                              background: '#fee2e2',
                              border: '1.5px solid #ef4444',
                              color: '#b91c1c',
                              borderRadius: 6,
                              padding: '4px 10px',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            Gỡ khỏi lớp
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: TẢI TÀI LIỆU LÊN LỚP (CÔ LẬP) */}
      {showUploadModal && (
        <div
          className="lec-brutal-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => !uploading && setShowUploadModal(false)}
        >
          <div
            className="lec-brutal-modal-content"
            style={{
              backgroundColor: '#ffffff',
              border: '3px solid #000000',
              borderRadius: 16,
              boxShadow: '6px 6px 0px #000000',
              padding: 28,
              width: 520,
              maxWidth: '95vw',
              boxSizing: 'border-box',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lec-brutal-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '2.5px solid #000000' }}>
              <h2 className="lec-brutal-modal-title" style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#000000' }}>
                Tải tài liệu vào {classroom.name}
              </h2>
              <button
                type="button"
                className="lec-brutal-modal-close"
                style={{
                  background: '#ffffff',
                  border: '2px solid #000000',
                  boxShadow: '2px 2px 0px #000000',
                  borderRadius: 8,
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 15,
                }}
                onClick={() => !uploading && setShowUploadModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="lec-brutal-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  backgroundColor: '#EFF6FF',
                  border: '1.5px solid #2563EB',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12.5,
                  color: '#1e3a8a',
                  marginBottom: 6,
                }}
              >
                🔒 Tài liệu này sẽ được cô lập riêng cho lớp <strong>{classroom.name}</strong> ({classroom.code}).
              </div>

              {/* File Dropzone */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setUploadFile(f)
                    if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ''))
                  }
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #000000',
                  borderRadius: 10,
                  padding: '24px 16px',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>📤</div>
                {uploadFile ? (
                  <div>
                    <strong style={{ fontSize: 14, color: '#2563eb' }}>{uploadFile.name}</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>Nhấp để chọn tệp khác</p>
                  </div>
                ) : (
                  <div>
                    <strong style={{ fontSize: 14 }}>Nhấp để chọn tệp tài liệu</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>
                      Hỗ trợ PDF, DOCX, PPTX, TXT, Video (MP4)
                    </p>
                  </div>
                )}
              </div>

              <div className="lec-brutal-form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="lec-brutal-label" style={{ fontSize: 13.5, fontWeight: 700, color: '#000000' }}>
                  Tiêu đề tài liệu
                </label>
                <input
                  type="text"
                  className="lec-brutal-input"
                  placeholder="Nhập tiêu đề hoặc tên bài giảng..."
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    fontSize: 14,
                    outline: 'none',
                    background: '#ffffff',
                    color: '#000000',
                  }}
                />
              </div>

              <div className="lec-brutal-form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="lec-brutal-label" style={{ fontSize: 13.5, fontWeight: 700, color: '#000000' }}>
                  Mô tả tóm tắt (tùy chọn)
                </label>
                <textarea
                  className="lec-brutal-input"
                  rows={2}
                  placeholder="Mô tả nội dung tài liệu..."
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    fontSize: 14,
                    outline: 'none',
                    background: '#ffffff',
                    color: '#000000',
                  }}
                />
              </div>

              {uploadError && (
                <p style={{ color: '#dc2626', fontSize: 13, margin: '4px 0 0 0', fontWeight: 600 }}>
                  {uploadError}
                </p>
              )}

              <div
                className="lec-brutal-modal-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                  marginTop: 8,
                  paddingTop: 14,
                  borderTop: '1.5px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="lec-brutal-btn-cancel"
                  disabled={uploading}
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    background: '#ffffff',
                    color: '#000000',
                    border: '2px solid #000000',
                    boxShadow: '2.5px 2.5px 0px #000000',
                    borderRadius: 8,
                    padding: '9px 18px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="lec-brutal-btn-confirm"
                  disabled={uploading}
                  style={{
                    background: '#3b66f5',
                    color: '#ffffff',
                    border: '2px solid #000000',
                    boxShadow: '2.5px 2.5px 0px #000000',
                    borderRadius: 8,
                    padding: '9px 20px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {uploading ? 'Đang tải lên...' : 'Lưu tài liệu vào lớp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: THÊM SINH VIÊN VÀO LỚP */}
      {showAddStudentModal && (
        <div
          className="lec-brutal-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => !addingStudent && setShowAddStudentModal(false)}
        >
          <div
            className="lec-brutal-modal-content"
            style={{
              backgroundColor: '#ffffff',
              border: '3px solid #000000',
              borderRadius: 16,
              boxShadow: '6px 6px 0px #000000',
              padding: 28,
              width: 500,
              maxWidth: '95vw',
              boxSizing: 'border-box',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lec-brutal-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '2.5px solid #000000' }}>
              <h2 className="lec-brutal-modal-title" style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#000000' }}>
                Thêm sinh viên vào {classroom.name}
              </h2>
              <button
                type="button"
                className="lec-brutal-modal-close"
                style={{
                  background: '#ffffff',
                  border: '2px solid #000000',
                  boxShadow: '2px 2px 0px #000000',
                  borderRadius: 8,
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 15,
                }}
                onClick={() => !addingStudent && setShowAddStudentModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStudentSubmit} className="lec-brutal-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1.5px solid #16A34A',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12.5,
                  color: '#166534',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>👥</span>
                <span>Lớp học không giới hạn sinh viên tham gia.</span>
              </div>

              <div className="lec-brutal-form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="lec-brutal-label" style={{ fontSize: 13.5, fontWeight: 700, color: '#000000' }}>
                  Mã sinh viên *
                </label>
                <input
                  type="text"
                  required
                  className="lec-brutal-input"
                  placeholder="Ví dụ: SV202601"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    fontSize: 14,
                    outline: 'none',
                    background: '#ffffff',
                    color: '#000000',
                  }}
                />
              </div>

              <div className="lec-brutal-form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="lec-brutal-label" style={{ fontSize: 13.5, fontWeight: 700, color: '#000000' }}>
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  className="lec-brutal-input"
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    fontSize: 14,
                    outline: 'none',
                    background: '#ffffff',
                    color: '#000000',
                  }}
                />
              </div>

              <div className="lec-brutal-form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="lec-brutal-label" style={{ fontSize: 13.5, fontWeight: 700, color: '#000000' }}>
                  Email (tùy chọn)
                </label>
                <input
                  type="email"
                  className="lec-brutal-input"
                  placeholder="student@example.edu.vn"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    fontSize: 14,
                    outline: 'none',
                    background: '#ffffff',
                    color: '#000000',
                  }}
                />
              </div>

              <div className="lec-brutal-form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="lec-brutal-label" style={{ fontSize: 13.5, fontWeight: 700, color: '#000000' }}>
                  Ghi chú (tùy chọn)
                </label>
                <input
                  type="text"
                  className="lec-brutal-input"
                  placeholder="Ví dụ: Nhóm trưởng, học lại..."
                  value={studentNote}
                  onChange={(e) => setStudentNote(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    fontSize: 14,
                    outline: 'none',
                    background: '#ffffff',
                    color: '#000000',
                  }}
                />
              </div>

              {studentError && (
                <p style={{ color: '#dc2626', fontSize: 13, margin: '4px 0 0 0', fontWeight: 600 }}>
                  {studentError}
                </p>
              )}

              <div
                className="lec-brutal-modal-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                  marginTop: 8,
                  paddingTop: 14,
                  borderTop: '1.5px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="lec-brutal-btn-cancel"
                  disabled={addingStudent}
                  onClick={() => setShowAddStudentModal(false)}
                  style={{
                    background: '#ffffff',
                    color: '#000000',
                    border: '2px solid #000000',
                    boxShadow: '2.5px 2.5px 0px #000000',
                    borderRadius: 8,
                    padding: '9px 18px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="lec-brutal-btn-confirm"
                  disabled={addingStudent}
                  style={{
                    background: '#3b66f5',
                    color: '#ffffff',
                    border: '2px solid #000000',
                    boxShadow: '2.5px 2.5px 0px #000000',
                    borderRadius: 8,
                    padding: '9px 20px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {addingStudent ? 'Đang thêm...' : 'Thêm sinh viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Xem nội dung tài liệu */}
      {viewingDoc && <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  )
}
