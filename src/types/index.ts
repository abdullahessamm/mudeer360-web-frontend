export interface User {
  id: number
  name: string
  username: string
}

export interface ProductCategory {
  id: number
  name: string
  created_at?: string
  updated_at?: string
}

export interface Product {
  id: number
  name: string
  product_category_id: number | null
  category?: ProductCategory | null
  unit: string
  purchase_price: number
  sale_price: number
  quantity: number
  min_quantity: number
  description?: string | null
}

export interface Supplier {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

export interface ApiResponse<T> {
  success: boolean
  code: number
  message: string
  payload: T
}

export interface PaginatedPayload<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    from: number | null
    to: number | null
  }
  links: {
    first: string
    last: string
    prev: string | null
    next: string | null
  }
}

export interface InvoiceItem {
  product_id?: number
  product_name?: string
  quantity: number
  price: number
  subtotal: number
}

/** Sale invoice item (line item) */
export interface SaleInvoiceItem {
  id?: number
  sale_invoice_id?: number
  product_id: number
  product?: Product | null
  product_name?: string
  product_unit?: string
  quantity: number
  unit_price: number
  total_price?: number
}

/** Full sale invoice (from /api/sale-invoices) */
export interface SaleInvoice {
  id: number
  customer_id: number
  customer?: Customer | null
  invoice_number: string
  type: 'cash' | 'credit'
  total_amount: number
  paid_amount: number
  status: 'paid' | 'partial' | 'unpaid'
  invoice_date: string
  items: SaleInvoiceItem[]
  created_at?: string
  updated_at?: string
}

/** Payload for creating/updating sale invoice */
export interface SaleInvoiceCreatePayload {
  customer_id?: number
  type: 'cash' | 'credit'
  invoice_date: string
  items: { product_id: number; quantity: number; unit_price: number }[]
}

/** Purchase invoice item (line item) */
export interface PurchaseInvoiceItem {
  id?: number
  purchase_invoice_id?: number
  product_id: number
  product?: Product | null
  product_name?: string
  product_unit?: string
  quantity: number
  unit_price: number
  total_price?: number
}

/** Full purchase invoice (from /api/purchase-invoices) */
export interface PurchaseInvoice {
  id: number
  supplier_id: number
  supplier?: Supplier | null
  invoice_number: string
  type: 'cash' | 'credit'
  total_amount: number
  paid_amount: number
  status: 'paid' | 'partial' | 'unpaid'
  invoice_date: string
  items: PurchaseInvoiceItem[]
  created_at?: string
  updated_at?: string
}

/** Payload for creating/updating purchase invoice */
export interface PurchaseInvoiceCreatePayload {
  supplier_id?: number
  type: 'cash' | 'credit'
  invoice_date: string
  items: { product_id: number; quantity: number; unit_price: number }[]
}

/** Payload for add/update payment */
export interface PaymentPayload {
  amount: number
  date: string
  financial_account_id: number
  description?: string
}

/** Purchase invoice summary (used in SupplierWithInvoices) */
export interface SupplierPurchaseInvoice {
  id: number
  supplier_id: number
  invoice_number: string
  type: 'cash' | 'credit'
  total_amount: number
  paid_amount: number
  status: 'paid' | 'partial' | 'unpaid'
  invoice_date: string
}

export interface SupplierWithInvoices extends Supplier {
  purchase_invoices: SupplierPurchaseInvoice[]
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

export interface CustomerSaleInvoice {
  id: number
  customer_id: number
  invoice_number: string
  type: 'cash' | 'credit'
  total_amount: number
  paid_amount: number
  status: 'paid' | 'partial' | 'unpaid'
  invoice_date: string
}

export interface CustomerWithInvoices extends Customer {
  invoices: CustomerSaleInvoice[]
}

export interface FinancialAccount {
  id: number
  name: string
  type?: string
  computed_balance?: number
  created_at?: string
  updated_at?: string
}

export interface FinancialTransaction {
  id: number
  financial_account_id: number
  account?: FinancialAccount | null
  type: 'income' | 'expense'
  amount: number
  date: string
  description: string | null
  referenceable_type: string | null
  referenceable_id: number | null
  is_manual: boolean
  created_by?: { id: number; name?: string } | null
  created_at?: string
  updated_at?: string
}

export interface Employee {
  id: number
  name: string
  position: string | null
  salary: number
  transactions?: EmployeeTransaction[]
  payrolls?: Payroll[]
  created_at?: string
  updated_at?: string
}

export interface EmployeeTransaction {
  id: number
  employee_id: number
  employee?: Employee | null
  type: 'bonus' | 'deduction' | 'loan'
  amount: number
  description: string | null
  date: string
  created_at?: string
  updated_at?: string
}

export interface Payroll {
  id: number
  employee_id: number
  employee?: Employee | null
  month: number
  year: number
  total_bonus: number
  total_deductions: number
  total_loans: number
  net_salary: number
  status: 'pending' | 'paid'
  created_at?: string
  updated_at?: string
}
