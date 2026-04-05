/**
 * Validation schemas matching backend API request rules.
 * Based on Laravel FormRequest validation rules.
 */
import {
  required,
  email,
  maxLength,
  minValue,
  maxValue,
  numeric,
  or,
  not,
} from '@vuelidate/validators'

/** Optional email: valid when empty or valid email format */
export const optionalEmail = or(not(required), email)

/** Product Category - StoreProductCategoryRequest */
export const productCategoryRules = {
  name: {
    required,
    maxLength: maxLength(255),
  },
}

/** Asset Category - same rules as product category */
export const assetCategoryRules = productCategoryRules

/** Asset - StoreAssetRequest (client-side mirror) */
export const assetRules = {
  name: {
    required,
    maxLength: maxLength(255),
  },
  code: {
    maxLength: maxLength(64),
  },
  purchase_price: {
    required,
    numeric,
    minValue: minValue(0),
  },
  purchase_date: {
    required,
  },
  status: {
    required,
  },
  location: {
    maxLength: maxLength(255),
  },
  notes: {
    maxLength: maxLength(65535),
  },
}

/** Product - StoreProductRequest */
export const productRules = {
  product_code: {
    maxLength: maxLength(50),
  },
  name: {
    required,
    maxLength: maxLength(255),
  },
  product_category_id: {}, // nullable, no validation
  unit: {
    required,
    maxLength: maxLength(255),
  },
  purchase_price: {
    required,
    numeric,
    minValue: minValue(0),
  },
  sale_price: {
    required,
    numeric,
    minValue: minValue(0),
  },
  quantity: {
    required,
    numeric,
    minValue: minValue(0),
  },
  min_quantity: {
    required,
    numeric,
    minValue: minValue(0),
  },
  description: {
    maxLength: maxLength(65535),
  },
}

/** Supplier - StoreSupplierRequest */
export const supplierRules = {
  name: {
    required,
    maxLength: maxLength(255),
  },
  phone: {
    maxLength: maxLength(255),
  },
  email: {
    optionalEmail,
    maxLength: maxLength(255),
  },
  address: {
    maxLength: maxLength(255),
  },
  notes: {
    maxLength: maxLength(65535),
  },
}

/** Financial Transaction - StoreFinancialTransactionRequest */
export const financialTransactionRules = {
  financial_account_id: {
    required,
  },
  type: {
    required,
  },
  amount: {
    required,
    numeric,
    minValue: minValue(0),
  },
  date: {
    required,
  },
  description: {
    required,
    maxLength: maxLength(65535),
  },
}

/** Customer - StoreCustomerRequest (same as Supplier) */
export const customerRules = {
  name: {
    required,
    maxLength: maxLength(255),
  },
  phone: {
    maxLength: maxLength(255),
  },
  email: {
    optionalEmail,
    maxLength: maxLength(255),
  },
  address: {
    maxLength: maxLength(255),
  },
  notes: {
    maxLength: maxLength(65535),
  },
}

/** Employee - StoreEmployeeRequest */
export const employeeRules = {
  name: {
    required,
    maxLength: maxLength(255),
  },
  position: {
    maxLength: maxLength(255),
  },
  salary: {
    required,
    numeric,
    minValue: minValue(0),
  },
}

/** EmployeeTransaction - StoreEmployeeTransactionRequest.
 * Note: financial_account_id is required when type=loan; validated in form component. */
export const employeeTransactionRules = {
  employee_id: {
    required,
  },
  type: {
    required,
  },
  amount: {
    required,
    numeric,
    minValue: minValue(0.01),
  },
  date: {
    required,
  },
  description: {
    maxLength: maxLength(65535),
  },
}

/** EmployeeAttendance - store/update */
export const employeeAttendanceRules = {
  employee_id: {
    required,
  },
  work_date: {
    required,
  },
  notes: {
    maxLength: maxLength(2000),
  },
}

/** Payroll - StorePayrollRequest */
export const payrollRules = {
  employee_id: {
    required,
  },
  month: {
    required,
    numeric,
    minValue: minValue(1),
    maxValue: maxValue(12),
  },
  year: {
    required,
    numeric,
    minValue: minValue(2000),
    maxValue: maxValue(2100),
  },
}
