import { api } from './client'
import type {
  ReconciliationFilterStatus,
  ReconciliationFilteredItemsResponse,
  ReconciliationReportResponse,
  ReconciliationSessionListItem,
  ReconciliationUploadResponse,
} from '../types/reconciliation'

export async function uploadReconciliationListing(params: {
  name: string
  file: File
  useAi: boolean
}): Promise<ReconciliationUploadResponse> {
  const formData = new FormData()
  formData.append('name', params.name)
  formData.append('file', params.file)
  formData.append('use_ai', String(params.useAi))

  const { data } = await api.post<ReconciliationUploadResponse>(
    '/api/reconciliation/upload-listing',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120_000,
    },
  )

  return data
}

export async function listReconciliationSessions(): Promise<ReconciliationSessionListItem[]> {
  const { data } = await api.get<ReconciliationSessionListItem[]>('/api/reconciliation/sessions')
  return data
}

export async function getReconciliationReport(
  sessionId: string,
): Promise<ReconciliationReportResponse> {
  const { data } = await api.get<ReconciliationReportResponse>(
    `/api/reconciliation/${encodeURIComponent(sessionId)}/report`,
  )
  return data
}

export async function getReconciliationItems(
  sessionId: string,
  status: ReconciliationFilterStatus,
): Promise<ReconciliationFilteredItemsResponse> {
  const { data } = await api.get<ReconciliationFilteredItemsResponse>(
    `/api/reconciliation/${encodeURIComponent(sessionId)}/items`,
    {
      params: {
        status: status === 'all' ? undefined : status,
      },
    },
  )
  return data
}
