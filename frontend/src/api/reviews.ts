import { api } from './client'
import type {
  FlaggedInvoiceItem,
  ResolveReviewPayload,
  ResolveReviewResponse,
  ReviewHistoryItem,
} from '../types/review'
import type { InvoiceListResponse } from '../types/invoice'

export async function getFlaggedInvoices(): Promise<FlaggedInvoiceItem[]> {
  const { data } = await api.get<FlaggedInvoiceItem[]>('/invoice/flagged/list')
  return data
}

export async function resolveFlaggedInvoice(
  invoiceId: string,
  payload: ResolveReviewPayload,
): Promise<ResolveReviewResponse> {
  const { data } = await api.post<ResolveReviewResponse>(`/review/${invoiceId}/resolve`, payload)
  return data
}

export async function getReviewHistory(): Promise<ReviewHistoryItem[]> {
  const { data } = await api.get<ReviewHistoryItem[]>('/review/history')
  return data
}

export async function getReviewedInvoices(page = 1, perPage = 10): Promise<InvoiceListResponse> {
  const { data } = await api.get<InvoiceListResponse>('/invoice/list', {
    params: {
      status: 'REVIEWED',
      search: '',
      page,
      per_page: perPage,
    },
  })

  return data
}
