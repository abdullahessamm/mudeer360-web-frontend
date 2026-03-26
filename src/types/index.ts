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
  product_code?: string | null
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

/** GET /api/products/{id}/stock-movements */
export interface ProductStockMovement {
  id: number
  product_id: number
  direction: 'in' | 'out'
  quantity: number
  source: string
  source_label: string
  sale_invoice_id: number | null
  purchase_invoice_id: number | null
  sale_invoice_number?: string | null
  purchase_invoice_number?: string | null
  created_at?: string
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
  is_dispensed?: boolean
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
  payments?: InvoicePaymentLine[]
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
  is_received?: boolean
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
  payments?: FinancialTransaction[]
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

/** Payload for add/update payment (sale: optional balance + cash split; purchase: cash only) */
export interface PaymentPayload {
  amount: number
  /** Portion paid from customer prepaid balance (sale invoices only). */
  balance_amount?: number
  date: string
  financial_account_id?: number | null
  description?: string
}

/** Unified line from GET sale-invoices/{id}/payments */
export type InvoicePaymentLine =
  | {
      payment_type: 'cash'
      id: number
      amount: number
      date: string
      description?: string | null
      financial_account_id: number
      account?: FinancialAccount | null
      created_at?: string
    }
  | {
      payment_type: 'balance'
      id: number
      amount: number
      date: string
      description?: string | null
      created_at?: string
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

export interface SupplierSummary {
  total_received_amount: number
  total_remaining_receive: number
  total_remaining: number
  total_dues: number
}

export interface SupplierWithInvoices extends Supplier {
  purchase_invoices: PurchaseInvoice[]
  summary?: SupplierSummary
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  balance?: number
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

export interface CustomerSummary {
  total_dispensed_amount: number
  total_remaining_dispense: number
  total_remaining: number
  total_dues: number
}

export interface CustomerWithInvoices extends Customer {
  invoices: SaleInvoice[]
  summary?: CustomerSummary
}

export type FinancialAccountTypeValue =
  | 'cash'
  | 'bank'
  | 'electronic_wallet'
  | 'check'
  | 'other'

export interface FinancialAccount {
  id: number
  name: string
  type?: FinancialAccountTypeValue | string
  computed_balance?: number
  created_at?: string
  updated_at?: string
}

/** Backend `FinancialExpenseTypeEnum` (manual + system). */
export type FinancialExpenseType =
  | 'purchase_invoice'
  | 'payroll'
  | 'employee'
  | 'customer_balance'
  | 'rent'
  | 'utilities'
  | 'supplies'
  | 'salaries'
  | 'marketing'
  | 'other'

/** Backend `FinancialIncomeTypeEnum` (manual + system). */
export type FinancialIncomeType =
  | 'sale_invoice'
  | 'customer_balance'
  | 'retail'
  | 'services'
  | 'wholesale'
  | 'subscription'
  | 'other'

export interface FinancialTransaction {
  id: number
  financial_account_id: number
  account?: FinancialAccount | null
  type: 'income' | 'expense'
  /** Expense rows only; manual cashbook uses rent/…/other. */
  expense_type?: FinancialExpenseType | string | null
  /** Income rows only; manual cashbook uses retail/…/other. */
  income_type?: FinancialIncomeType | string | null
  /** Purchase invoice payment expenses only. */
  supplier_name?: string | null
  /** Sale invoice cash income only. */
  customer_name?: string | null
  /** Purchase invoice # (expense) or sale invoice # (income). */
  invoice_number?: string | null
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

/** GET /api/customers/{id}/balance-transactions */
export interface CustomerBalanceTransaction {
  id: number
  change_amount: number
  type: 'manual_charge' | 'manual_withdraw' | 'invoice_payment'
  sale_invoice_id: number | null
  invoice_number?: string | null
  financial_transactions?: FinancialTransaction[]
  description?: string | null
  date: string
  created_at?: string
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
