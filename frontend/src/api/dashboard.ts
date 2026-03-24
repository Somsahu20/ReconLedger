import { api } from './client'
import type { DashboardResponse } from '../types/dashboard'

export async function getDashboardStats(): Promise<DashboardResponse> {
  const { data } = await api.get<DashboardResponse>('/dashboard/stats')
  return data
}
