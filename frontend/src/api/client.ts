import axios from 'axios'
import type { AxiosError, AxiosRequestConfig } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30_000,
})

type RetriableConfig = AxiosRequestConfig & {
  _retry?: boolean
  _retryCount?: number
}

const RETRIABLE_METHODS = new Set(['get', 'head', 'options'])
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])
const MAX_RETRY_COUNT = 2
const AUTH_ROUTES_NO_REFRESH = new Set(['/auth/login', '/auth/register', '/auth/refresh'])

let refreshPromise: Promise<string> | null = null

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function shouldRetryRequest(error: AxiosError, request: RetriableConfig) {
  const method = request.method?.toLowerCase() ?? 'get'
  const isRetriableMethod = RETRIABLE_METHODS.has(method)
  if (!isRetriableMethod) return false

  if (!error.response) {
    return true
  }

  return RETRYABLE_STATUS.has(error.response.status)
}

function getRequestPath(request: RetriableConfig) {
  const rawUrl = request.url
  if (!rawUrl) return ''

  try {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return new URL(rawUrl).pathname
    }

    return new URL(rawUrl, API_BASE_URL).pathname
  } catch {
    return rawUrl
  }
}

function shouldAttemptRefresh(error: AxiosError, request: RetriableConfig) {
  if (error.response?.status !== 401) return false
  if (request._retry) return false

  const path = getRequestPath(request)
  return !AUTH_ROUTES_NO_REFRESH.has(path)
}

async function requestNewAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          timeout: 30_000,
        },
      )
      .then((response) => {
        const token = response.data?.access_token
        if (!token) {
          throw new Error('Missing access token in refresh response')
        }
        return token as string
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

function redirectToLogin() {
  if (typeof window === 'undefined') return
  if (window.location.pathname === '/login') return
  window.location.replace('/login')
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = (error.config ?? {}) as RetriableConfig

    if (shouldRetryRequest(error, originalRequest)) {
      const retryCount = originalRequest._retryCount ?? 0

      if (retryCount < MAX_RETRY_COUNT) {
        originalRequest._retryCount = retryCount + 1
        const delayMs = 300 * 2 ** retryCount
        await wait(delayMs)
        return api(originalRequest)
      }
    }

    if (shouldAttemptRefresh(error, originalRequest)) {
      originalRequest._retry = true

      try {
        const newToken = await requestNewAccessToken()
        localStorage.setItem('access_token', newToken)
        originalRequest.headers = {
          ...(originalRequest.headers ?? {}),
          Authorization: `Bearer ${newToken}`,
        }
        return api(originalRequest)
      } catch {
        localStorage.removeItem('access_token')
        redirectToLogin()
      }
    }

    return Promise.reject(error)
  },
)
