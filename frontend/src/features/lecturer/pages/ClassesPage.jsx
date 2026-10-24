import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getClassrooms,
  createClassroom,
  updateClassroom,
  deleteClassroom,
} from '../services/classroomService'
import {
  PlusIcon,
  BookOpenIcon,
  UsersIcon,
  ArchiveIcon,
  EditIcon,
  TrashIcon,
  SearchIcon,
} from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'

export default function ClassesPage() {
  const navigate = useNavigate()
  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal tạo lớp học
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Modal chỉnh sửa lớp học
  const [editingClass, setEditingClass] = useState(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const loadClassrooms = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getClassrooms()
      setClassrooms(data)
    } catch {
      notify('Không thể tải danh sách lớp học.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadClassrooms()
  }, [loadClassrooms])

  // Xử lý tạo mới
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Vui lòng nhập tên lớp học.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const created = await createClassroom({
        name,
        code,
        subject,
        description,
      })
      notify(`Đã tạo lớp "${created.name}" thành công!`)
      setShowCreateModal(false)
      setName('')
      setCode('')
      setSubject('')
      setDescription('')
      loadClassrooms()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Tạo lớp học thất bại.'
      setError(typeof msg === 'string' ? msg : 'Lỗi khi tạo lớp học.')
    } finally {
      setSaving(false)
    }
  }

  // Mở modal sửa
  const openEditModal = (c, e) => {
    e.stopPropagation()
    setEditingClass(c)
    setEditName(c.name)
    setEditCode(c.code)
    setEditSubject(c.subject || '')
    setEditDesc(c.description || '')
    setError('')
  }

  // Xử lý lưu sửa
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editName.trim()) {
      setError('Vui lòng nhập tên lớp học.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await updateClassroom(editingClass.id, {
        name: editName,
        code: editCode,
        subject: editSubject,
        description: editDesc,
      })
      notify('Cập nhật lớp học thành công!')
      setEditingClass(null)
      loadClassrooms()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Cập nhật lớp học thất bại.'
      setError(typeof msg === 'string' ? msg : 'Lỗi khi cập nhật.')
    } finally {
      setSaving(false)
    }
  }

  // Xử lý xóa lớp học
  const handleDelete = async (c, e) => {
    e.stopPropagation()
    if (!window.confirm(`Xác nhận xóa lớp "${c.name}"? Toàn bộ tài liệu cô lập trong lớp này cũng sẽ được dọn dẹp an toàn.`)) return
    try {
      await deleteClassroom(c.id)
      setClassrooms((prev) => prev.filter((item) => item.id !== c.id))
      notify(`Đã xóa lớp "${c.name}".`)
    } catch {
      notify('Xóa lớp học thất bại.', 'error')
    }
  }

  // Lọc lớp học theo từ khóa tìm kiếm
  const filteredClassrooms = classrooms.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q) ||
      (c.subject || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="lec-page-anim" style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="lec-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: '#E5F970',
              border: '2px solid #000000',
              boxShadow: '2px 2px 0px #000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#000000',
            }}
          >
            <BookOpenIcon size={24} />
          </div>
          <div>
            <h1 className="lec-header-title">Quản lý Lớp học</h1>
            <p className="lec-header-sub">
              Mỗi lớp học sở hữu không gian tài liệu riêng biệt, đảm bảo cô lập 100% và không bị rò rỉ ra ngoài.
            </p>
          </div>
        </div>

        <div className="lec-header-actions">
          <button
            type="button"
            className="lec-btn-create"
            onClick={() => {
              setShowCreateModal(true)
              setError('')
            }}
          >
            <PlusIcon size={18} /> Tạo lớp học mới
          </button>
        </div>
      </div>

      {/* Info Badge */}
      <div
        style={{
          backgroundColor: '#F0FDF4',
          border: '2px solid #16A34A',
          boxShadow: '2px 2px 0px #000000',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 20 }}>💡</span>
        <span style={{ fontSize: 13.5, color: '#166534', fontWeight: 600 }}>
          <strong>Cơ chế cô lập tài liệu:</strong> Khi tải tài liệu vào một lớp học, tài liệu đó chỉ phục vụ sinh viên trong lớp đó. Giảng viên và sinh viên lớp khác không thể nhìn thấy tài liệu này trong kho thư viện.
        </span>
      </div>

      {/* Tabs & Thanh tìm kiếm */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 800,
              border: '2px solid #000000',
              cursor: 'pointer',
              backgroundColor: '#000000',
              color: '#ffffff',
              boxShadow: '2.5px 2.5px 0px #3b66f5',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Tất cả lớp học
            <span
              style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 6,
                backgroundColor: '#3b66f5',
                color: '#ffffff',
              }}
            >
              {classrooms.length}
            </span>
          </button>
        </div>

        {/* Ô tìm kiếm */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            backgroundColor: '#ffffff',
            border: '2px solid #000000',
            borderRadius: 10,
            padding: '9px 14px',
            boxShadow: '2.5px 2.5px 0px #000000',
            width: '100%',
            maxWidth: 380,
          }}
        >
          <SearchIcon size={18} style={{ color: '#6b7280' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên lớp, mã lớp, môn học..."
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
                fontSize: 13,
                color: '#6b7280',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <p className="dmrs-muted">Đang tải danh sách lớp học...</p>
        </div>
      ) : filteredClassrooms.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '2.5px dashed #000000',
            boxShadow: '4px 4px 0px #000000',
            borderRadius: 16,
            padding: '56px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏫</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px 0', color: '#000000' }}>
            {search ? 'Không tìm thấy lớp học phù hợp' : 'Chưa có lớp học nào'}
          </h2>
          <p style={{ color: '#6b7280', fontSize: 14.5, maxWidth: 440, margin: '0 auto 24px auto' }}>
            {search
              ? 'Thử tìm với từ khóa khác hoặc xóa ô tìm kiếm.'
              : 'Bắt đầu tạo lớp học đầu tiên của bạn để tải giáo trình, tài liệu chuyên biệt và quản lý sinh viên.'}
          </p>
          <button
            type="button"
            className="lec-btn-create"
            onClick={() => {
              if (search) setSearch('')
              else setShowCreateModal(true)
            }}
          >
            <PlusIcon size={18} /> {search ? 'Xem tất cả lớp học' : 'Tạo lớp học ngay'}
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 22,
          }}
        >
          {filteredClassrooms.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/lecturer/classes/${c.id}`)}
              style={{
                backgroundColor: '#ffffff',
                border: '2.5px solid #000000',
                borderRadius: 16,
                boxShadow: '4px 4px 0px #000000',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 16,
                cursor: 'pointer',
                transition: 'transform 0.12s ease, box-shadow 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translate(-2px, -2px)'
                e.currentTarget.style.boxShadow = '6px 6px 0px #3b66f5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translate(0px, 0px)'
                e.currentTarget.style.boxShadow = '4px 4px 0px #000000'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        fontSize: 12,
                        backgroundColor: '#f1f5f9',
                        border: '1.5px solid #000000',
                        borderRadius: 6,
                        padding: '2px 8px',
                      }}
                    >
                      {c.code}
                    </span>
                    {c.subject && (
                      <span
                        style={{
                          backgroundColor: '#E5F970',
                          border: '1.5px solid #000000',
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontSize: 11.5,
                          fontWeight: 800,
                          color: '#000000',
                        }}
                      >
                        {c.subject}
                      </span>
                    )}
                  </div>
                </div>

                <h3
                  style={{
                    fontSize: 19,
                    fontWeight: 900,
                    margin: '0 0 6px 0',
                    color: '#000000',
                    lineHeight: 1.3,
                  }}
                >
                  {c.name}
                </h3>

                <p
                  style={{
                    fontSize: 13.5,
                    color: '#4b5563',
                    margin: 0,
                    lineHeight: 1.45,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {c.description || 'Không có mô tả lớp học.'}
                </p>
              </div>

              <div>
                {/* Stats row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    paddingTop: 14,
                    borderTop: '1.5px solid #e5e7eb',
                    fontSize: 13,
                    color: '#374151',
                    fontWeight: 650,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ArchiveIcon size={15} /> {c.document_count ?? 0} tài liệu
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <UsersIcon size={15} /> {c.student_count ?? 0} sinh viên
                  </span>
                </div>

                {/* Actions row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px dashed #e2e8f0',
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/lecturer/classes/${c.id}`)
                    }}
                    style={{
                      backgroundColor: '#3b66f5',
                      color: '#ffffff',
                      border: '2px solid #000000',
                      boxShadow: '2px 2px 0px #000000',
                      borderRadius: 10,
                      padding: '7px 14px',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Vào quản lý lớp →
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={(e) => openEditModal(c, e)}
                      title="Chỉnh sửa lớp học"
                      style={{
                        background: '#f8fafc',
                        border: '1.5px solid #000000',
                        boxShadow: '1.5px 1.5px 0px #000000',
                        borderRadius: 8,
                        padding: '6px 9px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <EditIcon size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(c, e)}
                      title="Xóa lớp học"
                      style={{
                        background: '#fee2e2',
                        border: '1.5px solid #ef4444',
                        boxShadow: '1.5px 1.5px 0px #ef4444',
                        color: '#b91c1c',
                        borderRadius: 8,
                        padding: '6px 9px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <TrashIcon size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL TẠO LỚP HỌC */}
      {showCreateModal && (
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
          onClick={() => !saving && setShowCreateModal(false)}
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
                Tạo lớp học mới
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
                onClick={() => !saving && setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="lec-brutal-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="lec-brutal-form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="lec-brutal-label" style={{ fontSize: 13.5, fontWeight: 700, color: '#000000' }}>
                  Tên lớp học *
                </label>
                <input
                  type="text"
                  required
                  className="lec-brutal-input"
                  placeholder="Ví dụ: Lập trình C (Nhóm 01)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  Môn học
                </label>
                <input
                  type="text"
                  className="lec-brutal-input"
                  placeholder="Ví dụ: Lập trình C, Trí tuệ nhân tạo..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
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
                  Mã lớp học (tùy chọn - để trống sẽ tự sinh)
                </label>
                <input
                  type="text"
                  className="lec-brutal-input"
                  placeholder="Ví dụ: C_PROG_01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
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
                  Mô tả lớp học
                </label>
                <textarea
                  className="lec-brutal-input"
                  rows={3}
                  placeholder="Mô tả thông tin giảng dạy, lịch học hoặc chú thích..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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

              {error && (
                <p style={{ color: '#dc2626', fontSize: 13, margin: '4px 0 0 0', fontWeight: 600 }}>
                  {error}
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
                  disabled={saving}
                  onClick={() => setShowCreateModal(false)}
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
                  disabled={saving}
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
                  {saving ? 'Đang tạo...' : 'Tạo lớp học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SỬA LỚP HỌC */}
      {editingClass && (
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
          onClick={() => !saving && setEditingClass(null)}
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
                Chỉnh sửa lớp học
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
                onClick={() => !saving && setEditingClass(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="lec-brutal-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="lec-brutal-form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="lec-brutal-label" style={{ fontSize: 13.5, fontWeight: 700, color: '#000000' }}>
                  Tên lớp học *
                </label>
                <input
                  type="text"
                  required
                  className="lec-brutal-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                  Môn học
                </label>
                <input
                  type="text"
                  className="lec-brutal-input"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
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
                  Mã lớp học
                </label>
                <input
                  type="text"
                  className="lec-brutal-input"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
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
                  Mô tả lớp học
                </label>
                <textarea
                  className="lec-brutal-input"
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
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

              {error && (
                <p style={{ color: '#dc2626', fontSize: 13, margin: '4px 0 0 0', fontWeight: 600 }}>
                  {error}
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
                  disabled={saving}
                  onClick={() => setEditingClass(null)}
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
                  disabled={saving}
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
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
