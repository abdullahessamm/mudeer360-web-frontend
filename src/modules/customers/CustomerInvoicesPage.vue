<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import html2pdf from 'html2pdf.js'
import { useRoute, useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import {
  getDispenseStats,
  DISPENSE_STATUS_LABELS,
  DISPENSE_STATUS_SEVERITY,
  isDispenseStockInsufficient,
} from '@/lib/dispense'
import { showError, showSuccess } from '@/composables/useToast'
import { exportAccountStatement } from '@/composables/useExportAccountStatement'
import { useCustomersStore } from '@/stores/customers'
import { useSalesStore } from '@/stores/sales'
import Paginator from 'primevue/paginator'
import { useProductsStore } from '@/stores/products'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'
import SaleInvoiceForm from '@/components/forms/SaleInvoiceForm.vue'
import PaymentForm from '@/components/forms/PaymentForm.vue'
import type { CustomerBalanceTransaction, CustomerWithInvoices, PaginatedPayload } from '@/types'
import type { SaleInvoice, SaleInvoiceCreatePayload, PaymentPayload, InvoicePaymentLine } from '@/types'

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const store = useCustomersStore()
const salesStore = useSalesStore()
const productsStore = useProductsStore()
const accountsStore = useFinancialAccountsStore()

const customer = ref<CustomerWithInvoices | null>(null)
const loading = ref(true)
const detailsDialogVisible = ref(false)
const selectedInvoice = ref<SaleInvoice | null>(null)

const invoiceDialogVisible = ref(false)
const isEditInvoice = ref(false)
const editingInvoiceId = ref<number | null>(null)
const formModel = ref<Partial<SaleInvoice> | null>(null)

const paymentDialogVisible = ref(false)
const isEditPayment = ref(false)
const editingPaymentId = ref<number | null>(null)
const paymentFormModel = ref<Partial<PaymentPayload> | null>(null)
const dispensingItemId = ref<number | null>(null)
const deductStockByLineId = ref<Record<number, boolean>>({})

const invoicePdfRoot = ref<HTMLElement | null>(null)
const pdfExporting = ref(false)
const issuedAtTimestamp = ref(Date.now())

const issuedAtLabel = computed(() =>
  new Date(issuedAtTimestamp.value).toLocaleString('ar-EG', {
    dateStyle: 'long',
    timeStyle: 'short',
  }),
)

const chargeDialogVisible = ref(false)
const chargeForm = ref({
  amount: 0,
  date: formatDateLocal(new Date()),
  financial_account_id: null as number | null,
  description: '',
})

const withdrawDialogVisible = ref(false)
const withdrawForm = ref({
  amount: 0,
  date: formatDateLocal(new Date()),
  financial_account_id: null as number | null,
  description: '',
})

const initialBalanceDialogVisible = ref(false)
const initialBalanceForm = ref({
  amount: 0 as number | null,
  date: formatDateLocal(new Date()),
  description: '',
})

const balanceHistoryDialogVisible = ref(false)
const balanceTxRows = ref<CustomerBalanceTransaction[]>([])
const balanceTxMeta = ref<PaginatedPayload<CustomerBalanceTransaction>['meta'] | null>(null)
const balanceTxLoading = ref(false)

const customerId = computed(() => Number(route.params.id))

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
const EMPTY_INVOICES: SaleInvoice[] = []

/** Invoices filtered by date range (frontend filter for reliability) */
const invoices = computed(() => {
  const list = customer.value?.invoices ?? EMPTY_INVOICES
  const range = getDateRange()
  if (!range) return list
  return list.filter((inv) => {
    const d = inv.invoice_date
    if (!d) return false
    const dateStr = typeof d === 'string' ? d.slice(0, 10) : d
    return dateStr >= range.from && dateStr <= range.to
  })
})

/** List totals (عدد / إجمالي / مدفوع) من الفواتير المعروضة؛ باقي المؤشرات من `payload.summary` عند توفرها. */
const invoiceSummary = computed(() => {
  const list = invoices.value
  const count = list.length
  const totalAmount = list.reduce((sum, inv) => sum + inv.total_amount, 0)
  const paidAmount = list.reduce((sum, inv) => sum + inv.paid_amount, 0)
  const remainingFromInvoices = list.reduce(
    (sum, inv) => sum + Math.max(0, inv.total_amount - inv.paid_amount),
    0,
  )

  const s = customer.value?.summary
  if (s) {
    return {
      count,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      remaining_amount: s.total_remaining,
      total_dispensed_amount: s.total_dispensed_amount,
      total_remaining_dispense: s.total_remaining_dispense,
      total_remaining: s.total_remaining,
      total_dues: s.total_dues,
    }
  }

  let totalDispensed = 0
  let totalRemainingDispense = 0
  for (const inv of list) {
    const items = inv.items ?? []
    for (const i of items) {
      const itemTotal = i.total_price ?? i.quantity * i.unit_price
      if (i.is_dispensed) totalDispensed += itemTotal
      else totalRemainingDispense += itemTotal
    }
  }
  const totalDues = totalRemainingDispense - remainingFromInvoices
  return {
    count,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    remaining_amount: remainingFromInvoices,
    total_dispensed_amount: totalDispensed,
    total_remaining_dispense: totalRemainingDispense,
    total_remaining: remainingFromInvoices,
    total_dues: totalDues,
  }
})

const customerOptionsForForm = computed(() => (customer.value ? [customer.value] : []))

const productOptions = computed(() =>
  productsStore.allProducts.map((p) => ({
    label: p.product_code ? `${p.product_code} - ${p.name}` : p.name,
    value: p.id,
    sale_price: p.sale_price,
    quantity: p.quantity,
  })),
)

const accountOptions = computed(() =>
  accountsStore.items.map((a) => ({ label: a.name, value: a.id })),
)

const chargeAccountOptions = computed(() => [
  { label: '— بدون —', value: null as number | null },
  ...accountsStore.items.map((a) => ({ label: a.name, value: a.id })),
])

const remainingAmount = computed(() => {
  const inv = selectedInvoice.value
  if (!inv) return 0
  return Math.max(0, inv.total_amount - inv.paid_amount)
})

const formTitle = computed(() => (isEditInvoice.value ? 'تعديل الفاتورة' : 'إضافة فاتورة بيع'))

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

function balanceTxTypeLabel(type: string) {
  const map: Record<string, string> = {
    manual_charge: 'شحن',
    manual_withdraw: 'سحب',
    invoice_payment: 'دفع فاتورة',
    initial_balance: 'رصيد افتتاحي',
  }
  return map[type] ?? type
}

function goBack() {
  router.push({ name: 'customers' })
}

function formatAmount(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2 })
}

