<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import html2pdf from 'html2pdf.js'
import { useConfirm } from 'primevue/useconfirm'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import { getReceiveStats, RECEIVE_STATUS_LABELS, RECEIVE_STATUS_SEVERITY } from '@/lib/receive'
import { showError, showSuccess } from '@/composables/useToast'
import { exportAccountStatement } from '@/composables/useExportAccountStatement'
import { useSuppliersStore } from '@/stores/suppliers'
import { usePurchasesStore } from '@/stores/purchases'
import { useProductsStore } from '@/stores/products'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'
import PurchaseInvoiceForm from '@/components/forms/PurchaseInvoiceForm.vue'
import PaymentForm from '@/components/forms/PaymentForm.vue'
import Paginator from 'primevue/paginator'
import type { SupplierWithInvoices, InvoicePaymentLine, SupplierBalanceTransaction, PaginatedPayload } from '@/types'
import type { PurchaseInvoice, PurchaseInvoiceCreatePayload, PaymentPayload } from '@/types'
import { formatMoney, formatIssuedAt } from '@/lib/format'

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const store = useSuppliersStore()
const purchasesStore = usePurchasesStore()
const productsStore = useProductsStore()
const accountsStore = useFinancialAccountsStore()

const supplier = ref<SupplierWithInvoices | null>(null)
const loading = ref(true)
const detailsDialogVisible = ref(false)
const selectedInvoice = ref<PurchaseInvoice | null>(null)

const invoiceDialogVisible = ref(false)
const isEditInvoice = ref(false)
const editingInvoiceId = ref<number | null>(null)
const formModel = ref<Partial<PurchaseInvoice> | null>(null)

const paymentDialogVisible = ref(false)
const isEditPayment = ref(false)
const editingPaymentId = ref<number | null>(null)
const paymentFormModel = ref<Partial<PaymentPayload> | null>(null)
const receivingItemId = ref<number | null>(null)

const invoicePdfRoot = ref<HTMLElement | null>(null)
const pdfExporting = ref(false)
const issuedAtTimestamp = ref(Date.now())

const issuedAtLabel = computed(() =>
  formatIssuedAt(issuedAtTimestamp.value),
)

const supplierId = computed(() => Number(route.params.id))

// Dialog visibility flags
const chargeDialogVisible = ref(false)
const withdrawDialogVisible = ref(false)
const initialBalanceDialogVisible = ref(false)
const balanceHistoryDialogVisible = ref(false)
const bulkPaymentDialogVisible = ref(false)
const bulkPaymentSubmitting = ref(false)
const bulkDiscountDialogVisible = ref(false)
const bulkDiscountSubmitting = ref(false)

// Forms data refs
const bulkPaymentForm = ref({
  amount: 0,
  date: formatDateLocal(new Date()),
  financial_account_id: null as number | null,
  description: '',
})

const bulkDiscountForm = ref({
  amount: 0,
  distribution_method: 'proportional' as 'proportional' | 'oldest_first',
  description: '',
})

const distributionMethodOptions = [
  { label: 'توزيع نسبي حسب المتبقي', value: 'proportional' },
  { label: 'الأقدم أولاً', value: 'oldest_first' },
]

const totalSupplierUnpaidDues = computed(() => {
  const list = supplier.value?.purchase_invoices ?? []
  return list.reduce((sum, inv) => sum + Math.max(0, inv.total_amount - inv.paid_amount), 0)
})

const chargeForm = ref({
  amount: 0,
  date: formatDateLocal(new Date()),
  financial_account_id: null as number | null,
  description: '',
})

const withdrawForm = ref({
  amount: 0,
  date: formatDateLocal(new Date()),
  financial_account_id: null as number | null,
  description: '',
})

const initialBalanceForm = ref({
  amount: 0,
  date: formatDateLocal(new Date()),
  description: '',
})

const balanceTxRows = ref<SupplierBalanceTransaction[]>([])
const balanceTxMeta = ref<PaginatedPayload<SupplierBalanceTransaction>['meta'] | null>(null)
const balanceTxLoading = ref(false)

function formatBalance(n: number | undefined) {
  const val = n ?? 0
  if (val < -0.001) {
    return `${formatMoney(Math.abs(val))} دائن`
  } else if (val > 0.001) {
    return `${formatMoney(val)} مدين`
  }
  return formatMoney(0)
}

function balanceTxTypeLabel(type: string) {
  const map: Record<string, string> = {
    manual_charge: 'شحن رصيد (إيداع)',
    manual_withdraw: 'سحب رصيد',
    invoice_payment: 'دفع فاتورة شراء',
    initial_balance: 'رصيد افتتاحي',
  }
  return map[type] ?? type
}

function openChargeDialog() {
  chargeForm.value = {
    amount: 0,
    date: formatDateLocal(new Date()),
    financial_account_id: accountOptions.value[0]?.value ?? null,
    description: '',
  }
  chargeDialogVisible.value = true
}

function setChargeDate(v: Date | Date[] | (Date | null)[] | null | undefined) {
  const raw = Array.isArray(v) ? v[0] : v
  const d = raw instanceof Date ? raw : new Date()
  chargeForm.value.date = formatDateLocal(d)
}

async function onChargeSubmit() {
  if (!supplier.value || chargeForm.value.amount <= 0) return
  try {
    await store.chargeBalance(supplier.value.id, {
      amount: chargeForm.value.amount,
      date: chargeForm.value.date,
      description: chargeForm.value.description || undefined,
      financial_account_id: chargeForm.value.financial_account_id ?? undefined,
    })
    showSuccess('تم شحن رصيد المورد بنجاح')
    chargeDialogVisible.value = false
    await refetchSupplier()
    if (balanceHistoryDialogVisible.value) {
      await loadBalanceHistory(balanceTxMeta.value?.current_page ?? 1)
    }
  } catch {
    // toast handled by watch
  }
}

function openWithdrawDialog() {
  withdrawForm.value = {
    amount: 0,
    date: formatDateLocal(new Date()),
    financial_account_id: accountOptions.value[0]?.value ?? null,
    description: '',
  }
  withdrawDialogVisible.value = true
}

function setWithdrawDate(v: Date | Date[] | (Date | null)[] | null | undefined) {
  const raw = Array.isArray(v) ? v[0] : v
  const d = raw instanceof Date ? raw : new Date()
  withdrawForm.value.date = formatDateLocal(d)
}

async function onWithdrawSubmit() {
  if (!supplier.value || withdrawForm.value.amount <= 0) return
  try {
    await store.withdrawBalance(supplier.value.id, {
      amount: withdrawForm.value.amount,
      date: withdrawForm.value.date,
      description: withdrawForm.value.description || undefined,
      financial_account_id: withdrawForm.value.financial_account_id ?? undefined,
    })
    showSuccess('تم سحب رصيد المورد بنجاح')
    withdrawDialogVisible.value = false
    await refetchSupplier()
    if (balanceHistoryDialogVisible.value) {
      await loadBalanceHistory(balanceTxMeta.value?.current_page ?? 1)
    }
  } catch {
    // toast handled by watch
  }
}

async function openInitialBalanceDialog() {
  initialBalanceForm.value = {
    amount: 0,
    date: formatDateLocal(new Date()),
    description: '',
  }
  initialBalanceDialogVisible.value = true
  if (!supplier.value) return
  try {
    const res = await store.fetchBalanceTransactions(supplier.value.id, 1, 1, 'initial_balance')
    const row = res.data[0]
    if (row) {
      initialBalanceForm.value = {
        amount: row.change_amount,
        date:
          typeof row.date === 'string'
            ? row.date.slice(0, 10)
            : formatDateLocal(new Date(row.date)),
        description: row.description ?? '',
      }
    }
  } catch {
    // keep defaults
  }
}

function setInitialBalanceDate(v: Date | Date[] | (Date | null)[] | null | undefined) {
  const raw = Array.isArray(v) ? v[0] : v
  const d = raw instanceof Date ? raw : new Date()
  initialBalanceForm.value.date = formatDateLocal(d)
}

async function onInitialBalanceSubmit() {
  if (!supplier.value) return
  const raw = initialBalanceForm.value.amount
  if (raw === null || raw === undefined || Number.isNaN(Number(raw))) {
    showError('أدخل المبلغ (أو 0 لإزالة الرصيد الافتتاحي)')
    return
  }
  let amount = Number(raw)
  if (Math.abs(amount) < 0.0001) amount = 0
  try {
    await store.setInitialBalance(supplier.value.id, {
      amount,
      date: initialBalanceForm.value.date,
      description: initialBalanceForm.value.description.trim() || undefined,
    })
    showSuccess(amount === 0 ? 'تم إلغاء الرصيد الافتتاحي' : 'تم حفظ الرصيد الافتتاحي')
    initialBalanceDialogVisible.value = false
    await refetchSupplier()
    if (balanceHistoryDialogVisible.value) {
      await loadBalanceHistory(balanceTxMeta.value?.current_page ?? 1)
    }
  } catch {
    // toast handled by watch
  }
}

