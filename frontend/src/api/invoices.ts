import { api } from './client'
import type {
  InvoiceListParams,
  InvoiceListResponse,
  InvoiceResponse,
  InvoiceUploadResponse,
  RetryAiProcessResponse,
} from '../types/invoice'

export async function listInvoices(params: InvoiceListParams): Promise<InvoiceListResponse> {
  const { data } = await api.get<InvoiceListResponse>('/invoice/list', {
    params: {
      status: params.status ?? 'all',
      search: params.search ?? '',
      page: params.page ?? 1,
      per_page: params.perPage ?? 10,
    },
  })

  return data
}

export async function getInvoiceByNumber(invoiceNumber: string): Promise<InvoiceResponse> {
  const { data } = await api.get<InvoiceResponse>(`/invoice/${encodeURIComponent(invoiceNumber)}`)
  return data
}

export async function uploadInvoice(file: File): Promise<InvoiceUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await api.post<InvoiceUploadResponse>('/invoice/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120_000,
  })

  return data
}

export async function retryAiProcess(invoiceId: string): Promise<RetryAiProcessResponse> {
  const { data } = await api.post<RetryAiProcessResponse>(`/invoice/${invoiceId}/ai-reprocess`)
  return data
}
