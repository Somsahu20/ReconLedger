import { api } from './client'
import type { QueryResponse } from '../types/query'

export async function askInvoiceQuery(question: string): Promise<QueryResponse> {
  const { data } = await api.post<QueryResponse>('/query', { question })
  return data
}