function sanitizeFilename(name: string) {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'invoice'
}

function getSaleInvoicePdfOptions() {
  const inv = selectedInvoice.value
  if (!inv) return null
  const customerName = inv.customer?.name ?? customer.value?.name ?? 'customer'
  return {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: `${sanitizeFilename(`sale-${inv.invoice_number}-${customerName}`)}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.92 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
  }
}

async function printSaleInvoice() {
  if (!invoicePdfRoot.value) return
  const opt = getSaleInvoicePdfOptions()
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

async function downloadSaleInvoicePdf() {
  if (!invoicePdfRoot.value) return
  const opt = getSaleInvoicePdfOptions()
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

async function openInvoiceDetails(invoice: SaleInvoice, openPaymentAfter = false) {
  try {
    const [full] = await Promise.all([
      salesStore.fetchById(invoice.id),
      salesStore.fetchPayments(invoice.id),
    ])
    selectedInvoice.value = full ? { ...full, payments: salesStore.payments } : null
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

function getCustomerFetchDateParams(): { date_from: string; date_to: string } | undefined {
  const r = getDateRange()
  if (!r) return undefined
  return { date_from: r.from, date_to: r.to }
}

async function refetchCustomer() {
  if (!customerId.value) return
  const updated = await store.fetchById(customerId.value, getCustomerFetchDateParams())
  if (updated) customer.value = updated
}

async function loadBalanceHistory(page = 1) {
  if (!customer.value) return
  balanceTxLoading.value = true
  try {
    const res = await store.fetchBalanceTransactions(customer.value.id, page, 15)
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

function exportToExcel() {
  if (!customer.value) return
  exportAccountStatement({
    accountName: customer.value.name,
    accountType: 'customer',
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
  if (!customer.value) return
  isEditInvoice.value = false
  editingInvoiceId.value = null
  formModel.value = {
    customer_id: customerId.value,
    customer: customer.value,
    type: 'credit',
    invoice_date: formatDateLocal(new Date()),
    items: [],
  }
  invoiceDialogVisible.value = true
}

function openEditInvoice(invoice: SaleInvoice) {
  if (invoice.status !== 'unpaid') return
  isEditInvoice.value = true
  editingInvoiceId.value = invoice.id
  formModel.value = {
    customer_id: invoice.customer_id,
    customer: invoice.customer,
    type: invoice.type,
    invoice_date: invoice.invoice_date,
    items: invoice.items ?? [],
  }
  invoiceDialogVisible.value = true
  detailsDialogVisible.value = false
}

async function onInvoiceFormSubmit(payload: SaleInvoiceCreatePayload) {
  try {
    if (isEditInvoice.value && editingInvoiceId.value !== null) {
      await salesStore.update(editingInvoiceId.value, payload)
      showSuccess('تم تحديث الفاتورة بنجاح')
    } else {
      await salesStore.create(payload)
      showSuccess('تم إنشاء الفاتورة بنجاح')
    }
    invoiceDialogVisible.value = false
    await refetchCustomer()
  } catch {
    // error via toast
  }
}

function onInvoiceFormCancel() {
  invoiceDialogVisible.value = false
}

function lineWantsDeductStock(lineId: number | undefined): boolean {
  if (!lineId) return true
  return deductStockByLineId.value[lineId] !== false
}

function setLineDeductStock(lineId: number, v: boolean) {
  deductStockByLineId.value = { ...deductStockByLineId.value, [lineId]: v }
}

async function onDispenseItem(invoice: SaleInvoice, item: { id?: number }) {
  if (!item.id) return
  dispensingItemId.value = item.id
  try {
    await salesStore.dispense(invoice.id, {
      dispenseItems: [{ id: item.id, deduct_stock: lineWantsDeductStock(item.id) }],
    })
    showSuccess('تم صرف الصنف بنجاح')
    await refetchCustomer()
    if (selectedInvoice.value?.id === invoice.id) {
      const updated = customer.value?.invoices?.find((i) => i.id === invoice.id)
      if (updated) selectedInvoice.value = updated
    }
  } catch {
    // error via toast
  } finally {
    dispensingItemId.value = null
  }
}

async function onUndispenseItem(invoice: SaleInvoice, item: { id?: number }) {
  if (!item.id) return
  dispensingItemId.value = item.id
  try {
    await salesStore.undispense(invoice.id, [item.id])
    showSuccess('تم تراجع صرف الصنف بنجاح')
    await refetchCustomer()
    if (selectedInvoice.value?.id === invoice.id) {
      const updated = customer.value?.invoices?.find((i) => i.id === invoice.id)
      if (updated) selectedInvoice.value = updated
    }
  } catch {
    // error via toast
  } finally {
    dispensingItemId.value = null
  }
}

function confirmDeleteInvoice(invoice: SaleInvoice) {
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
        await salesStore.remove(invoice.id)
        showSuccess('تم حذف الفاتورة بنجاح')
        if (detailsDialogVisible.value && selectedInvoice.value?.id === invoice.id) {
          closeDetailsDialog()
        }
        await refetchCustomer()
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
  if (!customer.value || chargeForm.value.amount <= 0) return
  try {
    await store.chargeBalance(customer.value.id, {
      amount: chargeForm.value.amount,
      date: chargeForm.value.date,
      description: chargeForm.value.description || undefined,
      financial_account_id: chargeForm.value.financial_account_id ?? undefined,
    })
    showSuccess('تم شحن رصيد العميل')
    chargeDialogVisible.value = false
    await refetchCustomer()
    if (balanceHistoryDialogVisible.value) {
      await loadBalanceHistory(balanceTxMeta.value?.current_page ?? 1)
    }
  } catch {
    // toast
  }
}

function openWithdrawDialog() {
  withdrawForm.value = {
    amount: 0,
    date: formatDateLocal(new Date()),
    financial_account_id: null,
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
  if (!customer.value || withdrawForm.value.amount <= 0) return
  try {
    await store.withdrawBalance(customer.value.id, {
      amount: withdrawForm.value.amount,
      date: withdrawForm.value.date,
      description: withdrawForm.value.description || undefined,
      financial_account_id: withdrawForm.value.financial_account_id ?? undefined,
    })
    showSuccess('تم سحب الرصيد')
    withdrawDialogVisible.value = false
    await refetchCustomer()
    if (balanceHistoryDialogVisible.value) {
      await loadBalanceHistory(balanceTxMeta.value?.current_page ?? 1)
    }
  } catch {
    // toast
  }
}

async function openInitialBalanceDialog() {
  initialBalanceForm.value = {
    amount: 0,
    date: formatDateLocal(new Date()),
    description: '',
  }
  initialBalanceDialogVisible.value = true
  if (!customer.value) return
  try {
    const res = await store.fetchBalanceTransactions(customer.value.id, 1, 1, 'initial_balance')
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
  if (!customer.value) return
  const raw = initialBalanceForm.value.amount
  if (raw === null || raw === undefined || Number.isNaN(Number(raw))) {
    showError('أدخل المبلغ (أو 0 لإزالة الرصيد الافتتاحي)')
    return
  }
  let amount = Number(raw)
  if (Math.abs(amount) < 0.0001) amount = 0
  try {
    await store.setInitialBalance(customer.value.id, {
      amount,
      date: initialBalanceForm.value.date,
      description: initialBalanceForm.value.description.trim() || undefined,
    })
    showSuccess(amount === 0 ? 'تم إلغاء الرصيد الافتتاحي' : 'تم حفظ الرصيد الافتتاحي')
    initialBalanceDialogVisible.value = false
    await refetchCustomer()
    if (balanceHistoryDialogVisible.value) {
      await loadBalanceHistory(balanceTxMeta.value?.current_page ?? 1)
    }
  } catch {
    // toast via store.error watch
  }
}

async function onPaymentFormSubmit(payload: PaymentPayload) {
  if (!selectedInvoice.value) return
  try {
    let updated: SaleInvoice
    if (isEditPayment.value && editingPaymentId.value !== null) {
      updated = await salesStore.updatePayment(
        selectedInvoice.value.id,
        editingPaymentId.value,
        payload,
      )
      showSuccess('تم تحديث الدفعة بنجاح')
    } else {
      updated = await salesStore.pay(selectedInvoice.value.id, payload)
      showSuccess('تم إضافة الدفعة بنجاح')
    }
    paymentDialogVisible.value = false
    await salesStore.fetchPayments(selectedInvoice.value.id)
    selectedInvoice.value = { ...updated, payments: salesStore.payments }
    await refetchCustomer()
  } catch {
    // error via toast
  }
}

function onPaymentFormCancel() {
  paymentDialogVisible.value = false
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
          await salesStore.deleteBalancePayment(selectedInvoice.value!.id, payment.id)
        } else {
          await salesStore.deletePayment(selectedInvoice.value!.id, payment.id)
        }
        showSuccess('تم حذف الدفعة بنجاح')
        await salesStore.fetchPayments(selectedInvoice.value!.id)
        selectedInvoice.value = { ...selectedInvoice.value!, payments: salesStore.payments }
        await refetchCustomer()
      } catch {
        // error via toast
      }
    },
  })
}

watch(
  () => selectedInvoice.value?.id,
  () => {
    deductStockByLineId.value = {}
  },
)

watch(
  () => filters.value.dateRange,
  async () => {
    if (!customerId.value || loading.value) return
    loading.value = true
    try {
      await refetchCustomer()
    } finally {
      loading.value = false
    }
  },
  { deep: true },
)

watch(
  () => [store.error, salesStore.error],
  ([sErr, pErr]) => {
    if (sErr) {
      showError(sErr)
      store.clearError()
    }
    if (pErr) {
      showError(pErr)
      salesStore.clearError()
    }
  },
)

onMounted(async () => {
  const id = customerId.value
  if (!id) {
    router.replace({ name: 'customers' })
    return
  }
  loading.value = true
  try {
    const [customerData] = await Promise.all([
      store.fetchById(id, getCustomerFetchDateParams()),
      productsStore.fetchAllForSelect(),
      accountsStore.fetchAll(),
    ])
    customer.value = customerData
    if (!customer.value) {
      showError('العميل غير موجود')
      router.replace({ name: 'customers' })
    }
  } catch {
    showError('فشل تحميل بيانات العميل')
    router.replace({ name: 'customers' })
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
          label="العودة للعملاء"
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
          v-if="customer"
          label="تصدير Excel"
          icon="pi pi-file-excel"
          severity="success"
          size="small"
          @click="exportToExcel"
        />
      </div>
      <Button v-if="customer" label="إضافة فاتورة" icon="pi pi-plus" @click="openCreateInvoice" />
    </div>

    <div v-if="customer" class="flex flex-wrap gap-3 mb-4">
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">رصيد العميل</div>
          <div class="text-xl font-bold text-primary">{{ formatAmount(customer.balance ?? 0) }}</div>
          <div class="flex flex-wrap gap-2 mt-2">
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
              :disabled="(customer.balance ?? 0) <= 0"
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
      header="سجل حركة الرصيد"
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

    <div v-if="customer && invoices.length > 0" class="flex flex-wrap gap-3 mb-4">
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
          <div class="text-color-secondary text-sm mb-1">إجمالي المصروف</div>
          <div class="text-xl font-bold text-blue-600">
            {{ formatAmount(invoiceSummary.total_dispensed_amount) }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">المتبقي للصرف</div>
          <div class="text-xl font-bold text-cyan-600">
            {{ formatAmount(invoiceSummary.total_remaining_dispense) }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">إجمالي المستحقات</div>
          <div class="text-xl font-bold text-orange-600">
            {{ formatAmount(invoiceSummary.total_dues) }}
          </div>
        </template>
      </Card>
    </div>

    <Card v-if="loading || customer">
      <template #title>
        <div class="flex align-items-center gap-2">
          <i class="pi pi-user-plus"></i>
          <span>{{ loading ? 'جاري التحميل...' : `فواتير البيع - ${customer?.name}` }}</span>
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
          <p class="text-color-secondary m-0">لا توجد فواتير بيع لهذا العميل</p>
          <Button
            v-if="customer"
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
          <Column header="صرف">
            <template #body="{ data }">
              <Tag
                :value="DISPENSE_STATUS_LABELS[getDispenseStats(data.items).status]"
                :severity="DISPENSE_STATUS_SEVERITY[getDispenseStats(data.items).status]"
              />
            </template>
          </Column>
          <Column header="تم الصرف">
            <template #body="{ data }">
              {{ formatAmount(getDispenseStats(data.items).dispensedAmount) }}
            </template>
          </Column>
          <Column header="متبقي الصرف">
            <template #body="{ data }">
              {{ formatAmount(getDispenseStats(data.items).remainingAmount) }}
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
          <div v-if="salesStore.showLoading" class="flex justify-content-center py-6">
            <i class="pi pi-spin pi-spinner text-3xl text-color-secondary"></i>
          </div>
          <div
            v-else-if="selectedInvoice"
            ref="invoicePdfRoot"
            class="sale-invoice-doc"
            :class="{ 'sale-invoice-doc--pdf-export': pdfExporting }"
          >
            <div class="flex flex-wrap gap-2 mb-3 no-print">
              <Button
                label="طباعة"
                icon="pi pi-print"
                size="small"
                outlined
                :loading="pdfExporting"
                :disabled="pdfExporting"
                @click="printSaleInvoice"
              />
              <Button
                label="تحميل PDF"
                icon="pi pi-file-pdf"
                size="small"
                severity="secondary"
                :loading="pdfExporting"
                :disabled="pdfExporting"
                @click="downloadSaleInvoicePdf"
              />
            </div>
            <div class="invoice-screen flex flex-column gap-4">
            <div class="flex flex-wrap gap-2 mb-2">
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
            <div class="flex flex-wrap gap-4 align-items-center">
              <div>
                <span class="text-color-secondary">حالة الصرف:</span>
                <Tag
                  :value="DISPENSE_STATUS_LABELS[getDispenseStats(selectedInvoice.items).status]"
                  :severity="
                    DISPENSE_STATUS_SEVERITY[getDispenseStats(selectedInvoice.items).status]
                  "
                />
              </div>
              <div>
                <span class="text-color-secondary">تم الصرف:</span>
                {{ formatAmount(getDispenseStats(selectedInvoice.items).dispensedAmount) }}
              </div>
              <div>
                <span class="text-color-secondary">متبقي الصرف:</span>
                {{ formatAmount(getDispenseStats(selectedInvoice.items).remainingAmount) }}
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
                    <div class="flex flex-column gap-1 align-items-start">
                      <span>{{ item.product?.name ?? item.product_name ?? '—' }}</span>
                      <div class="flex flex-wrap gap-1 align-items-center">
                        <Tag v-if="item.is_dispensed" value="تم الصرف" severity="success" />
                        <Tag
                          v-if="item.is_dispensed && item.stock_deducted === true"
                          value="من المخزون"
                          severity="info"
                        />
                        <Tag
                          v-else-if="item.is_dispensed && item.stock_deducted === false"
                          value="دون خصم مخزون"
                          severity="secondary"
                        />
                        <Tag
                          v-if="
                            !item.is_dispensed &&
                            item.id &&
                            isDispenseStockInsufficient(item, lineWantsDeductStock(item.id))
                          "
                          value="مخزون غير كافٍ"
                          severity="warn"
                        />
                      </div>
                    </div>
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
                <Column header="خصم من المخزون" style="width: 7rem">
                  <template #body="{ data: item }">
                    <div v-if="!item.is_dispensed && item.id" class="flex align-items-center gap-2">
                      <Checkbox
                        v-if="item.product_id"
                        :model-value="lineWantsDeductStock(item.id)"
                        :binary="true"
                        :input-id="`cust-deduct-${item.id}`"
                        @update:model-value="(v: boolean) => setLineDeductStock(item.id, v)"
                      />
                      <span v-else class="text-color-secondary text-sm">—</span>
                    </div>
                    <span v-else class="text-color-secondary">—</span>
                  </template>
                </Column>
                <Column header="الإجراءات" style="width: 140px">
                  <template #body="{ data: item }">
                    <Button
                      v-if="!item.is_dispensed && item.id"
                      label="صرف"
                      icon="pi pi-box"
                      text
                      size="small"
                      severity="secondary"
                      :loading="dispensingItemId === item.id"
                      @click="onDispenseItem(selectedInvoice, item)"
                    />
                    <Button
                      v-else-if="item.is_dispensed && item.id"
                      label="تراجع"
                      icon="pi pi-undo"
                      text
                      size="small"
                      severity="warn"
                      :loading="dispensingItemId === item.id"
                      @click="onUndispenseItem(selectedInvoice, item)"
                    />
                  </template>
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
              v-if="!(selectedInvoice.items?.length || selectedInvoice.payments?.length)"
              class="text-color-secondary text-sm"
            >
              لا توجد تفاصيل إضافية
            </div>
            </div>

            <div class="invoice-print-layout print-only">
              <header class="invoice-print-header">
                <div class="invoice-print-brand">فاتورة بيع</div>
                <h1 class="invoice-print-title">
                  فاتورة رقم {{ selectedInvoice.invoice_number }}
                </h1>
                <p class="invoice-print-meta m-0">
                  العميل: {{ selectedInvoice.customer?.name ?? customer?.name ?? '—' }}
                </p>
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
                      <th>الصرف</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, idx) in selectedInvoice.items" :key="item.id ?? idx">
                      <td>{{ item.product?.name ?? item.product_name ?? '—' }}</td>
                      <td>{{ item.quantity }}</td>
                      <td>{{ formatAmount(item.unit_price) }}</td>
                      <td>{{ formatAmount(item.total_price ?? item.quantity * item.unit_price) }}</td>
                      <td>{{ item.is_dispensed ? 'تم' : 'لا' }}</td>
                    </tr>
                  </tbody>
                </table>
                <p v-else class="text-color-secondary m-0">لا توجد أصناف</p>
              </section>

              <section class="invoice-print-section">
                <h4 class="invoice-print-h4">الدفعات</h4>
                <table v-if="salesStore.payments.length" class="invoice-print-table">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(pmt, idx) in salesStore.payments" :key="pmt.id ?? idx">
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
                      Math.max(
                        0,
                        selectedInvoice.total_amount - selectedInvoice.paid_amount,
                      ),
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
      <SaleInvoiceForm
        v-if="invoiceDialogVisible"
        :model-value="formModel"
        :customers="customerOptionsForForm"
        :product-options="productOptions"
        :loading="salesStore.indexLoading"
        :is-edit="isEditInvoice"
        :existing-items="formModel?.items"
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
        :loading="salesStore.showLoading"
        :max-amount="isEditPayment ? undefined : remainingAmount"
        :is-edit="isEditPayment"
        :allow-balance-split="!isEditPayment"
        :customer-balance="customer?.balance ?? selectedInvoice.customer?.balance ?? 0"
        @submit="onPaymentFormSubmit"
        @cancel="onPaymentFormCancel"
      />
    </Dialog>

    <Dialog
      v-model:visible="chargeDialogVisible"
      header="شحن رصيد العميل"
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
          <label>تسجيل إيراد نقدي (اختياري)</label>
          <Select
            v-model="chargeForm.financial_account_id"
            :options="chargeAccountOptions"
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

    <Dialog
      v-model:visible="withdrawDialogVisible"
      header="سحب رصيد العميل"
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
            :max="customer?.balance ?? undefined"
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
          <label>تسجيل صرف نقدي (اختياري)</label>
          <Select
            v-model="withdrawForm.financial_account_id"
            :options="chargeAccountOptions"
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
            :disabled="withdrawForm.amount <= 0 || withdrawForm.amount > (customer?.balance ?? 0)"
            @click="onWithdrawSubmit"
          />
        </div>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="initialBalanceDialogVisible"
      header="الرصيد الافتتاحي للعميل"
      :modal="true"
      :style="{ width: '460px' }"
      @hide="initialBalanceDialogVisible = false"
    >
      <div v-if="initialBalanceDialogVisible" class="flex flex-column gap-3">
        <p class="text-color-secondary text-sm line-height-3 m-0">
          يُسجَّل كبند افتتاحي في رصيد العميل فقط — دون حركة نقدية أو اختيار حساب بنكي/صندوق. يمكن إدخال
          قيمة سالبة إذا كان العميل يبدأ برصيد مدين (مستحق لك). أدخل
          <strong>0</strong>
          لإزالة الرصيد الافتتاحي إن وُجد.
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

.sale-invoice-doc--pdf-export .print-only {
  display: block;
}

.sale-invoice-doc--pdf-export .invoice-screen,
.sale-invoice-doc--pdf-export .no-print {
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
