import { QueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'

function shouldRetryQuery(failureCount: number, error: unknown) {
  if (failureCount >= 2) return false

  if (error instanceof AxiosError) {
    const status = error.response?.status
    if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return false
    }
  }

  return true
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      retryDelay: (attemptIndex) => Math.min(300 * 2 ** attemptIndex, 2_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
})
