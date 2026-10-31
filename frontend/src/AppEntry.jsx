import { lazy, Suspense, useEffect, useState } from 'react'
import LandingPage from './LandingPage.jsx'
import { getSession, onAuthStateChange, signOut, updateProfileName } from './authService'
import { supabase } from './supabaseClient'

const InventoryApp = lazy(() => import('./App.jsx'))

export default function AppEntry() {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [isLandingPage, setIsLandingPage] = useState(false)
  const [returnPath, setReturnPath] = useState('/')
  const [workspaceRequest, setWorkspaceRequest] = useState(null)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true
    const { data: { subscription } } = onAuthStateChange((event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setIsLoading(false)
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_IN') {
        setIsLandingPage(false)
        setReturnPath('/')
      }
      if (!nextSession) {
        setIsPasswordRecovery(false)
        setIsLandingPage(false)
        setReturnPath('/')
      }
    })

    getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) throw error
        setSession(data.session)
      })
      .catch((error) => {
        if (!active) return
        console.error('Unable to restore the Inventra session:', error)
        setAuthError(error instanceof Error ? error.message : 'Unable to restore your session.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    function handlePopState(event) {
      setIsLandingPage(event.state?.inventraView === 'landing')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  async function handleSignOut() {
    setAuthError('')
    try {
      await signOut()
      window.history.replaceState({}, '', '/')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign out.')
    }
  }

  async function handleProfileUpdate(fullName) {
    const updatedUser = await updateProfileName(fullName, session?.user)
    setSession((current) => current ? { ...current, user: updatedUser } : current)
    return updatedUser
  }

  function navigateToLandingPage() {
    setReturnPath(`${window.location.pathname}${window.location.search}${window.location.hash}`)
    window.history.pushState({ inventraView: 'landing' }, '', '/')
    setIsLandingPage(true)
  }

  function returnToWorkspace(page) {
    if (page) setWorkspaceRequest({ page, requestedAt: Date.now() })
    window.history.pushState({ inventraView: 'workspace' }, '', returnPath)
    setIsLandingPage(false)
  }

  async function handlePasswordUpdate(password) {
    if (!supabase) throw new Error('Supabase Auth is not configured.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message || 'Unable to update your password.')
    setIsPasswordRecovery(false)
  }

  if (isLoading) {
    return <main className="app-loading" role="status" aria-live="polite">Loading Inventra…</main>
  }

  if (session && !isPasswordRecovery) {
    return (
      <>
        <div hidden={isLandingPage}>
          <Suspense fallback={<main className="app-loading" role="status">Loading your workspace…</main>}>
            <InventoryApp
              onGoHome={navigateToLandingPage}
              onSignOut={handleSignOut}
              user={session.user}
              onUpdateProfile={handleProfileUpdate}
              authError={authError}
              workspaceRequest={workspaceRequest}
            />
          </Suspense>
        </div>
        {isLandingPage && (
          <LandingPage
            isAuthenticated
            onReturnToWorkspace={returnToWorkspace}
            onSignOut={handleSignOut}
            onClearAuthError={() => setAuthError('')}
            authError={authError}
          />
        )}
      </>
    )
  }

  const requestedProtectedRoute = window.location.pathname !== '/'
    || Boolean(new URLSearchParams(window.location.search).get('workspace'))
  return (
    <LandingPage
      key={isPasswordRecovery ? 'password-recovery' : requestedProtectedRoute ? 'protected-route' : 'public'}
      initialAuthMode={isPasswordRecovery ? 'update-password' : requestedProtectedRoute ? 'signin' : ''}
      authError={authError}
      onClearAuthError={() => setAuthError('')}
      onUpdatePassword={handlePasswordUpdate}
      onPasswordUpdated={() => {
        setIsPasswordRecovery(false)
        window.history.replaceState({}, '', '/')
      }}
    />
  )
}
