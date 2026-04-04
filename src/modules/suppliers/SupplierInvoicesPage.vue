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
import type { SupplierWithInvoices } from '@/types'
import type { PurchaseInvoice, PurchaseInvoiceCreatePayload, PaymentPayload } from '@/types'
import type { FinancialTransaction } from '@/types'

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
  new Date(issuedAtTimestamp.value).toLocaleString('ar-EG', {
    dateStyle: 'long',
    timeStyle: 'short',
  }),
)

const supplierId = computed(() => Number(route.params.id))

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
  const totalAmount = list.reduce((sum, inv) => sum + inv.total_amount, 0)
  const paidAmount = list.reduce((sum, inv) => sum + inv.paid_amount, 0)
  const remainingAmount = list.reduce(
    (sum, inv) => sum + Math.max(0, inv.total_amount - inv.paid_amount),
    0,
  )
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
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2 })
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
    date: formatDateLocal(new Date()),
    financial_account_id: accountOptions.value[0]?.value ?? 0,
    description: '',
  }
  paymentDialogVisible.value = true
}

function openEditPayment(payment: FinancialTransaction) {
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

function confirmDeletePayment(payment: FinancialTransaction) {
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
        await purchasesStore.deletePayment(selectedInvoice.value!.id, payment.id)
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
      <Button v-if="supplier" label="إضافة فاتورة" icon="pi pi-plus" @click="openCreateInvoice" />
    </div>

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
          <div class="text-color-secondary text-sm mb-1">إجمالي المستحقات</div>
          <div class="text-xl font-bold text-orange-600">
            {{ formatAmount(invoiceSummary.total_dues) }}
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
                :value="RECEIVE_STATUS_LABELS[getReceiveStats(data.items).status]"
                :severity="RECEIVE_STATUS_SEVERITY[getReceiveStats(data.items).status]"
              />
            </template>
          </Column>
          <Column header="تم الاستلام">
            <template #body="{ data }">
              {{ formatAmount(getReceiveStats(data.items).receivedAmount) }}
            </template>
          </Column>
          <Column header="متبقي الاستلام">
            <template #body="{ data }">
              {{ formatAmount(getReceiveStats(data.items).remainingAmount) }}
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
                  <span class="text-color-secondary">حالة الاستلام:</span>
                  <Tag
                    :value="RECEIVE_STATUS_LABELS[getReceiveStats(selectedInvoice.items).status]"
                    :severity="
                      RECEIVE_STATUS_SEVERITY[getReceiveStats(selectedInvoice.items).status]
                    "
                  />
                </div>
                <div>
                  <span class="text-color-secondary">تم الاستلام:</span>
                  {{ formatAmount(getReceiveStats(selectedInvoice.items).receivedAmount) }}
                </div>
                <div>
                  <span class="text-color-secondary">متبقي الاستلام:</span>
                  {{ formatAmount(getReceiveStats(selectedInvoice.items).remainingAmount) }}
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
                        @click="onUnreceiveItem(selectedInvoice, item)"
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
                  <Column field="date" header="التاريخ" />
                  <Column field="amount" header="المبلغ">
                    <template #body="{ data: pmt }">{{ formatAmount(pmt.amount) }}</template>
                  </Column>
                  <Column header="الحساب">
                    <template #body="{ data: pmt }">{{ pmt.account?.name ?? '—' }}</template>
                  </Column>
                  <Column field="description" header="الوصف">
                    <template #body="{ data: pmt }">{{ pmt.description ?? '—' }}</template>
                  </Column>
                  <Column header="الإجراءات" style="width: 100px">
                    <template #body="{ data: pmt }">
                      <Button icon="pi pi-pencil" text size="small" @click="openEditPayment(pmt)" />
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
      :style="{ width: '420px' }"
      @hide="paymentDialogVisible = false"
    >
      <PaymentForm
        v-if="paymentDialogVisible && selectedInvoice"
        :model-value="paymentFormModel"
        :account-options="accountOptions"
        :loading="purchasesStore.showLoading"
        :max-amount="isEditPayment ? undefined : remainingAmount"
        :is-edit="isEditPayment"
        @submit="onPaymentFormSubmit"
        @cancel="onPaymentFormCancel"
      />
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
