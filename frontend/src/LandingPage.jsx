import { useEffect, useState } from 'react'
import './LandingPage.css'
import { requestPasswordReset, signIn, signUp } from './authService'
import InventraLogo from './InventraLogo.jsx'

const features = [
  {
    id: 'stock-visibility',
    icon: '⬡',
    tone: 'cyan',
    title: 'Stock visibility',
    description: 'Check stock at a glance and avoid stockouts.',
    details: 'Search and filter the product catalog, inspect item details, and review stock levels from the dashboard or Products page.',
  },
  {
    id: 'smarter-purchasing',
    icon: '▣',
    tone: 'blue',
    title: 'Smarter purchasing',
    description: 'Create orders and receive stock with confidence.',
    details: 'Connect orders to suppliers and products, then receive quantities with a recorded stock movement.',
  },
  {
    id: 'stock-movements',
    icon: '↗',
    tone: 'violet',
    title: 'Stock movement tracking',
    description: 'Record incoming and outgoing inventory.',
    details: 'Use Stock Management to record incoming and outgoing movements and review the resulting activity history.',
  },
  {
    id: 'supplier-management',
    icon: '♧',
    tone: 'blue',
    title: 'Supplier management',
    description: 'Keep supplier contacts connected to products.',
    details: 'Maintain supplier details and connect suppliers to products and purchasing workflows.',
  },
  {
    id: 'reports-analytics',
    icon: '◔',
    tone: 'violet',
    title: 'Reports and analytics',
    description: 'Turn stock and purchasing into clear insights.',
    details: 'Explore date-filtered inventory, movement, and purchase-order reporting in Reports & Analytics.',
  },
  {
    id: 'inventory-alerts',
    icon: '!',
    tone: 'cyan',
    title: 'Inventory alerts',
    description: 'Find low stock and replenishment needs early.',
    details: 'Review low-stock notifications and replenishment suggestions from the Notifications workspace.',
  },
]

const platformLinks = [
  ['Dashboard', 'dashboard'],
  ['Products', 'products'],
  ['Stock management', 'stock'],
  ['Purchase orders', 'purchase-orders'],
]

