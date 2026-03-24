import { useCallback, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth'
import type {
  ChangePasswordPayload,
  LoginPayload,
  ProfileUpdatePayload,
  RegisterPayload,
  User,
} from '../types/auth'
import { AuthContext } from './authContext'
import type { AuthContextValue } from './authContext'

const ACCESS_TOKEN_KEY = 'access_token'

function getStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  const storage = window.localStorage
  if (!storage) {
    return null
  }

  return storage
}

function storeAccessToken(token: string) {
  const storage = getStorage()
  if (!storage || typeof storage.setItem !== 'function') {
    return
  }

  storage.setItem(ACCESS_TOKEN_KEY, token)
}

function clearAccessToken() {
  const storage = getStorage()
  if (!storage || typeof storage.removeItem !== 'function') {
    return
  }

  storage.removeItem(ACCESS_TOKEN_KEY)
}

function getAccessToken() {
  const storage = getStorage()
  if (!storage || typeof storage.getItem !== 'function') {
    return null
  }

  return storage.getItem(ACCESS_TOKEN_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const hydrateUser = useCallback(async () => {
    const token = getAccessToken()

    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      const me = await authApi.getMe()
      setUser(me)
    } catch {
      clearAccessToken()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void hydrateUser()
  }, [hydrateUser])

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await authApi.login(payload)
    storeAccessToken(data.access_token)
    setUser(data.user)
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await authApi.register(payload)
    storeAccessToken(data.access_token)
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      clearAccessToken()
      setUser(null)
    }
  }, [])

  const updateProfile = useCallback(async (payload: ProfileUpdatePayload) => {
    const updatedUser = await authApi.updateProfile(payload)
    setUser(updatedUser)
    return updatedUser
  }, [])

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    await authApi.changePassword(payload)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
    }),
    [changePassword, isLoading, login, logout, register, updateProfile, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
