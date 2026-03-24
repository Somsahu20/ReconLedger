export type InvoiceStatus = 'CLEAN' | 'FLAGGED' | 'REVIEWED' | string

export type LineItem = {
  id: string
  item_index: number
  description: string
  quantity: number | string
  unit_price: number | string
  line_total: number | string
}

export type InvoiceResponse = {
  id: string
  invoice_number: string
  vendor_name: string
  date: string
  due_date: string | null
  currency: string
  subtotal: number | string
  tax_rate: number | string
  tax_amount: number | string
  grand_total: number | string
  status: InvoiceStatus
  audit_report: string | null
  uploaded_by: string
  processed_at: string | null
  created_at: string
  line_items: LineItem[]
}

export type ValidationCheck = {
  check_name: string
  expected_value: number | string
  actual_value: number | string
  passed: boolean
  discrepancy: number | string
}

export type ValidationResult = {
  all_passed: boolean
  checks: ValidationCheck[]
  audit_report: string | null
}

export type InvoiceUploadResponse = {
  status: InvoiceStatus
  invoice: InvoiceResponse
  validation: ValidationResult
  message: string
}

export type InvoiceListItem = {
  id: string
  invoice_number: string
  vendor_name: string
  date: string
  grand_total: number | string
  currency: string
  status: InvoiceStatus
  processed_at: string | null
}

export type InvoiceListResponse = {
  total: number
  page: number
  per_page: number
  total_pages: number
  invoices: InvoiceListItem[]
}

export type InvoiceListParams = {
  status?: string
  search?: string
  page?: number
  perPage?: number
}
