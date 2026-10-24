import { useState, useEffect, useCallback } from 'react'
import * as documentService from '../services/documentService'

// Logic danh sách + xóa tài liệu.
export function useDocuments() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDocuments(await documentService.getDocuments())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const removeDocument = async (id) => {
    await documentService.deleteDocument(id)
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }

  return { documents, loading, reload: load, removeDocument }
}
