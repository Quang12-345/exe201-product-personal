import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAllClassrooms,
  joinClassroom,
  leaveClassroom,
} from '../services/classroomService'
import {
  PlusIcon,
  BookOpenIcon,
  UsersIcon,
  ArchiveIcon,
  SearchIcon,
  ArrowRightIcon,
  TrashIcon,
  GraduationCapIcon,
  CheckIcon,
} from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'

export default function StudentClassesPage() {
  const navigate = useNavigate()
  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'enrolled' | 'available'

  // Modal tham gia lớp bằng mã code thủ công
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [classCode, setClassCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  // Trạng thái đang bấm tham gia nhanh trên card
  const [joiningCardId, setJoiningCardId] = useState(null)

  const loadClasses = useCallback(async () => {
    setLoading(true)
    try {
      // Lấy toàn bộ lớp học của tất cả giảng viên
      const data = await getAllClassrooms()
      setClassrooms(data || [])
    } catch {
      notify('Không thể tải danh sách lớp học.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  // Xử lý tham gia lớp bằng mã code nhập trong modal
  const handleJoinSubmit = async (e) => {
    e.preventDefault()
    const code = classCode.trim().toUpperCase()
    if (!code) {
      setJoinError('Vui lòng nhập mã lớp học.')
      return
    }

    setJoining(true)
    setJoinError('')
    try {
      const joined = await joinClassroom(code)
      notify(`Đã tham gia lớp "${joined.name}" thành công!`)
      setShowJoinModal(false)
      setClassCode('')
      await loadClasses()
      navigate(`/student/classes/${joined.id}`)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Tham gia lớp học thất bại. Vui lòng kiểm tra lại mã lớp.'
      setJoinError(typeof msg === 'string' ? msg : 'Mã lớp không hợp lệ.')
    } finally {
      setJoining(false)
    }
  }

  // Xử lý tham gia nhanh 1 chạm ngay trên card lớp học
  const handleQuickJoin = async (c, e) => {
    if (e) e.stopPropagation()
    setJoiningCardId(c.id)
    try {
      await joinClassroom(c.code)
      notify(`Đã tham gia lớp "${c.name}" thành công!`)
      // Cập nhật trạng thái tại chỗ
      setClassrooms((prev) =>
        prev.map((item) =>
          item.id === c.id
            ? { ...item, is_enrolled: true, student_count: (item.student_count || 0) + 1 }
            : item
        )
      )
      // Dẫn sinh viên vào luôn trang chi tiết lớp học
      navigate(`/student/classes/${c.id}`)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Không thể tham gia lớp học.'
      notify(typeof msg === 'string' ? msg : 'Lỗi khi tham gia lớp.', 'error')
    } finally {
      setJoiningCardId(null)
    }
  }

  // Xử lý rời khỏi lớp
  const handleLeaveClass = async (c, e) => {
    if (e) e.stopPropagation()
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn rời khỏi lớp "${c.name}"? Bạn có thể tham gia lại bất cứ lúc nào.`
      )
    ) {
      return
    }

    try {
      await leaveClassroom(c.id)
      notify(`Đã rời khỏi lớp "${c.name}".`)
      // Cập nhật trạng thái tại chỗ
      setClassrooms((prev) =>
        prev.map((item) =>
          item.id === c.id
            ? { ...item, is_enrolled: false, student_count: Math.max(0, (item.student_count || 1) - 1) }
            : item
        )
      )
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Không thể rời lớp học.'
      notify(typeof msg === 'string' ? msg : 'Lỗi khi rời lớp học.', 'error')
    }
  }

  // Số lượng phân loại
  const enrolledCount = classrooms.filter((c) => c.is_enrolled).length
  const availableCount = classrooms.filter((c) => !c.is_enrolled).length

  // Bộ lọc tìm kiếm và theo Tab
  const filteredClassrooms = classrooms.filter((c) => {
    // Lọc theo Tab
    if (filterTab === 'enrolled' && !c.is_enrolled) return false
    if (filterTab === 'available' && c.is_enrolled) return false

    // Lọc theo từ khóa tìm kiếm
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q) ||
      (c.subject || '').toLowerCase().includes(q) ||
      (c.lecturer_name || '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* Header khu vực Lớp học */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#E5F970',
                border: '2px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '2px 2px 0px #000000',
              }}
            >
              <BookOpenIcon size={22} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#000000' }}>
              Danh sách lớp học của các Giảng viên
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#4b5563' }}>
            Xem toàn bộ các lớp học hiện có của mọi giảng viên. Chọn lớp học của bạn để tham gia hoặc vào học ngay.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setClassCode('')
            setJoinError('')
            setShowJoinModal(true)
          }}
          style={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 14,
            padding: '11px 20px',
            borderRadius: 12,
            border: '2.5px solid #000000',
            boxShadow: '3px 3px 0px #000000',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'transform 0.1s ease, box-shadow 0.1s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translate(-2px, -2px)'
            e.currentTarget.style.boxShadow = '5px 5px 0px #000000'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translate(0px, 0px)'
            e.currentTarget.style.boxShadow = '3px 3px 0px #000000'
          }}
        >
          <PlusIcon size={18} /> Nhập mã tham gia lớp
        </button>
      </div>

      {/* Tabs phân loại & Thanh tìm kiếm */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 26,
        }}
      >
        {/* Tabs: Tất cả | Đã tham gia | Chưa tham gia */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 800,
              border: '2px solid #000000',
              cursor: 'pointer',
              backgroundColor: filterTab === 'all' ? '#000000' : '#ffffff',
              color: filterTab === 'all' ? '#ffffff' : '#000000',
              boxShadow: filterTab === 'all' ? '2.5px 2.5px 0px #3b66f5' : '2px 2px 0px #000000',
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
                backgroundColor: filterTab === 'all' ? '#3b66f5' : '#e5e7eb',
                color: filterTab === 'all' ? '#ffffff' : '#000000',
              }}
            >
              {classrooms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('enrolled')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 800,
              border: '2px solid #000000',
              cursor: 'pointer',
              backgroundColor: filterTab === 'enrolled' ? '#10b981' : '#ffffff',
              color: filterTab === 'enrolled' ? '#ffffff' : '#000000',
              boxShadow: '2px 2px 0px #000000',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Đã tham gia
            <span
              style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 6,
                backgroundColor: filterTab === 'enrolled' ? '#047857' : '#e5e7eb',
                color: filterTab === 'enrolled' ? '#ffffff' : '#000000',
              }}
            >
              {enrolledCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('available')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 800,
              border: '2px solid #000000',
              cursor: 'pointer',
              backgroundColor: filterTab === 'available' ? '#3b66f5' : '#ffffff',
              color: filterTab === 'available' ? '#ffffff' : '#000000',
              boxShadow: '2px 2px 0px #000000',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Chưa tham gia
            <span
              style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 6,
                backgroundColor: filterTab === 'available' ? '#1d4ed8' : '#e5e7eb',
                color: filterTab === 'available' ? '#ffffff' : '#000000',
              }}
            >
              {availableCount}
            </span>
          </button>
        </div>

        {/* Thanh tìm kiếm */}
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
            placeholder="Tìm theo tên lớp, môn, giảng viên..."
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

      {/* Trạng thái tải dữ liệu */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <div
            style={{
              width: 34,
              height: 34,
              border: '3px solid #000000',
              borderTopColor: '#3b66f5',
              borderRadius: '50%',
              margin: '0 auto 12px',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ fontWeight: 700, margin: 0 }}>Đang tải danh sách lớp học...</p>
        </div>
      ) : filteredClassrooms.length === 0 ? (
        /* Empty State */
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '3px solid #000000',
            borderRadius: 16,
            boxShadow: '5px 5px 0px #000000',
            padding: '50px 24px',
            textAlign: 'center',
            maxWidth: 540,
            margin: '20px auto',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: '#fef08a',
              border: '2px solid #000000',
              boxShadow: '3px 3px 0px #000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <BookOpenIcon size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 8px 0', color: '#000000' }}>
            {search ? 'Không tìm thấy lớp học phù hợp' : 'Không có lớp học nào trong danh mục này'}
          </h2>
          <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.5, margin: '0 0 20px 0' }}>
            {search
              ? 'Thử tìm với từ khóa khác hoặc xóa ô tìm kiếm.'
              : 'Hãy chọn tab "Tất cả lớp học" hoặc nhập mã lớp để tham gia.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterTab('all')
              setSearch('')
            }}
            style={{
              backgroundColor: '#f3f4f6',
              border: '2px solid #000000',
              borderRadius: 10,
              padding: '10px 20px',
              fontWeight: 800,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Xem tất cả lớp học
          </button>
        </div>
      ) : (
        /* Grid hiển thị TẤT CẢ các lớp học của mọi giảng viên */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 22,
          }}
        >
          {filteredClassrooms.map((c) => {
            const isEnrolled = !!c.is_enrolled
            const isJoiningThis = joiningCardId === c.id

            return (
              <div
                key={c.id}
                onClick={() => {
                  if (isEnrolled) {
                    navigate(`/student/classes/${c.id}`)
                  } else {
                    handleQuickJoin(c)
                  }
                }}
                style={{
                  backgroundColor: '#ffffff',
                  border: isEnrolled ? '2.5px solid #000000' : '2.5px solid #000000',
                  borderRadius: 16,
                  boxShadow: isEnrolled ? '4px 4px 0px #10b981' : '4px 4px 0px #000000',
                  padding: '22px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  cursor: 'pointer',
                  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translate(-2px, -2px)'
                  e.currentTarget.style.boxShadow = isEnrolled
                    ? '6px 6px 0px #10b981'
                    : '6px 6px 0px #000000'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translate(0px, 0px)'
                  e.currentTarget.style.boxShadow = isEnrolled
                    ? '4px 4px 0px #10b981'
                    : '4px 4px 0px #000000'
                }}
              >
                <div>
                  {/* Hàng 1: Mã lớp, Môn học & Trạng thái tham gia */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          fontSize: 12,
                          backgroundColor: '#f1f5f9',
                          border: '1.5px solid #000000',
                          borderRadius: 6,
                          padding: '2px 7px',
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
                            padding: '2px 7px',
                            fontSize: 11.5,
                            fontWeight: 800,
                            color: '#000000',
                          }}
                        >
                          {c.subject}
                        </span>
                      )}
                    </div>

                    {isEnrolled ? (
                      <span
                        style={{
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          border: '1.5px solid #16a34a',
                          borderRadius: 6,
                          padding: '2px 7px',
                          fontSize: 11.5,
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <CheckIcon size={12} /> Đã tham gia
                      </span>
                    ) : (
                      <span
                        style={{
                          backgroundColor: '#f8fafc',
                          color: '#64748b',
                          border: '1.5px solid #cbd5e1',
                          borderRadius: 6,
                          padding: '2px 7px',
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        Chưa tham gia
                      </span>
                    )}
                  </div>

                  {/* Tên lớp học */}
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      margin: '0 0 6px 0',
                      color: '#000000',
                      lineHeight: 1.3,
                    }}
                  >
                    {c.name}
                  </h3>

                  {/* Giảng viên phụ trách */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 750,
                      color: '#1e293b',
                      marginBottom: 8,
                    }}
                  >
                    <GraduationCapIcon size={16} style={{ color: '#3b66f5' }} />
                    <span>GV: {c.lecturer_name || 'Giảng viên bộ môn'}</span>
                  </div>

                  {/* Mô tả lớp học */}
                  <p
                    style={{
                      fontSize: 13,
                      color: '#4b5563',
                      margin: 0,
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {c.description || 'Lớp học với kho tài liệu bài giảng được cô lập.'}
                  </p>
                </div>

                <div>
                  {/* Thống kê: Tài liệu + Sinh viên */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      paddingTop: 12,
                      paddingBottom: 14,
                      borderTop: '1.5px solid #e5e7eb',
                      fontSize: 12.5,
                      color: '#374151',
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <ArchiveIcon size={15} /> {c.document_count ?? 0} tài liệu
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <UsersIcon size={15} /> {c.student_count ?? 0} thành viên
                    </span>
                  </div>

                  {/* Hàng nút hành động */}
                  {isEnrolled ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/student/classes/${c.id}`)
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: '#3b66f5',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: 13.5,
                          padding: '9px 14px',
                          borderRadius: 10,
                          border: '2px solid #000000',
                          boxShadow: '2.5px 2.5px 0px #000000',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        Vào học ngay <ArrowRightIcon size={15} />
                      </button>

                      <button
                        type="button"
                        title="Rời khỏi lớp học này"
                        onClick={(e) => handleLeaveClass(c, e)}
                        style={{
                          backgroundColor: '#ffffff',
                          color: '#ef4444',
                          border: '2px solid #000000',
                          borderRadius: 10,
                          padding: '9px 12px',
                          cursor: 'pointer',
                          boxShadow: '2px 2px 0px #000000',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={(e) => handleQuickJoin(c, e)}
                        disabled={isJoiningThis}
                        style={{
                          width: '100%',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: 13.5,
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '2px solid #000000',
                          boxShadow: '2.5px 2.5px 0px #000000',
                          cursor: isJoiningThis ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          opacity: isJoiningThis ? 0.75 : 1,
                        }}
                      >
                        {isJoiningThis ? 'Đang tham gia...' : '+ Tham gia lớp học này'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Tham gia lớp bằng mã code thủ công */}
      {showJoinModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowJoinModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '3px solid #000000',
              borderRadius: 16,
              boxShadow: '6px 6px 0px #000000',
              padding: '28px 28px',
              maxWidth: 460,
              width: '100%',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#10b981',
                  border: '2px solid #000000',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '2px 2px 0px #000000',
                }}
              >
                <PlusIcon size={20} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: '#000000' }}>
                Tham gia lớp bằng mã
              </h2>
            </div>

            <p style={{ fontSize: 13.5, color: '#4b5563', margin: '0 0 18px 0', lineHeight: 1.45 }}>
              Nhập mã lớp do giảng viên cung cấp để tham gia lớp và truy cập kho tài liệu môn học.
            </p>

            {joinError && (
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  border: '2px solid #ef4444',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: '#991b1b',
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 800,
                    marginBottom: 6,
                    color: '#000000',
                  }}
                >
                  Mã lớp học <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  placeholder="Ví dụ: C_PROG_01"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    fontFamily: 'monospace',
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: 1,
                    border: '2px solid #000000',
                    borderRadius: 10,
                    boxShadow: '2px 2px 0px #000000',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#fafafa',
                  }}
                />
                <span style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'block' }}>
                  Gợi ý: Hỏi giảng viên mã lớp nếu bạn chưa có mã.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  disabled={joining}
                  style={{
                    padding: '10px 18px',
                    fontWeight: 700,
                    fontSize: 13.5,
                    backgroundColor: '#f3f4f6',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={joining}
                  style={{
                    padding: '10px 22px',
                    fontWeight: 800,
                    fontSize: 13.5,
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: '2px solid #000000',
                    borderRadius: 10,
                    boxShadow: '2.5px 2.5px 0px #000000',
                    cursor: joining ? 'wait' : 'pointer',
                    opacity: joining ? 0.7 : 1,
                  }}
                >
                  {joining ? 'Đang tham gia...' : 'Tham gia ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
