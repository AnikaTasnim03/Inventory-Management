export default function InventraLogo({ small = false, className = '' }) {
  const classes = ['brand-mark', small && 'brand-mark-small', className].filter(Boolean).join(' ')

  return (
    <span className={classes} aria-hidden="true">
      <svg viewBox="0 0 36 36" role="presentation">
        <path d="M18 2.8 31.2 10v15.3L18 33 4.8 25.3V10L18 2.8Z" fill="#0878e8" />
        <path d="m18 2.8 13.2 7.3L18 17.4 4.8 10 18 2.8Z" fill="#35c7ef" />
        <path d="M18 17.4v15.5l13.2-7.6V10L18 17.4Z" fill="#0655bd" />
        <path d="M11.5 10.1 18 6.5l6.5 3.6v7.4L18 21.2l-6.5-3.7v-7.4Z" fill="none" stroke="#fff" strokeWidth="1.5" opacity=".85" />
      </svg>
    </span>
  )
}