function DashboardPreview() {
  return (
    <div className="preview-stage" aria-label="Illustrative Inventra dashboard preview">
      <div className="preview-orb" />
      <div className="dashboard-preview">
        <div className="preview-toolbar">
          <div className="preview-wordmark"><InventraLogo small /> <b>Inventra</b></div>
          <div className="preview-search">⌕ <span>Search products, suppliers, or orders...</span></div>
          <span className="preview-bell">♧</span>
          <span className="preview-user">IA</span>
        </div>
        <div className="preview-layout">
          <aside className="preview-sidebar" aria-hidden="true">
            <span className="selected">▦ &nbsp; Dashboard</span>
            <span>□ &nbsp; Products</span>
            <span>⇄ &nbsp; Categories</span>
            <span>♧ &nbsp; Suppliers</span>
            <span>▣ &nbsp; Purchase orders</span>
            <span>↗ &nbsp; Stock movements</span>
            <span>▤ &nbsp; Reports</span>
            <span className="preview-settings">⚙ &nbsp; Settings</span>
          </aside>
          <div className="preview-content">
            <div className="preview-title-row">
              <div><small>WORKSPACE / DASHBOARD</small><h3>Inventory Dashboard</h3></div>
              <span className="preview-sample-tag">Illustrative preview</span>
            </div>
            <div className="preview-metrics">
              <div><span className="metric-dot cyan-dot">⬡</span><small>Total Products</small><strong>—</strong><em>Live workspace data</em></div>
              <div><span className="metric-dot orange-dot">!</span><small>Low Stock</small><strong>—</strong><em>Review alerts</em></div>
              <div><span className="metric-dot blue-dot">▣</span><small>Pending Orders</small><strong>—</strong><em>Track purchasing</em></div>
            </div>
            <div className="preview-panels">
              <div className="preview-chart-panel">
                <div className="panel-title"><b>Stock trend</b><span>Activity overview</span></div>
                <div className="chart-area">
                  <div className="chart-y-labels"><span>High</span><span>Medium</span><span>Low</span></div>
                  <svg viewBox="0 0 380 110" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 88H380M0 57H380M0 26H380" className="chart-gridline" />
                    <path d="M4 83 40 70 76 77 112 49 148 61 184 40 220 49 256 26 292 39 328 16 376 27" className="chart-line" />
                    <path d="M4 83 40 70 76 77 112 49 148 61 184 40 220 49 256 26 292 39 328 16 376 27V110H4Z" className="chart-fill" />
                    <circle cx="328" cy="16" r="4" className="chart-point" />
                  </svg>
                  <div className="chart-months"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div>
                </div>
              </div>
              <div className="preview-category-panel">
                <div className="panel-title"><b>Stock by category</b><span>View all</span></div>
                {['IT Equipment', 'Office Supplies', 'Hardware', 'Packaging'].map((name, index) => (
                  <div className="category-preview-row" key={name}>
                    <span>{name}</span><i className={`category-bar category-bar-${index + 1}`} /><small>—</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="preview-activity">
              <div className="panel-title"><b>Recent activity</b><span>Workspace activity</span></div>
              {['Movement history', 'Purchase order', 'Product update'].map((item) => (
                <div className="activity-preview-row" key={item}><span>{item}</span><span>Recorded activity</span><b>View</b></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="preview-caption"><span className="caption-check">✓</span> A real-time view of your inventory workspace <span className="caption-separator">·</span> Sample layout, no live data</div>
    </div>
  )
}

function AuthDialog({
  mode,
  setMode,
  onClose,
  authError,
  onClearAuthError,
  onPasswordUpdated,
}) {
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
    setMessage('')
    onClearAuthError()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    onClearAuthError()
    if (mode === 'signup' && values.password !== values.confirmPassword) {
      setError('Your passwords do not match.')
      return
    }
    if (mode === 'signup' && !values.name.trim()) {
      setError('Enter your full name.')
      return
    }
    if ((mode === 'signup' || mode === 'update-password') && values.password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(values.email.trim(), values.password)
      } else if (mode === 'signup') {
        const result = await signUp(values.name, values.email.trim(), values.password)
        setMessage(result.session
          ? 'Your account is ready. Opening your Inventra workspace…'
          : 'Account created. Check your email to confirm your address before signing in.')
        setValues((current) => ({ ...current, password: '', confirmPassword: '' }))
      } else if (mode === 'reset') {
        await requestPasswordReset(values.email.trim())
        setMessage('If an account exists for this address, a password reset link is on its way.')
      } else {
        if (values.password !== values.confirmPassword) {
          setError('Your passwords do not match.')
          return
        }
        await onPasswordUpdated(values.password)
        setMessage('Your password has been updated.')
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = mode === 'signin'
    ? 'Welcome back'
    : mode === 'signup'
      ? 'Create your account'
      : mode === 'reset'
        ? 'Reset your password'
        : 'Choose a new password'

  return (
    <div className="auth-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" onClick={onClose} aria-label="Close dialog">×</button>
        <div className="auth-dialog-brand"><InventraLogo /><span>Inventra</span></div>
        <p className="auth-eyebrow">INVENTORY, UNDER CONTROL</p>
        <h2 id="auth-title">{title}</h2>
        <p className="auth-intro">
          {mode === 'signin' && 'Sign in to continue to your inventory workspace.'}
          {mode === 'signup' && 'Create an account to request access to the shared Inventra workspace.'}
          {mode === 'reset' && 'Enter your email and we’ll send a secure password reset link.'}
          {mode === 'update-password' && 'Choose a new password for your Inventra account.'}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label>Full name
              <input autoComplete="name" name="name" onChange={updateField} required value={values.name} />
            </label>
          )}
          {mode !== 'update-password' && (
            <label>Email address
              <input autoComplete="email" name="email" onChange={updateField} required type="email" value={values.email} />
            </label>
          )}
          {mode !== 'reset' && (
            <label>{mode === 'update-password' ? 'New password' : 'Password'}
              <span className="password-input">
                <input
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={mode === 'signin' ? undefined : 8}
                  name="password"
                  onChange={updateField}
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={values.password}
                />
                <button type="button" onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? 'Hide' : 'Show'}</button>
              </span>
            </label>
          )}
          {(mode === 'signup' || mode === 'update-password') && (
            <label>Confirm password
              <span className="password-input">
                <input
                  autoComplete="new-password"
                  minLength={8}
                  name="confirmPassword"
                  onChange={updateField}
                  required
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={values.confirmPassword}
                />
                <button type="button" onClick={() => setShowConfirmPassword((shown) => !shown)}>{showConfirmPassword ? 'Hide' : 'Show'}</button>
              </span>
            </label>
          )}
          {(error || authError) && <p className="auth-feedback auth-feedback-error" role="alert">{error || authError}</p>}
          {message && <p className="auth-feedback auth-feedback-success" role="status">{message}</p>}
          <button className="auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Update password'}
          </button>
        </form>
        {mode === 'signin' && (
          <button className="auth-text-button forgot-link" onClick={() => { setError(''); setMessage(''); setMode('reset') }} type="button">Forgot password?</button>
        )}
        {mode === 'signin' && <p className="auth-switch">New to Inventra? <button className="auth-text-button" onClick={() => { setError(''); setMessage(''); setMode('signup') }} type="button">Create an account</button></p>}
        {mode === 'signup' && <p className="auth-switch">Already have an account? <button className="auth-text-button" onClick={() => { setError(''); setMessage(''); setMode('signin') }} type="button">Sign in</button></p>}
        {mode === 'reset' && <p className="auth-switch"><button className="auth-text-button" onClick={() => { setError(''); setMessage(''); setMode('signin') }} type="button">Back to sign in</button></p>}
        {mode === 'update-password' && message && <p className="auth-switch"><button className="auth-text-button" onClick={onClose} type="button">Continue</button></p>}
        <p className="auth-session-note">Your session is securely managed by Supabase Auth.</p>
      </section>
    </div>
  )
}

export default function LandingPage({
  initialAuthMode = '',
  authError = '',
  onClearAuthError = () => {},
  onUpdatePassword,
  onPasswordUpdated = () => {},
  isAuthenticated = false,
  onReturnToWorkspace,
  onSignOut,
}) {
  const [modalMode, setModalMode] = useState(initialAuthMode)
  const [expandedFeature, setExpandedFeature] = useState('')

  function openSignIn() {
    if (isAuthenticated) {
      onReturnToWorkspace?.()
      return
    }
    onClearAuthError()
    setModalMode('signin')
  }

  function openPlatform(page, event) {
    event.currentTarget.closest('details')?.removeAttribute('open')
    if (isAuthenticated) {
      onReturnToWorkspace?.(page)
      return
    }
    window.history.replaceState({}, '', `/?workspace=${encodeURIComponent(page)}`)
    openSignIn()
  }

  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <a className="marketing-brand" href="/" aria-label="Inventra home">
          <InventraLogo /><span>Inventra</span>
        </a>
        <nav className="marketing-links" aria-label="Main navigation">
          <details className="nav-menu">
            <summary>Platform <span className="chevron">⌄</span></summary>
            <div className="nav-dropdown">
              {platformLinks.map(([label, page]) => <button key={page} onClick={(event) => openPlatform(page, event)} type="button">{label}<span>→</span></button>)}
            </div>
          </details>
          <details className="nav-menu">
            <summary>Features <span className="chevron">⌄</span></summary>
            <div className="nav-dropdown">
              <a href="#features">Feature overview <span>→</span></a>
              <a href="#how-it-works">How it works <span>→</span></a>
              <a href="#why-inventra">Why Inventra <span>→</span></a>
            </div>
          </details>
          <details className="nav-menu">
            <summary>Resources <span className="chevron">⌄</span></summary>
            <div className="nav-dropdown">
              <a href="#how-it-works">Getting started <span>→</span></a>
              <a href="#contact">Contact and access <span>→</span></a>
            </div>
          </details>
          <a className="nav-contact" href="#contact">Contact</a>
        </nav>
        {isAuthenticated ? (
          <div className="authenticated-nav-actions">
            <button className="nav-signin" onClick={openSignIn} type="button">Return to Dashboard</button>
            <button className="nav-signout" onClick={onSignOut} type="button">Sign out</button>
          </div>
        ) : (
          <button className="nav-signin" onClick={openSignIn} type="button"><span className="nav-user-icon">↪</span> Sign In</button>
        )}
      </header>
      {isAuthenticated && authError && <p className="auth-feedback auth-feedback-error landing-auth-error" role="alert">{authError}</p>}

      <section className="marketing-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="hero-kicker"><span>✦</span> SMART INVENTORY MANAGEMENT</p>
          <h1 id="hero-title">Every item. Every movement. <span>Under control.</span></h1>
          <p className="hero-description">A smarter way to manage your inventory, suppliers, and purchasing — all in one place.</p>
          <div className="hero-actions">
            <button className="button-primary" onClick={openSignIn} type="button">{isAuthenticated ? 'Go to your workspace' : 'Sign in to Inventra'} <span>→</span></button>
            <a className="button-secondary" href="#features">Explore features</a>
          </div>
          <div className="hero-trust">
            <span><b>✓</b> Secure and reliable</span>
            <span><b>ϟ</b> Easy to use</span>
            <span><b>♧</b> Built for growing teams</span>
          </div>
        </div>
        <DashboardPreview />
      </section>

      <section className="features-section" id="features" aria-labelledby="features-title">
        <div className="section-heading">
          <p className="section-label">OUR FEATURES</p>
          <h2 id="features-title">Everything you need to run your inventory</h2>
          <p>Powerful tools, simple workflows, and real-time insights — designed to help you<br className="desktop-break" /> move faster and stay in control.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => {
            const expanded = expandedFeature === feature.id
            return (
              <article className={`feature-card${expanded ? ' feature-expanded' : ''}`} id={feature.id} key={feature.id}>
                <div className={`feature-icon ${feature.tone}`} aria-hidden="true">{feature.icon}</div>
                <div className="feature-card-copy">
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  {expanded && <p className="feature-detail">{feature.details}</p>}
                  <button
                    className="learn-more"
                    aria-expanded={expanded}
                    onClick={() => setExpandedFeature(expanded ? '' : feature.id)}
                    type="button"
                  >
                    {expanded ? 'Show less' : 'Learn more'} <span>{expanded ? '↑' : '→'}</span>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="why-section" id="why-inventra" aria-labelledby="why-title">
        <div className="why-copy">
          <p className="section-label">WHY CHOOSE INVENTRA?</p>
          <h2 id="why-title">A smarter, simpler inventory solution</h2>
          <p>Inventra helps you stay organized, save time, and make data-driven decisions with ease.</p>
          <ul>
            <li><span>✓</span> User-friendly and intuitive interface</li>
            <li><span>✓</span> Secure sign-in for your workspace</li>
            <li><span>✓</span> Practical inventory and purchasing reports</li>
          </ul>
          <button className="button-primary compact-button" onClick={openSignIn} type="button">Get started <span>→</span></button>
        </div>
        <div className="workspace-illustration" aria-label="Illustration of inventory planning on a laptop">
          <div className="illustration-halo" />
          <div className="package-stack" aria-hidden="true"><i /><i /><i /></div>
          <div className="illustration-laptop" aria-hidden="true">
            <div className="laptop-screen"><InventraLogo /><span>Inventory,<br />under control.</span></div>
            <div className="laptop-base"><i /></div>
          </div>
          <div className="checklist-card" aria-hidden="true">
            <div className="checklist-clip" />
            <b>Inventory check</b>
            <span><i>✓</i> Stock reviewed</span>
            <span><i>✓</i> Orders tracked</span>
            <span><i>✓</i> Team aligned</span>
          </div>
          <div className="illustration-plant" aria-hidden="true"><i /><i /><i /><b /></div>
        </div>
      </section>

      <section className="steps-section" id="how-it-works" aria-labelledby="steps-title">
        <p className="section-label">HOW IT WORKS</p>
        <h2 id="steps-title">Get started in just 3 simple steps</h2>
        <div className="steps-row">
          <article><span>1</span><h3>Create an account</h3><p>Sign up or sign in to Inventra</p></article>
          <article><span>2</span><h3>Manage your inventory</h3><p>Add products, track stock and orders</p></article>
          <article><span>3</span><h3>Grow your business</h3><p>Make smarter decisions</p></article>
        </div>
      </section>

      <section className="contact-banner" id="contact">
        <div className="contact-mark">➤</div>
        <div><h2>Take control of your inventory</h2><p>Join your Inventra workspace and experience a smarter way to manage your business.</p></div>
        <button className="contact-button" onClick={openSignIn} type="button">{isAuthenticated ? 'Open workspace' : 'Sign in to Inventra'} <span>→</span></button>
      </section>

      <footer className="marketing-footer" id="resources">
        <div className="footer-brand">
          <a className="marketing-brand footer-logo" href="/" aria-label="Inventra home"><InventraLogo /><span>Inventra</span></a>
          <p>Smarter Inventory. Stronger Business.</p>
        </div>
        <div className="footer-column"><h3>Quick links</h3><a href="#features">Features</a><button onClick={openSignIn} type="button">Dashboard</button><button onClick={openSignIn} type="button">Products</button></div>
        <div className="footer-column"><h3>Resources</h3><a href="#how-it-works">Getting started</a><a href="#why-inventra">Why Inventra</a><a href="#contact">Contact</a></div>
        <div className="footer-column footer-contact"><h3>Workspace access</h3><p>Need access or help with your account? Sign in to contact your workspace administrator.</p><button className="footer-contact-link" onClick={openSignIn} type="button">{isAuthenticated ? 'Return to workspace →' : 'Sign in for support →'}</button></div>
        <div className="footer-legal">© {new Date().getFullYear()} Inventra. All rights reserved.</div>
      </footer>

      {modalMode && (
        <AuthDialog
          authError={authError}
          mode={modalMode}
          onClearAuthError={onClearAuthError}
          onClose={() => {
            setModalMode('')
            if (modalMode === 'update-password') onPasswordUpdated()
          }}
          onPasswordUpdated={async (password) => {
            if (!onUpdatePassword) throw new Error('Password recovery is not available.')
            await onUpdatePassword(password)
            onPasswordUpdated()
          }}
          setMode={setModalMode}
        />
      )}
    </main>
  )
}