async function loadBalanceHistory(page = 1) {
  if (!supplier.value) return
  balanceTxLoading.value = true
  try {
    const res = await store.fetchBalanceTransactions(supplier.value.id, page, 15)
    balanceTxRows.value = res.data
    balanceTxMeta.value = res.meta
  } catch {
    balanceTxRows.value = []
    balanceTxMeta.value = null
  } finally {
    balanceTxLoading.value = false
  }
}

function onBalanceTxPage(e: { page: number; first: number; rows: number }) {
  loadBalanceHistory(e.page + 1)
}

const bulkPaymentPreview = computed(() => {
  const amt = bulkPaymentForm.value.amount || 0
  const dues = totalSupplierUnpaidDues.value

  if (dues <= 0) {
    return {
      title: 'إيداع كامل المبلغ في رصيد المورد',
      message: `لا توجد فواتير غير مدفوعة حالياً للمورد. سيتم إضافة كامل المبلغ (${formatMoney(amt)}) كرصيد دائن للمورد.`,
      boxClass: 'bg-blue-50 text-blue-900 border-1 border-blue-200',
      icon: 'pi pi-info-circle text-blue-600',
    }
  }

  if (amt > dues) {
    const residual = amt - dues
    return {
      title: 'سداد كامل الفواتير + إضافة الفائض للرصيد',
      message: `سيتم سداد كامل الفواتير المتبقية بمبلغ ${formatMoney(dues)}، وإضافة المبلغ المتبقي (${formatMoney(residual)}) إلى رصيد المورد كدفعة مقدمة.`,
      boxClass: 'bg-green-50 text-green-900 border-1 border-green-200',
      icon: 'pi pi-check-circle text-green-600',
    }
  }

  return {
    title: 'تسوية جزئية لأقدم الفواتير',
    message: `سيتم توزيع المبلغ (${formatMoney(amt)}) لسداد أقدم الفواتير غير المدفوعة أو المدفوعة جزئياً بالترتيب.`,
    boxClass: 'bg-amber-50 text-amber-900 border-1 border-amber-200',
    icon: 'pi pi-info-circle text-amber-600',
  }
})

function openBulkPaymentDialog() {
  bulkPaymentForm.value = {
    amount: totalSupplierUnpaidDues.value > 0 ? totalSupplierUnpaidDues.value : 0,
    date: formatDateLocal(new Date()),
    financial_account_id: accountOptions.value[0]?.value ?? null,
    description: '',
  }
  bulkPaymentDialogVisible.value = true
}

function setBulkPaymentDate(v: Date | Date[] | (Date | null)[] | null | undefined) {
  const raw = Array.isArray(v) ? v[0] : v
  const d = raw instanceof Date ? raw : new Date()
  bulkPaymentForm.value.date = formatDateLocal(d)
}

async function onBulkPaymentSubmit() {
  if (!supplier.value) return
  if (bulkPaymentForm.value.amount <= 0) {
    showError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
    return
  }
  if (!bulkPaymentForm.value.financial_account_id) {
    showError('يرجى اختيار الحساب المالي')
    return
  }
  bulkPaymentSubmitting.value = true
  try {
    await store.bulkPayment(supplier.value.id, {
      amount: bulkPaymentForm.value.amount,
      financial_account_id: bulkPaymentForm.value.financial_account_id,
      date: bulkPaymentForm.value.date,
      description: bulkPaymentForm.value.description || undefined,
    })
    showSuccess('تم سداد الفواتير وإجراء التسوية بنجاح')
    bulkPaymentDialogVisible.value = false
    await refetchSupplier()
    if (balanceHistoryDialogVisible.value) {
      await loadBalanceHistory(balanceTxMeta.value?.current_page ?? 1)
    }
  } catch {
    // toast handled by store/watch
  } finally {
    bulkPaymentSubmitting.value = false
  }
}

const unpaidAndPartialInvoices = computed(() => {
  const list = supplier.value?.purchase_invoices ?? []
  return list.filter((inv) => Math.max(0, inv.total_amount - inv.paid_amount) > 0.0001)
})

const bulkDiscountAllocationPreview = computed(() => {
  const list = unpaidAndPartialInvoices.value
  const totalDues = totalSupplierUnpaidDues.value
  const discountAmt = Math.min(bulkDiscountForm.value.amount || 0, totalDues)
  const method = bulkDiscountForm.value.distribution_method

  if (list.length === 0 || discountAmt <= 0) {
    return list.map((inv) => {
      const rem = Math.max(0, inv.total_amount - inv.paid_amount)
      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        remaining_before: rem,
        allocated_discount: 0,
        remaining_after: rem,
      }
    })
  }

  const allocatedMap: Record<number, number> = {}

  if (method === 'oldest_first') {
    let remainingToDistribute = discountAmt
    const sorted = [...list].sort(
      (a, b) => (a.invoice_date || '').localeCompare(b.invoice_date || '') || a.id - b.id,
    )
    for (const inv of sorted) {
      const rem = Math.max(0, inv.total_amount - inv.paid_amount)
      const d = Math.min(rem, remainingToDistribute)
      allocatedMap[inv.id] = Math.round(d * 100) / 100
      remainingToDistribute = Math.round((remainingToDistribute - d) * 100) / 100
    }
  } else {
    // Proportional
    let allocatedSum = 0
    const count = list.length
    for (let i = 0; i < count; i++) {
      const inv = list[i]
      if (!inv) continue
      const rem = Math.max(0, inv.total_amount - inv.paid_amount)
      let d = 0
      if (totalDues > 0) {
        const ratio = rem / totalDues
        if (i === count - 1) {
          d = Math.min(rem, Math.round((discountAmt - allocatedSum) * 100) / 100)
        } else {
          d = Math.min(rem, Math.round(discountAmt * ratio * 100) / 100)
        }
      }
      d = Math.max(0, d)
      allocatedMap[inv.id] = d
      allocatedSum = Math.round((allocatedSum + d) * 100) / 100
    }

    let discrepancy = Math.round((discountAmt - allocatedSum) * 100) / 100
    if (Math.abs(discrepancy) > 0.0001) {
      for (const inv of list) {
        if (discrepancy <= 0) break
        const rem = Math.max(0, inv.total_amount - inv.paid_amount)
        const room = Math.round((rem - (allocatedMap[inv.id] || 0)) * 100) / 100
        if (room > 0.0001) {
          const add = Math.min(room, discrepancy)
          allocatedMap[inv.id] = Math.round(((allocatedMap[inv.id] || 0) + add) * 100) / 100
          discrepancy = Math.round((discrepancy - add) * 100) / 100
        }
      }
    }
  }

  return list.map((inv) => {
    const rem = Math.max(0, inv.total_amount - inv.paid_amount)
    const d = allocatedMap[inv.id] || 0
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      remaining_before: rem,
      allocated_discount: d,
      remaining_after: Math.max(0, Math.round((rem - d) * 100) / 100),
    }
  })
})

function openBulkDiscountDialog() {
  bulkDiscountForm.value = {
    amount: 0,
    distribution_method: 'proportional',
    description: '',
  }
  bulkDiscountDialogVisible.value = true
}

async function onBulkDiscountSubmit() {
  if (!supplier.value) return
  const amt = bulkDiscountForm.value.amount
  if (amt <= 0) {
    showError('يرجى إدخال مبلغ خصم صحيح أكبر من الصفر')
    return
  }
  if (amt > totalSupplierUnpaidDues.value) {
    showError(`مبلغ الخصم لا يمكن أن يتجاوز إجمالي المتبقي (${formatMoney(totalSupplierUnpaidDues.value)})`)
    return
  }
  bulkDiscountSubmitting.value = true
  try {
    await store.bulkDiscount(supplier.value.id, {
      amount: amt,
      distribution_method: bulkDiscountForm.value.distribution_method,
      description: bulkDiscountForm.value.description || undefined,
    })
    showSuccess('تم تطبيق الخصم الإجمالي بنجاح')
    bulkDiscountDialogVisible.value = false
    await refetchSupplier()
  } catch {
    // toast handled by store/watch
  } finally {
    bulkDiscountSubmitting.value = false
  }
}

const filters = ref({
  dateRange: getCurrentMonthRange() as [Date, Date] | null,
})

function toYMD(d: Date) {
  return formatDateLocal(d)
}

function getDateRange(): { from: string; to: string } | null {
  const range = filters.value.dateRange
  if (!range) return null
  const arr = Array.isArray(range) ? range : [range]
  const d0 = arr[0]
  if (!d0 || !(d0 instanceof Date)) return null
  const from = toYMD(d0)
  const d1 = arr[1]
  const to = d1 && d1 instanceof Date ? toYMD(d1) : from
  return { from, to }
}

