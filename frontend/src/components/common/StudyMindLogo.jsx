import React from 'react'

/**
 * StudyMind Official Logo Component
 * 
 * Biểu tượng chữ 'S' cách điệu ôm trọn ngôi sao AI Sparkle ở trung tâm
 * Đại diện cho nền tảng học tập thông minh StudyMind.
 *
 * @param {number|string} size - Kích thước logo (px). Mặc định 28
 * @param {'boxed'|'plain'|'white'} variant -
 *    'boxed': Biểu tượng trắng trên nền xanh thương hiệu #3E5BED
 *    'plain': Biểu tượng màu xanh #3E5BED trên nền trong suốt
 *    'white': Biểu tượng màu trắng trên nền trong suốt (cho dark mode/navbar tối)
 * @param {number} rounded - Bán kính bo góc cho variant 'boxed' (px hoặc %). Mặc định 0
 * @param {string} className - Lớp CSS tuỳ chỉnh
 * @param {object} style - Inline styles
 */
export default function StudyMindLogo({
  size = 28,
  variant = 'boxed',
  rounded = 0,
  className = '',
  style = {},
  ...props
}) {
  const isBoxed = variant === 'boxed'
  const glyphColor = variant === 'plain' ? '#3E5BED' : '#FFFFFF'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`studymind-brand-logo ${className}`.trim()}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      {...props}
    >
      {/* Nền xanh đặc trưng (chỉ hiển thị khi variant = 'boxed') */}
      {isBoxed && (
        <rect
          width="512"
          height="512"
          rx={rounded}
          ry={rounded}
          fill="#3E5BED"
        />
      )}

      {/* Cánh trên chữ S */}
      <path
        d="M 153.52 51.44 H 356.87 V 75.55 A 186.18 186.18 0 0 0 177.63 255.60 H 153.52 Z"
        fill={glyphColor}
      />

      {/* Cánh dưới chữ S */}
      <path
        d="M 356.87 460.56 H 153.52 V 436.45 A 186.18 186.18 0 0 0 332.76 256.40 H 356.87 Z"
        fill={glyphColor}
      />

      {/* Ngôi sao AI Sparkle trung tâm */}
      <path
        d="M 290.96 166.38 L 307.84 166.38 L 289.36 204.16 C 293.05 205.60, 271.59 233.66, 317.49 243.54 L 310.25 258.01 C 253.03 270.63, 258.01 284.77, 243.54 298.20 L 224.25 335.17 L 207.37 335.17 L 225.86 297.39 C 222.16 295.95, 243.62 267.90, 197.73 258.01 L 204.96 243.54 C 262.19 230.92, 257.21 216.78, 271.67 203.35 Z"
        fill={glyphColor}
      />
    </svg>
  )
}

export function StudyMindMiniLogo({ size = 20, variant = 'white', ...props }) {
  return <StudyMindLogo size={size} variant={variant} {...props} />
}
