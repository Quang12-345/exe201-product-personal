// Component UI tái sử dụng. Mỗi component một file riêng.
function Button({ children, onClick, type = 'button', disabled = false }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export default Button