/** Stable empty array to avoid "Maximum recursive updates exceeded" in DataTable */
const EMPTY_INVOICES: PurchaseInvoice[] = []

/** Invoices filtered by date range (frontend filter for reliability) */
const invoices = computed(() => {
  const list = supplier.value?.purchase_invoices ?? EMPTY_INVOICES
  const range = getDateRange()
  if (!range) return list
  return list.filter((inv) => {
    const d = inv.invoice_date
    if (!d) return false
    const dateStr = typeof d === 'string' ? d.slice(0, 10) : d
    return dateStr >= range.from && dateStr <= range.to
  })
})

const invoiceSummary = computed(() => {
  const list = invoices.value
  const balanceVal = supplier.value?.balance ?? 0
  const totalAmount = list.reduce((sum, inv) => sum + inv.total_amount, 0)
  const paidAmount = list.reduce((sum, inv) => sum + inv.paid_amount, 0)
  const remainingInvoices = list.reduce(
    (sum, inv) => sum + Math.max(0, inv.total_amount - inv.paid_amount),
    0,
  )
  const remainingAmount = -balanceVal + remainingInvoices
  let totalReceived = 0
  let totalRemainingReceive = 0
  for (const inv of list) {
    const items = inv.items ?? []
    for (const i of items) {
      const itemTotal = i.total_price ?? i.quantity * i.unit_price
      if (i.is_received) totalReceived += itemTotal
      else totalRemainingReceive += itemTotal
    }
  }
  const totalDues = totalRemainingReceive - remainingAmount
  return {
    count: list.length,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
    total_received_amount: totalReceived,
    total_remaining_receive: totalRemainingReceive,
    total_dues: totalDues,
  }
})

const supplierOptionsForForm = computed(() =>
  supplier.value ? [{ label: supplier.value.name, value: supplier.value.id }] : [],
)

const productOptions = computed(() =>
  productsStore.allProducts.map((p) => ({
    label: p.product_code ? `${p.product_code} - ${p.name}` : p.name,
    value: p.id,
    purchase_price: p.purchase_price,
  })),
)

const accountOptions = computed(() =>
  accountsStore.items.map((a) => ({ label: a.name, value: a.id })),
)

const remainingAmount = computed(() => {
  const inv = selectedInvoice.value
  if (!inv) return 0
  return Math.max(0, inv.total_amount - inv.paid_amount)
})

const formTitle = computed(() => (isEditInvoice.value ? 'تعديل الفاتورة' : 'إضافة فاتورة شراء'))

const balancesFormTitle = computed(() => {
  return initialBalanceDialogVisible.value
    ? 'تعيين الرصيد الافتتاحي'
    : 'سجل رصيد المورد'
})

function getInvoiceDiscountRatio(invoice: PurchaseInvoice) {
  return invoice.subtotal_amount > 0 ? (invoice.total_amount / invoice.subtotal_amount) : 1
}

const paymentFormTitle = computed(() => (isEditPayment.value ? 'تعديل الدفعة' : 'إضافة دفعة'))

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    paid: 'مدفوع',
    partial: 'مدفوع جزئياً',
    unpaid: 'غير مدفوع',
  }
  return map[status] ?? status
}

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    cash: 'نقدي',
    credit: 'آجل',
  }
  return map[type] ?? type
}

function goBack() {
  router.push({ name: 'suppliers' })
}

function formatAmount(n: number) {
  return formatMoney(n)
}

function sanitizeFilename(name: string) {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'invoice'
}

