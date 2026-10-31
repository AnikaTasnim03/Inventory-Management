import { supabase } from './supabaseClient'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase Auth is not configured. Add VITE_SUPABASE_URL and either VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env, then restart the frontend.')
  return supabase
}

export async function signIn(email, password) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message || 'Unable to sign in.')
  return data.session
}

export async function signUp(fullName, email, password) {
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName.trim() } },
  })
  if (error) throw new Error(error.message || 'Unable to create your account.')
  return data
}

export async function updateProfileName(fullName, user) {
  const { data, error } = await requireSupabase().auth.updateUser({
    data: {
      ...(user?.user_metadata || {}),
      full_name: fullName.trim(),
    },
  })
  if (error) throw new Error(error.message || 'Unable to update your profile.')
  if (!data.user) throw new Error('Supabase did not return the updated account profile.')
  return data.user
}

export async function requestPasswordReset(email) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  if (error) throw new Error(error.message || 'Unable to send the password reset email.')
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut()
  if (error) throw new Error(error.message || 'Unable to sign out.')
}

export function getSession() {
  return supabase
    ? supabase.auth.getSession()
    : Promise.reject(new Error('Supabase Auth is not configured. Add VITE_SUPABASE_URL and either VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env, then restart the frontend.'))
}

export function onAuthStateChange(callback) {
  if (!supabase) {
    return { data: { subscription: { unsubscribe() {} } } }
  }
  return supabase.auth.onAuthStateChange(callback)
}
