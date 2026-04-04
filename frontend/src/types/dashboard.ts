export type InvoiceStatus = 'clean' | 'flagged' | 'reviewed' | string

export type DashboardStats = {
  total_invoices: number
  invoices_today: number
  total_clean: number
  total_flagged: number
  total_reviewed: number
  pending_review: number
  not_ai_processed_count: number
  total_value_processed: number | string
  average_processing_time_seconds: number
}

export type RecentInvoice = {
  id?: string
  invoice_number: string
  vendor_name: string
  grand_total: number | string
  currency: string
  status: InvoiceStatus
  processed_at: string | null
  ai_processed: boolean
}

export type DashboardResponse = {
  stats: DashboardStats
  recent_invoices: RecentInvoice[]
}