function getPurchaseInvoicePdfOptions() {
  if (!selectedInvoice.value || !supplier.value) return null
  return {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: `${sanitizeFilename(`purchase-${selectedInvoice.value.invoice_number}-${supplier.value.name}`)}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.92 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
  }
}

/** يفتح PDF في تبويب جديد (يمكن الطباعة من عارض PDF) */
async function printPurchaseInvoice() {
  if (!invoicePdfRoot.value) return
  const opt = getPurchaseInvoicePdfOptions()
  if (!opt) return
  issuedAtTimestamp.value = Date.now()
  pdfExporting.value = true
  await nextTick()
  await nextTick()
  try {
    const blob = (await html2pdf().set(opt).from(invoicePdfRoot.value).outputPdf('blob')) as Blob
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 120_000)
  } catch {
    showError('تعذّر إنشاء ملف PDF')
  } finally {
    pdfExporting.value = false
  }
}

async function downloadPurchaseInvoicePdf() {
  if (!invoicePdfRoot.value) return
  const opt = getPurchaseInvoicePdfOptions()
  if (!opt) return
  issuedAtTimestamp.value = Date.now()
  pdfExporting.value = true
  await nextTick()
  await nextTick()
  try {
    await html2pdf().set(opt).from(invoicePdfRoot.value).save()
    showSuccess('تم تحميل ملف PDF')
  } catch {
    showError('تعذّر إنشاء ملف PDF')
  } finally {
    pdfExporting.value = false
  }
}

async function openInvoiceDetails(invoice: PurchaseInvoice, openPaymentAfter = false) {
  try {
    const [full] = await Promise.all([
      purchasesStore.fetchById(invoice.id),
      purchasesStore.fetchPayments(invoice.id),
    ])
    selectedInvoice.value = full ? { ...full, payments: purchasesStore.payments } : null
    detailsDialogVisible.value = true
    if (openPaymentAfter) {
      openAddPayment()
    }
  } catch {
    // error shown via toast
  }
}

function closeDetailsDialog() {
  detailsDialogVisible.value = false
  selectedInvoice.value = null
}

async function refetchSupplier() {
  if (!supplierId.value) return
  const updated = await store.fetchById(supplierId.value)
  if (updated) supplier.value = updated
}

function exportToExcel() {
  if (!supplier.value) return
  exportAccountStatement({
    accountName: supplier.value.name,
    accountType: 'supplier',
    invoices: invoices.value.map((inv) => ({
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      type: inv.type,
      total_amount: inv.total_amount,
      paid_amount: inv.paid_amount,
      status: inv.status,
    })),
    summary: invoiceSummary.value,
    dateRange: getDateRange() ?? undefined,
  })
  showSuccess('تم تصدير كشف الحساب بنجاح')
}

function openCreateInvoice() {
  if (!supplier.value) return
  isEditInvoice.value = false
  editingInvoiceId.value = null
  formModel.value = {
    supplier_id: supplierId.value,
    type: 'credit',
    invoice_date: formatDateLocal(new Date()),
    items: [],
  }
  invoiceDialogVisible.value = true
}

function openEditInvoice(invoice: PurchaseInvoice) {
  if (invoice.status !== 'unpaid') return
  isEditInvoice.value = true
  editingInvoiceId.value = invoice.id
  formModel.value = {
    supplier_id: invoice.supplier_id,
    supplier: invoice.supplier,
    type: invoice.type,
    invoice_date: invoice.invoice_date,
    items: invoice.items ?? [],
  }
  invoiceDialogVisible.value = true
  detailsDialogVisible.value = false
}

async function onInvoiceFormSubmit(payload: PurchaseInvoiceCreatePayload) {
  try {
    if (isEditInvoice.value && editingInvoiceId.value !== null) {
      await purchasesStore.update(editingInvoiceId.value, payload)
      showSuccess('تم تحديث الفاتورة بنجاح')
    } else {
      await purchasesStore.create(payload)
      showSuccess('تم إنشاء الفاتورة بنجاح')
    }
    invoiceDialogVisible.value = false
    await refetchSupplier()
  } catch {
    // error via toast
  }
}

function onInvoiceFormCancel() {
  invoiceDialogVisible.value = false
}

function confirmDeleteInvoice(invoice: PurchaseInvoice) {
  if (invoice.status !== 'unpaid') return
  confirm.require({
    message: `هل أنت متأكد من حذف الفاتورة ${invoice.invoice_number}؟`,
    header: 'تأكيد الحذف',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'إلغاء',
    acceptLabel: 'حذف',
    acceptClass: 'p-button-danger p-button-sm',
    rejectClass: 'p-button-text p-button-secondary p-button-sm',
    acceptIcon: 'pi pi-trash',
    accept: async () => {
      try {
        await purchasesStore.remove(invoice.id)
        showSuccess('تم حذف الفاتورة بنجاح')
        if (detailsDialogVisible.value && selectedInvoice.value?.id === invoice.id) {
          closeDetailsDialog()
        }
        await refetchSupplier()
      } catch {
        // error via toast
      }
    },
  })
}

function openAddPayment() {
  if (!selectedInvoice.value) return
  isEditPayment.value = false
  editingPaymentId.value = null
  paymentFormModel.value = {
    amount: remainingAmount.value,
    balance_amount: 0,
    date: formatDateLocal(new Date()),
    financial_account_id: accountOptions.value[0]?.value ?? 0,
    description: '',
  }
  paymentDialogVisible.value = true
}

function openEditPayment(payment: InvoicePaymentLine) {
  if (payment.payment_type !== 'cash') return
  isEditPayment.value = true
  editingPaymentId.value = payment.id
  paymentFormModel.value = {
    amount: payment.amount,
    date: payment.date,
    financial_account_id: payment.financial_account_id,
    description: payment.description ?? '',
  }
  paymentDialogVisible.value = true
}

async function onPaymentFormSubmit(payload: PaymentPayload) {
  if (!selectedInvoice.value) return
  try {
    let updated: PurchaseInvoice
    if (isEditPayment.value && editingPaymentId.value !== null) {
      updated = await purchasesStore.updatePayment(
        selectedInvoice.value.id,
        editingPaymentId.value,
        payload,
      )
      showSuccess('تم تحديث الدفعة بنجاح')
    } else {
      updated = await purchasesStore.pay(selectedInvoice.value.id, payload)
      showSuccess('تم إضافة الدفعة بنجاح')
    }
    paymentDialogVisible.value = false
    await purchasesStore.fetchPayments(selectedInvoice.value.id)
    selectedInvoice.value = { ...updated, payments: purchasesStore.payments }
    await refetchSupplier()
  } catch {
    // error via toast
  }
}

function onPaymentFormCancel() {
  paymentDialogVisible.value = false
}

async function onReceiveItem(invoice: PurchaseInvoice, item: { id?: number }) {
  if (!item.id) return
  receivingItemId.value = item.id
  try {
    await purchasesStore.receive(invoice.id, [item.id])
    showSuccess('تم استلام الصنف بنجاح')
    await refetchSupplier()
    if (selectedInvoice.value?.id === invoice.id) {
      const updated = supplier.value?.purchase_invoices?.find((i) => i.id === invoice.id)
      if (updated) selectedInvoice.value = updated
    }
  } catch {
    // error via toast
  } finally {
    receivingItemId.value = null
  }
}

async function onUnreceiveItem(invoice: PurchaseInvoice, item: { id?: number }) {
  if (!item.id) return
  receivingItemId.value = item.id
  try {
    await purchasesStore.unreceive(invoice.id, [item.id])
    showSuccess('تم تراجع استلام الصنف بنجاح')
    await refetchSupplier()
    if (selectedInvoice.value?.id === invoice.id) {
      const updated = supplier.value?.purchase_invoices?.find((i) => i.id === invoice.id)
      if (updated) selectedInvoice.value = updated
    }
  } catch {
    // error via toast
  } finally {
    receivingItemId.value = null
  }
}

function confirmDeletePayment(payment: InvoicePaymentLine) {
  if (!selectedInvoice.value) return
  confirm.require({
    message: `هل أنت متأكد من حذف هذه الدفعة (${payment.amount})؟`,
    header: 'تأكيد الحذف',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'إلغاء',
    acceptLabel: 'حذف',
    acceptClass: 'p-button-danger p-button-sm',
    rejectClass: 'p-button-text p-button-secondary p-button-sm',
    acceptIcon: 'pi pi-trash',
    accept: async () => {
      try {
        if (payment.payment_type === 'balance') {
          await purchasesStore.deleteBalancePayment(selectedInvoice.value!.id, payment.id)
        } else {
          await purchasesStore.deletePayment(selectedInvoice.value!.id, payment.id)
        }
        showSuccess('تم حذف الدفعة بنجاح')
        await purchasesStore.fetchPayments(selectedInvoice.value!.id)
        selectedInvoice.value = { ...selectedInvoice.value!, payments: purchasesStore.payments }
        await refetchSupplier()
      } catch {
        // error via toast
      }
    },
  })
}

watch(
  () => [store.error, purchasesStore.error],
  ([sErr, pErr]) => {
    if (sErr) {
      showError(sErr)
      store.clearError()
    }
    if (pErr) {
      showError(pErr)
      purchasesStore.clearError()
    }
  },
)

onMounted(async () => {
  const id = supplierId.value
  if (!id) {
    router.replace({ name: 'suppliers' })
    return
  }
  loading.value = true
  try {
    const [supplierData] = await Promise.all([
      store.fetchById(id),
      productsStore.fetchAllForSelect(),
      accountsStore.fetchAll(),
    ])
    supplier.value = supplierData
    if (!supplier.value) {
      showError('المورد غير موجود')
      router.replace({ name: 'suppliers' })
    }
  } catch {
    showError('فشل تحميل بيانات المورد')
    router.replace({ name: 'suppliers' })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div dir="rtl">
    <div class="flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div class="flex align-items-center gap-2 flex-wrap">
        <Button
          icon="pi pi-arrow-right"
          icon-pos="right"
          severity="secondary"
          rounded
          size="small"
          label="العودة للموردين"
          @click="goBack"
        />
        <DatePicker
          v-model="filters.dateRange"
          selection-mode="range"
          :manual-input="false"
          date-format="yy-mm-dd"
          placeholder="من تاريخ - إلى تاريخ"
          show-icon
          show-clear
          icon-display="input"
          class="w-15rem"
        />
        <Button
          v-if="supplier"
          label="تصدير Excel"
          size="small"
          icon="pi pi-file-excel"
          severity="success"
          @click="exportToExcel"
        />
      </div>
      <div class="flex align-items-center gap-2">
        <Button
          v-if="supplier"
          label="الخصم الإجمالي"
          icon="pi pi-percentage"
          severity="warn"
          @click="openBulkDiscountDialog"
        />
        <Button
          v-if="supplier"
          label="الدفع الإجمالي"
          icon="pi pi-money-bill"
          severity="success"
          @click="openBulkPaymentDialog"
        />
        <Button v-if="supplier" label="إضافة فاتورة" icon="pi pi-plus" @click="openCreateInvoice" />
      </div>
    </div>

    <div v-if="supplier" class="flex flex-wrap gap-3 mb-4">
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">رصيد المورد</div>
          <div class="text-xl font-bold text-primary">{{ formatBalance(supplier.balance) }}</div>
          <div class="flex flex-wrap gap-2 mt-2">
            <Button
              label="الدفع الإجمالي"
              icon="pi pi-money-bill"
              size="small"
              severity="success"
              @click="openBulkPaymentDialog"
            />
            <Button
              label="الخصم الإجمالي"
              icon="pi pi-percentage"
              size="small"
              severity="warn"
              @click="openBulkDiscountDialog"
            />
            <Button
              label="شحن رصيد"
              icon="pi pi-wallet"
              size="small"
              @click="openChargeDialog"
            />
            <Button
              label="الرصيد الافتتاحي"
              icon="pi pi-bookmark"
              size="small"
              severity="info"
              outlined
              @click="openInitialBalanceDialog"
            />
            <Button
              label="سحب رصيد"
              icon="pi pi-money-bill"
              size="small"
              severity="secondary"
              @click="openWithdrawDialog"
            />
            <Button
              label="سجل الرصيد"
              icon="pi pi-history"
              size="small"
              severity="help"
              outlined
              @click="balanceHistoryDialogVisible = true"
            />
          </div>
        </template>
      </Card>
    </div>

    <Dialog
      v-model:visible="balanceHistoryDialogVisible"
      header="سجل حركة رصيد المورد"
      :modal="true"
      :style="{ width: '100%', maxWidth: '960px', margin: '0 16px' }"
      :content-style="{ maxHeight: 'min(70vh, 560px)', overflow: 'auto' }"
      @show="() => loadBalanceHistory(1)"
    >
      <div class="flex flex-column gap-3">
        <DataTable
          :value="balanceTxRows"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          class="p-datatable-sm"
          :loading="balanceTxLoading"
        >
          <Column field="date" header="التاريخ" />
          <Column field="type" header="النوع">
            <template #body="{ data }">{{ balanceTxTypeLabel(data.type) }}</template>
          </Column>
          <Column field="change_amount" header="المبلغ">
            <template #body="{ data }">
              <Tag
                :value="formatAmount(data.change_amount)"
                :severity="data.change_amount >= 0 ? 'success' : 'danger'"
              />
            </template>
          </Column>
          <Column field="invoice_number" header="فاتورة">
            <template #body="{ data }">{{ data.invoice_number ?? '—' }}</template>
          </Column>
          <Column header="تسجيل نقدي">
            <template #body="{ data }">
              <Tag
                v-if="(data.financial_transactions?.length ?? 0) > 0"
                value="نعم"
                severity="info"
              />
              <span v-else class="text-color-secondary">—</span>
            </template>
          </Column>
          <Column field="description" header="الوصف">
            <template #body="{ data }">{{ data.description || '—' }}</template>
          </Column>
        </DataTable>
        <Paginator
          v-if="balanceTxMeta && balanceTxMeta.total > 0"
          :rows="balanceTxMeta.per_page"
          :total-records="balanceTxMeta.total"
          :first="(balanceTxMeta.current_page - 1) * balanceTxMeta.per_page"
          @page="onBalanceTxPage"
        />
        <p v-if="!balanceTxLoading && balanceTxRows.length === 0" class="text-color-secondary m-0">
          لا توجد حركات رصيد
        </p>
      </div>
    </Dialog>

    <div v-if="supplier && invoices.length > 0" class="flex flex-wrap gap-3 mb-4">
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">عدد الفواتير</div>
          <div class="text-xl font-bold">{{ invoiceSummary.count }}</div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">الإجمالي</div>
          <div class="text-xl font-bold">{{ formatAmount(invoiceSummary.total_amount) }}</div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">المدفوع</div>
          <div class="text-xl font-bold text-green-600">
            {{ formatAmount(invoiceSummary.paid_amount) }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">المتبقي</div>
          <div class="text-xl font-bold text-amber-600">
            {{ formatAmount(invoiceSummary.remaining_amount) }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">إجمالي المستلم</div>
          <div class="text-xl font-bold text-blue-600">
            {{ formatAmount(invoiceSummary.total_received_amount) }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">المتبقي للاستلام</div>
          <div class="text-xl font-bold text-cyan-600">
            {{ formatAmount(invoiceSummary.total_remaining_receive) }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="flex align-items-center gap-2 mb-1">
            <span class="text-color-secondary text-sm">إجمالي المستحقات</span>
            <Tag
              v-if="invoiceSummary.total_dues < -0.001"
              value="دائن"
              severity="success"
            />
            <Tag
              v-else-if="invoiceSummary.total_dues > 0.001"
              value="مدين"
              severity="danger"
            />
          </div>
          <div
            class="text-xl font-bold"
            :class="invoiceSummary.total_dues < -0.001 ? 'text-green-600' : invoiceSummary.total_dues > 0.001 ? 'text-red-600' : 'text-color-secondary'"
          >
            {{ formatAmount(Math.abs(invoiceSummary.total_dues)) }}
          </div>
        </template>
      </Card>
    </div>

    <Card v-if="loading || supplier">
      <template #title>
        <div class="flex align-items-center gap-2">
          <i class="pi pi-users"></i>
          <span>{{ loading ? 'جاري التحميل...' : `فواتير الشراء - ${supplier?.name}` }}</span>
        </div>
      </template>
      <template #content>
        <div v-if="loading" class="flex justify-content-center align-items-center py-8">
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>
        <div
          v-else-if="invoices.length === 0"
          class="flex flex-column align-items-center justify-content-center py-8 gap-3"
        >
          <i class="pi pi-file text-6xl text-color-secondary"></i>
          <p class="text-color-secondary m-0">لا توجد فواتير شراء لهذا المورد</p>
          <Button
            v-if="supplier"
            label="إضافة فاتورة"
            icon="pi pi-plus"
            @click="openCreateInvoice"
          />
        </div>
        <DataTable
          v-else
          :value="invoices"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          class="p-datatable-sm"
        >
          <Column field="invoice_number" header="رقم الفاتورة" />
          <Column field="invoice_date" header="التاريخ" />
          <Column field="type" header="النوع">
            <template #body="{ data }">{{ typeLabel(data.type) }}</template>
          </Column>
          <Column field="total_amount" header="الإجمالي">
            <template #body="{ data }">
              <Tag :value="formatAmount(data.total_amount)" severity="info" />
            </template>
          </Column>
          <Column field="paid_amount" header="المدفوع">
            <template #body="{ data }">
              <Tag :value="formatAmount(data.paid_amount)" severity="success" />
            </template>
          </Column>
          <Column header="المتبقي">
            <template #body="{ data }">
              <Tag
                :value="formatAmount(Math.max(0, data.total_amount - data.paid_amount))"
                :severity="data.total_amount - data.paid_amount > 0 ? 'warn' : 'secondary'"
              />
            </template>
          </Column>
          <Column field="status" header="الحالة">
            <template #body="{ data }">
              <Tag
                :value="statusLabel(data.status)"
                :severity="
                  data.status === 'paid' ? 'success' : data.status === 'partial' ? 'warn' : 'danger'
                "
              />
            </template>
          </Column>
          <Column header="استلام">
            <template #body="{ data }">
              <Tag
                :value="RECEIVE_STATUS_LABELS[getReceiveStats(data.items, getInvoiceDiscountRatio(data)).status]"
                :severity="RECEIVE_STATUS_SEVERITY[getReceiveStats(data.items, getInvoiceDiscountRatio(data)).status]"
              />
            </template>
          </Column>
          <Column header="تم الاستلام">
            <template #body="{ data }">
              {{ formatAmount(getReceiveStats(data.items, getInvoiceDiscountRatio(data)).receivedAmount) }}
            </template>
          </Column>
          <Column header="متبقي الاستلام">
            <template #body="{ data }">
              {{ formatAmount(getReceiveStats(data.items, getInvoiceDiscountRatio(data)).remainingAmount) }}
            </template>
          </Column>
          <Column header="الإجراءات" style="width: 260px">
            <template #body="{ data }">
              <Button
                label="عرض"
                icon="pi pi-eye"
                text
                size="small"
                class="p-button-info"
                @click="openInvoiceDetails(data)"
              />
              <Button
                v-if="data.status === 'unpaid'"
                label="تعديل"
                icon="pi pi-pencil"
                text
                size="small"
                class="p-button-success"
                @click="openEditInvoice(data)"
              />
              <Button
                v-if="data.status === 'unpaid' || data.status === 'partial'"
                label="دفعة"
                icon="pi pi-wallet"
                text
                size="small"
                class="p-button-warning"
                @click="openInvoiceDetails(data, true)"
              />
              <Button
                v-if="data.status === 'unpaid'"
                label="حذف"
                icon="pi pi-trash"
                text
                size="small"
                class="p-button-danger"
                @click="confirmDeleteInvoice(data)"
              />
            </template>
          </Column>
        </DataTable>
        <Dialog
          v-model:visible="detailsDialogVisible"
          :header="
            selectedInvoice ? `تفاصيل فاتورة ${selectedInvoice.invoice_number}` : 'تفاصيل الفاتورة'
          "
          class="invoice-details-dialog"
          :modal="true"
          :style="{ width: '100%', maxWidth: '800px', margin: '0 20px' }"
          @hide="closeDetailsDialog"
        >
          <div v-if="purchasesStore.showLoading" class="flex justify-content-center py-6">
            <i class="pi pi-spin pi-spinner text-3xl text-color-secondary"></i>
          </div>
          <div
            v-else-if="selectedInvoice"
            ref="invoicePdfRoot"
            class="purchase-invoice-doc"
            :class="{ 'purchase-invoice-doc--pdf-export': pdfExporting }"
          >
            <div class="flex flex-wrap gap-2 mb-3 no-print">
              <Button
                label="طباعة"
                icon="pi pi-print"
                size="small"
                outlined
                :loading="pdfExporting"
                :disabled="pdfExporting"
                @click="printPurchaseInvoice"
              />
              <Button
                label="تحميل PDF"
                icon="pi pi-file-pdf"
                size="small"
                severity="secondary"
                :loading="pdfExporting"
                :disabled="pdfExporting"
                @click="downloadPurchaseInvoicePdf"
              />
            </div>
            <div class="invoice-screen flex flex-column gap-4">
              <div class="flex flex-wrap gap-2 mb-2">
                <Tag
                  v-if="selectedInvoice.discount_amount > 0"
                  severity="secondary"
                  :value="`المجموع الفرعي: ${formatAmount(selectedInvoice.subtotal_amount)}`"
                />
                <Tag
                  v-if="selectedInvoice.discount_amount > 0"
                  severity="danger"
                  :value="`الخصم: -${formatAmount(selectedInvoice.discount_amount)}`"
                />
                <Tag
                  severity="info"
                  :value="`الإجمالي: ${formatAmount(selectedInvoice.total_amount)}`"
                />
                <Tag
                  severity="success"
                  :value="`المدفوع: ${formatAmount(selectedInvoice.paid_amount)}`"
                />
                <Tag
                  :severity="
                    selectedInvoice.total_amount - selectedInvoice.paid_amount > 0
                      ? 'warn'
                      : 'secondary'
                  "
                  :value="`المتبقي: ${formatAmount(Math.max(0, selectedInvoice.total_amount - selectedInvoice.paid_amount))}`"
                />
              </div>
              <div class="flex flex-wrap gap-2 mb-2" v-if="selectedInvoice.notes">
                <span class="text-color-secondary">ملاحظات:</span>
                {{ selectedInvoice.notes }}
              </div>
              <div class="flex flex-wrap gap-4 align-items-center">
                <div>
                  <span class="text-color-secondary">حالة الاستلام:</span>
                  <Tag
                    :value="RECEIVE_STATUS_LABELS[getReceiveStats(selectedInvoice.items, getInvoiceDiscountRatio(selectedInvoice)).status]"
                    :severity="
                      RECEIVE_STATUS_SEVERITY[getReceiveStats(selectedInvoice.items, getInvoiceDiscountRatio(selectedInvoice)).status]
                    "
                  />
                </div>
                <div>
                  <span class="text-color-secondary">تم الاستلام:</span>
                  {{ formatAmount(getReceiveStats(selectedInvoice.items, getInvoiceDiscountRatio(selectedInvoice)).receivedAmount) }}
                </div>
                <div>
                  <span class="text-color-secondary">متبقي الاستلام:</span>
                  {{ formatAmount(getReceiveStats(selectedInvoice.items, getInvoiceDiscountRatio(selectedInvoice)).remainingAmount) }}
                </div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <Button
                  v-if="selectedInvoice.status === 'unpaid'"
                  label="تعديل"
                  icon="pi pi-pencil"
                  size="small"
                  @click="openEditInvoice(selectedInvoice)"
                />
                <Button
                  v-if="selectedInvoice.status === 'unpaid'"
                  label="حذف"
                  icon="pi pi-trash"
                  severity="danger"
                  size="small"
                  @click="confirmDeleteInvoice(selectedInvoice)"
                />
                <Button
                  v-if="selectedInvoice.status === 'unpaid' || selectedInvoice.status === 'partial'"
                  label="إضافة دفعة"
                  icon="pi pi-plus"
                  size="small"
                  @click="openAddPayment"
                />
              </div>
              <div v-if="selectedInvoice.items?.length" class="invoice-details">
                <h4 class="mt-0 mb-2 text-base">الأصناف</h4>
                <DataTable
                  :value="selectedInvoice.items"
                  size="small"
                  class="p-datatable-sm"
                  show-gridlines
                >
                  <Column field="product_name" header="المنتج">
                    <template #body="{ data: item }">
                      <span>{{ item.product?.name ?? item.product_name ?? '—' }}</span>
                      <Tag
                        v-if="item.is_received"
                        value="تم الاستلام"
                        severity="success"
                        class="mr-2"
                      />
                      <Tag
                        v-if="item.returned_quantity > 0"
                        :value="`تم إرجاع: ${item.returned_quantity}`"
                        severity="danger"
                        class="mr-2"
                      />
                    </template>
                  </Column>
                  <Column field="quantity" header="الكمية" />
                  <Column field="unit_price" header="سعر الوحدة">
                    <template #body="{ data: item }">{{ formatAmount(item.unit_price) }}</template>
                  </Column>
                  <Column field="total_price" header="المجموع">
                    <template #body="{ data: item }">{{
                      formatAmount(item.total_price ?? item.quantity * item.unit_price)
                    }}</template>
                  </Column>
                  <Column header="الإجراءات" style="width: 140px">
                    <template #body="{ data: item }">
                      <Button
                        v-if="!item.is_received && item.id"
                        label="استلام"
                        icon="pi pi-box"
                        text
                        size="small"
                        severity="secondary"
                        :loading="receivingItemId === item.id"
                        @click="onReceiveItem(selectedInvoice, item)"
                      />
                      <Button
                        v-else-if="item.is_received && item.id"
                        label="تراجع"
                        icon="pi pi-undo"
                        text
                        size="small"
                        severity="warn"
                        :loading="receivingItemId === item.id"
                        :disabled="item.returned_quantity > 0"
                        @click="onUnreceiveItem(selectedInvoice, item)"
                      />
                    </template>
                  </Column>
                </DataTable>
              </div>
              <div v-if="selectedInvoice.other_costs?.length" class="invoice-details">
                <h4 class="mt-0 mb-2 text-base">التكاليف الأخرى</h4>
                <DataTable
                  :value="selectedInvoice.other_costs"
                  size="small"
                  class="p-datatable-sm"
                  show-gridlines
                >
                  <Column field="description" header="الوصف / البيان" />
                  <Column field="cost" header="التكلفة" style="width: 140px">
                    <template #body="{ data }">{{ formatAmount(data.cost) }}</template>
                  </Column>
                </DataTable>
              </div>
              <div class="invoice-details">
                <h4 class="mt-0 mb-2 text-base">الدفعات</h4>
                <DataTable
                  v-if="selectedInvoice.payments?.length"
                  :value="selectedInvoice.payments"
                  size="small"
                  class="p-datatable-sm"
                  show-gridlines
                >
                  <Column header="النوع" style="width: 6rem">
                    <template #body="{ data: pmt }">
                      <Tag
                        :value="pmt.payment_type === 'balance' ? 'رصيد' : 'نقدي'"
                        :severity="pmt.payment_type === 'balance' ? 'info' : 'success'"
                      />
                    </template>
                  </Column>
                  <Column field="date" header="التاريخ" />
                  <Column field="amount" header="المبلغ">
                    <template #body="{ data: pmt }">{{ formatAmount(pmt.amount) }}</template>
                  </Column>
                  <Column header="الحساب">
                    <template #body="{ data: pmt }">
                      <span v-if="pmt.payment_type === 'balance'">—</span>
                      <span v-else>{{ pmt.account?.name ?? '—' }}</span>
                    </template>
                  </Column>
                  <Column field="description" header="الوصف">
                    <template #body="{ data: pmt }">{{ pmt.description ?? '—' }}</template>
                  </Column>
                  <Column header="الإجراءات" style="width: 100px">
                    <template #body="{ data: pmt }">
                      <Button
                        v-if="pmt.payment_type === 'cash'"
                        icon="pi pi-pencil"
                        text
                        size="small"
                        @click="openEditPayment(pmt)"
                      />
                      <Button
                        icon="pi pi-trash"
                        text
                        size="small"
                        severity="danger"
                        @click="confirmDeletePayment(pmt)"
                      />
                    </template>
                  </Column>
                </DataTable>
                <p v-else class="text-color-secondary m-0">لا توجد دفعات</p>
              </div>
              <div
                v-if="!(selectedInvoice.items?.length || selectedInvoice.other_costs?.length || selectedInvoice.payments?.length)"
                class="text-color-secondary text-sm"
              >
                لا توجد تفاصيل إضافية
              </div>
            </div>

            <div class="invoice-print-layout print-only">
              <header class="invoice-print-header">
                <div class="invoice-print-brand">فاتورة شراء</div>
                <h1 class="invoice-print-title">فاتورة رقم {{ selectedInvoice.invoice_number }}</h1>
                <p class="invoice-print-meta m-0">المورد: {{ supplier?.name ?? '—' }}</p>
                <p class="invoice-print-meta m-0">التاريخ: {{ selectedInvoice.invoice_date }}</p>
                <p class="invoice-print-meta m-0">النوع: {{ typeLabel(selectedInvoice.type) }}</p>
                <p class="invoice-print-meta m-0">
                  الحالة: {{ statusLabel(selectedInvoice.status) }}
                </p>
                <p class="invoice-print-meta m-0">تاريخ الإصدار: {{ issuedAtLabel }}</p>
                <div class="invoice-print-rule" />
              </header>

              <section class="invoice-print-section">
                <h4 class="invoice-print-h4">الأصناف</h4>
                <table v-if="selectedInvoice.items?.length" class="invoice-print-table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>الكمية</th>
                      <th>سعر الوحدة</th>
                      <th>المجموع</th>
                      <th>الاستلام</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, idx) in selectedInvoice.items" :key="item.id ?? idx">
                      <td>{{ item.product?.name ?? item.product_name ?? '—' }}</td>
                      <td>{{ item.quantity }}</td>
                      <td>{{ formatAmount(item.unit_price) }}</td>
                      <td>
                        {{ formatAmount(item.total_price ?? item.quantity * item.unit_price) }}
                      </td>
                      <td>{{ item.is_received ? 'تم' : 'لا' }}</td>
                    </tr>
                  </tbody>
                </table>
                <p v-else class="text-color-secondary m-0">لا توجد أصناف</p>
              </section>

              <section v-if="selectedInvoice.other_costs?.length" class="invoice-print-section">
                <h4 class="invoice-print-h4">التكاليف الأخرى</h4>
                <table class="invoice-print-table">
                  <thead>
                    <tr>
                      <th>الوصف / البيان</th>
                      <th style="width: 140px">التكلفة</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(cost, idx) in selectedInvoice.other_costs" :key="cost.id ?? idx">
                      <td>{{ cost.description }}</td>
                      <td>{{ formatAmount(cost.cost) }}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section class="invoice-print-section">
                <h4 class="invoice-print-h4">الدفعات</h4>
                <table v-if="selectedInvoice.payments?.length" class="invoice-print-table">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(pmt, idx) in selectedInvoice.payments" :key="pmt.id ?? idx">
                      <td>{{ pmt.date }}</td>
                      <td>{{ formatAmount(pmt.amount) }}</td>
                    </tr>
                  </tbody>
                </table>
                <p v-else class="text-color-secondary m-0">لا توجد دفعات</p>
              </section>

              <footer class="invoice-print-totals">
                <p class="m-0">
                  <strong>الإجمالي:</strong> {{ formatAmount(selectedInvoice.total_amount) }}
                </p>
                <p class="m-0">
                  <strong>المدفوع:</strong> {{ formatAmount(selectedInvoice.paid_amount) }}
                </p>
                <p class="m-0">
                  <strong>المتبقي:</strong>
                  {{
                    formatAmount(
                      Math.max(0, selectedInvoice.total_amount - selectedInvoice.paid_amount),
                    )
                  }}
                </p>
              </footer>
            </div>
          </div>
        </Dialog>
      </template>
    </Card>

    <!-- Create/Edit Invoice Dialog -->
    <Dialog
      v-model:visible="invoiceDialogVisible"
      :header="formTitle"
      :modal="true"
      :style="{ width: '100%', maxWidth: '700px', margin: '0 20px' }"
      @hide="invoiceDialogVisible = false"
    >
      <PurchaseInvoiceForm
        v-if="invoiceDialogVisible"
        :model-value="formModel"
        :supplier-options="supplierOptionsForForm"
        :product-options="productOptions"
        :loading="purchasesStore.indexLoading"
        :is-edit="isEditInvoice"
        @submit="onInvoiceFormSubmit"
        @cancel="onInvoiceFormCancel"
      />
    </Dialog>

    <!-- Add/Edit Payment Dialog -->
    <Dialog
      v-model:visible="paymentDialogVisible"
      :header="paymentFormTitle"
      :modal="true"
      :style="{ width: '100%', maxWidth: '520px', margin: '0 20px' }"
      @hide="paymentDialogVisible = false"
    >
      <PaymentForm
        v-if="paymentDialogVisible && selectedInvoice"
        :model-value="paymentFormModel"
        :account-options="accountOptions"
        :loading="purchasesStore.showLoading"
        :max-amount="isEditPayment ? undefined : remainingAmount"
        :is-edit="isEditPayment"
        :allow-balance-split="!isEditPayment"
        :customer-balance="supplier?.balance ?? 0"
        balance-label="من رصيد المورد"
        @submit="onPaymentFormSubmit"
        @cancel="onPaymentFormCancel"
      />
    </Dialog>

    <!-- Bulk Payment Dialog -->
    <Dialog
      v-model:visible="bulkPaymentDialogVisible"
      header="الدفع الإجمالي لتسوية الفواتير"
      :modal="true"
      :style="{ width: '100%', maxWidth: '520px', margin: '0 20px' }"
      @hide="bulkPaymentDialogVisible = false"
    >
      <div v-if="bulkPaymentDialogVisible" class="flex flex-column gap-3">
        <!-- Summary Alert / Info Box -->
        <div class="surface-ground p-3 border-round border-1 surface-border">
          <div class="flex justify-content-between align-items-center mb-2">
            <span class="text-color-secondary text-sm font-medium">إجمالي المتبقي على الفواتير:</span>
            <span class="font-bold text-lg" :class="totalSupplierUnpaidDues > 0 ? 'text-orange-600' : 'text-green-600'">
              {{ formatAmount(totalSupplierUnpaidDues) }}
            </span>
          </div>
          <div class="flex justify-content-between align-items-center">
            <span class="text-color-secondary text-sm font-medium">رصيد المورد الحالي:</span>
            <span class="font-bold text-sm text-primary">
              {{ formatBalance(supplier?.balance) }}
            </span>
          </div>
        </div>

        <div class="field">
          <label class="font-medium text-sm">المبلغ المدفوع <span class="text-red-500">*</span></label>
          <InputNumber
            v-model="bulkPaymentForm.amount"
            :min="0.01"
            :min-fraction-digits="0"
            :max-fraction-digits="2"
            class="w-full mt-1"
            placeholder="أدخل المبلغ الإجمالي"
          />
        </div>

        <div class="field">
          <label class="font-medium text-sm">الحساب المالي (الخزينة / الحساب البنكي) <span class="text-red-500">*</span></label>
          <Select
            v-model="bulkPaymentForm.financial_account_id"
            :options="accountOptions"
            option-label="label"
            option-value="value"
            placeholder="اختر الحساب المالي"
            class="w-full mt-1"
          />
        </div>

        <div class="field">
          <label class="font-medium text-sm">تاريخ الدفع <span class="text-red-500">*</span></label>
          <DatePicker
            :model-value="bulkPaymentForm.date ? new Date(bulkPaymentForm.date + 'T12:00:00') : null"
            date-format="yy-mm-dd"
            show-icon
            class="w-full mt-1"
            @update:model-value="setBulkPaymentDate"
          />
        </div>

        <div class="field">
          <label class="font-medium text-sm">البيان / ملاحظات</label>
          <Textarea
            v-model="bulkPaymentForm.description"
            class="w-full mt-1"
            rows="2"
            placeholder="مثال: سداد مجمع لفواتير المورد"
          />
        </div>

        <!-- Dynamic Allocation Preview -->
        <div v-if="bulkPaymentForm.amount > 0" class="border-round p-3 text-sm" :class="bulkPaymentPreview.boxClass">
          <div class="flex align-items-center gap-2 font-semibold mb-1">
            <i :class="bulkPaymentPreview.icon"></i>
            <span>{{ bulkPaymentPreview.title }}</span>
          </div>
          <p class="m-0 line-height-3">
            {{ bulkPaymentPreview.message }}
          </p>
        </div>

        <div class="flex justify-content-end gap-2 mt-2">
          <Button label="إلغاء" text severity="secondary" @click="bulkPaymentDialogVisible = false" />
          <Button
            label="تأكيد الدفع والتسوية"
            icon="pi pi-check"
            severity="success"
            :loading="bulkPaymentSubmitting"
            :disabled="bulkPaymentForm.amount <= 0 || !bulkPaymentForm.financial_account_id"
            @click="onBulkPaymentSubmit"
          />
        </div>
      </div>
    </Dialog>

    <!-- Bulk Discount Dialog -->
    <Dialog
      v-model:visible="bulkDiscountDialogVisible"
      header="الخصم الإجمالي لتسوية الفواتير"
      :modal="true"
      :style="{ width: '100%', maxWidth: '640px', margin: '0 20px' }"
      @hide="bulkDiscountDialogVisible = false"
    >
      <div v-if="bulkDiscountDialogVisible" class="flex flex-column gap-3">
        <!-- Summary info box -->
        <div class="surface-ground p-3 border-round border-1 surface-border">
          <div class="flex justify-content-between align-items-center">
            <span class="text-color-secondary text-sm font-medium">إجمالي المتبقي على الفواتير غير المسددة:</span>
            <span class="font-bold text-lg" :class="totalSupplierUnpaidDues > 0 ? 'text-orange-600' : 'text-green-600'">
              {{ formatAmount(totalSupplierUnpaidDues) }}
            </span>
          </div>
        </div>

        <div class="field">
          <label class="font-medium text-sm">مبلغ الخصم الإجمالي <span class="text-red-500">*</span></label>
          <InputNumber
            v-model="bulkDiscountForm.amount"
            :min="0.01"
            :max="totalSupplierUnpaidDues"
            :min-fraction-digits="0"
            :max-fraction-digits="2"
            class="w-full mt-1"
            placeholder="أدخل مبلغ الخصم المراد توزيعه"
          />
          <small v-if="totalSupplierUnpaidDues > 0" class="text-color-secondary mt-1 block">
            الحد الأقصى للخصم: {{ formatAmount(totalSupplierUnpaidDues) }}
          </small>
        </div>

        <div class="field">
          <label class="font-medium text-sm">طريقة توزيع الخصم</label>
          <Select
            v-model="bulkDiscountForm.distribution_method"
            :options="distributionMethodOptions"
            option-label="label"
            option-value="value"
            class="w-full mt-1"
          />
        </div>

        <div class="field">
          <label class="font-medium text-sm">البيان / ملاحظات</label>
          <Textarea
            v-model="bulkDiscountForm.description"
            class="w-full mt-1"
            rows="2"
            placeholder="مثال: خصم تجاري ممنوح من المورد"
          />
        </div>

        <!-- Real-time Distribution Preview Table -->
        <div v-if="unpaidAndPartialInvoices.length > 0" class="flex flex-column gap-2">
          <div class="font-semibold text-sm text-color-secondary">
            معاينة توزيع الخصم على الفواتير:
          </div>
          <DataTable
            :value="bulkDiscountAllocationPreview"
            data-key="id"
            size="small"
            class="p-datatable-sm border-1 surface-border border-round overflow-hidden"
            responsive-layout="scroll"
          >
            <Column field="invoice_number" header="الفاتورة" />
            <Column field="invoice_date" header="التاريخ" />
            <Column header="المتبقي الحالي">
              <template #body="{ data }">
                {{ formatAmount(data.remaining_before) }}
              </template>
            </Column>
            <Column header="الخصم">
              <template #body="{ data }">
                <span class="font-bold text-orange-600">
                  {{ data.allocated_discount > 0 ? `-${formatAmount(data.allocated_discount)}` : '0' }}
                </span>
              </template>
            </Column>
            <Column header="المتبقي بعد الخصم">
              <template #body="{ data }">
                <Tag v-if="data.remaining_after === 0 && data.allocated_discount > 0" value="مدفوعة بالكامل" severity="success" />
                <span v-else class="font-medium" :class="data.remaining_after < data.remaining_before ? 'text-green-600' : ''">
                  {{ formatAmount(data.remaining_after) }}
                </span>
              </template>
            </Column>
          </DataTable>
        </div>
        <div v-else class="text-center text-color-secondary p-3">
          لا توجد فواتير غير مدفوعة حالياً للمورد.
        </div>

        <div class="flex justify-content-end gap-2 mt-2">
          <Button label="إلغاء" text severity="secondary" @click="bulkDiscountDialogVisible = false" />
          <Button
            label="تأكيد وتطبيق الخصم"
            icon="pi pi-check"
            severity="warn"
            :loading="bulkDiscountSubmitting"
            :disabled="bulkDiscountForm.amount <= 0 || bulkDiscountForm.amount > totalSupplierUnpaidDues || totalSupplierUnpaidDues <= 0"
            @click="onBulkDiscountSubmit"
          />
        </div>
      </div>
    </Dialog>

    <!-- Charge Balance Dialog -->
    <Dialog
      v-model:visible="chargeDialogVisible"
      header="شحن رصيد المورد"
      :modal="true"
      :style="{ width: '420px' }"
      @hide="chargeDialogVisible = false"
    >
      <div v-if="chargeDialogVisible" class="flex flex-column gap-3">
        <div class="field">
          <label>المبلغ</label>
          <InputNumber v-model="chargeForm.amount" :min="0.01" class="w-full mt-1" />
        </div>
        <div class="field">
          <label>التاريخ</label>
          <DatePicker
            :model-value="chargeForm.date ? new Date(chargeForm.date + 'T12:00:00') : null"
            date-format="yy-mm-dd"
            show-icon
            class="w-full mt-1"
            @update:model-value="setChargeDate"
          />
        </div>
        <div class="field">
          <label>تسجيل صرف نقدي (اختياري)</label>
          <Select
            v-model="chargeForm.financial_account_id"
            :options="[{ label: '— بدون —', value: null }, ...accountOptions]"
            option-label="label"
            option-value="value"
            placeholder="حساب مالي"
            class="w-full mt-1"
          />
        </div>
        <div class="field">
          <label>الوصف</label>
          <Textarea v-model="chargeForm.description" class="w-full mt-1" rows="2" />
        </div>
        <div class="flex justify-content-end gap-2">
          <Button label="إلغاء" text @click="chargeDialogVisible = false" />
          <Button
            label="شحن"
            icon="pi pi-check"
            :loading="store.loading"
            :disabled="chargeForm.amount <= 0"
            @click="onChargeSubmit"
          />
        </div>
      </div>
    </Dialog>

    <!-- Withdraw Balance Dialog -->
    <Dialog
      v-model:visible="withdrawDialogVisible"
      header="سحب رصيد المورد"
      :modal="true"
      :style="{ width: '420px' }"
      @hide="withdrawDialogVisible = false"
    >
      <div v-if="withdrawDialogVisible" class="flex flex-column gap-3">
        <div class="field">
          <label>المبلغ</label>
          <InputNumber
            v-model="withdrawForm.amount"
            :min="0.01"
            class="w-full mt-1"
          />
        </div>
        <div class="field">
          <label>التاريخ</label>
          <DatePicker
            :model-value="withdrawForm.date ? new Date(withdrawForm.date + 'T12:00:00') : null"
            date-format="yy-mm-dd"
            show-icon
            class="w-full mt-1"
            @update:model-value="setWithdrawDate"
          />
        </div>
        <div class="field">
          <label>تسجيل إيراد نقدي (اختياري)</label>
          <Select
            v-model="withdrawForm.financial_account_id"
            :options="[{ label: '— بدون —', value: null }, ...accountOptions]"
            option-label="label"
            option-value="value"
            placeholder="حساب مالي"
            class="w-full mt-1"
          />
        </div>
        <div class="field">
          <label>الوصف</label>
          <Textarea v-model="withdrawForm.description" class="w-full mt-1" rows="2" />
        </div>
        <div class="flex justify-content-end gap-2">
          <Button label="إلغاء" text @click="withdrawDialogVisible = false" />
          <Button
            label="سحب"
            icon="pi pi-check"
            :loading="store.loading"
            :disabled="withdrawForm.amount <= 0"
            @click="onWithdrawSubmit"
          />
        </div>
      </div>
    </Dialog>

    <!-- Initial Balance Dialog -->
    <Dialog
      v-model:visible="initialBalanceDialogVisible"
      header="الرصيد الافتتاحي للمورد"
      :modal="true"
      :style="{ width: '460px' }"
      @hide="initialBalanceDialogVisible = false"
    >
      <div v-if="initialBalanceDialogVisible" class="flex flex-column gap-3">
        <p class="text-color-secondary text-sm line-height-3 m-0">
          يُسجَّل كبند افتتاحي في رصيد المورد فقط — دون حركة نقدية أو اختيار حساب بنكي/صندوق.
          أدخل قيمة موجبة إذا كان لديك رصيد مسبق لدى المورد (مدين)، أو قيمة سالبة إذا كان المورد يطالبك بمستحقات (دائن).
          أدخل <strong>0</strong> لإزالة الرصيد الافتتاحي إن وُجد.
        </p>
        <div class="field">
          <label>المبلغ</label>
          <InputNumber
            v-model="initialBalanceForm.amount"
            :min="-999999999"
            :max="999999999"
            :min-fraction-digits="0"
            :max-fraction-digits="4"
            class="w-full mt-1"
          />
        </div>
        <div class="field">
          <label>التاريخ</label>
          <DatePicker
            :model-value="
              initialBalanceForm.date ? new Date(initialBalanceForm.date + 'T12:00:00') : null
            "
            date-format="yy-mm-dd"
            show-icon
            class="w-full mt-1"
            @update:model-value="setInitialBalanceDate"
          />
        </div>
        <div class="field">
          <label>الوصف (اختياري)</label>
          <Textarea v-model="initialBalanceForm.description" class="w-full mt-1" rows="2" />
        </div>
        <div class="flex justify-content-end gap-2 flex-wrap">
          <Button label="إلغاء" text @click="initialBalanceDialogVisible = false" />
          <Button
            label="حفظ"
            icon="pi pi-check"
            :loading="store.loading"
            @click="onInitialBalanceSubmit"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.print-only {
  display: none;
}

.purchase-invoice-doc--pdf-export .print-only {
  display: block;
}

.purchase-invoice-doc--pdf-export .invoice-screen,
.purchase-invoice-doc--pdf-export .no-print {
  display: none !important;
}

.invoice-print-layout {
  direction: rtl;
}

.invoice-print-brand {
  font-size: 0.75rem;
  font-weight: 700;
  color: #718096;
}

.invoice-print-title {
  font-size: 1.25rem;
  margin: 0.5rem 0;
  color: #1a202c;
}

.invoice-print-meta {
  font-size: 0.875rem;
  color: #4a5568;
}

.invoice-print-rule {
  height: 1px;
  background: #e2e8f0;
  margin-top: 1rem;
}

.invoice-print-section {
  margin-bottom: 1.25rem;
}

.invoice-print-h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.invoice-print-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.invoice-print-table th,
.invoice-print-table td {
  border: 1px solid #e2e8f0;
  padding: 0.5rem 0.75rem;
  text-align: right;
}

.invoice-print-table thead {
  background: #f7fafc;
}

.invoice-print-totals {
  margin-top: 1rem;
  padding: 1rem 0.5rem 0;
  border-top: 2px solid #e2e8f0;
}

.invoice-print-totals p {
  margin: 0.25rem 0;
}
</style>

<style>
/* طباعة: إخفاء واجهة الحوار وعرض نسخة الفاتورة المنسقة */
@media print {
  .p-dialog-mask {
    display: none !important;
  }

  .invoice-details-dialog .p-dialog-header {
    display: none !important;
  }

  .invoice-details-dialog .p-dialog-content {
    padding: 1rem !important;
  }
}

@media print {
  .invoice-screen {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  .no-print {
    display: none !important;
  }
}
</style>
