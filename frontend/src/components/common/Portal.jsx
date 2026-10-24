import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Portal({ children, container }) {
  const [mountNode, setMountNode] = useState(null)

  useEffect(() => {
    const target = container || document.body
    setMountNode(target)
  }, [container])

  if (!mountNode) return null
  return createPortal(children, mountNode)
}
