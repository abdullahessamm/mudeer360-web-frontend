<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import html2pdf from 'html2pdf.js'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import { getDispenseStats, DISPENSE_STATUS_LABELS, DISPENSE_STATUS_SEVERITY } from '@/lib/dispense'
import { useConfirm } from 'primevue/useconfirm'
import { showError, showSuccess } from '@/composables/useToast'
import { useSalesStore } from '@/stores/sales'
import { useCustomersStore } from '@/stores/customers'
import { useProductsStore } from '@/stores/products'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'
import SaleInvoiceForm from '@/components/forms/SaleInvoiceForm.vue'
import PaymentForm from '@/components/forms/PaymentForm.vue'
import type { SaleInvoice, SaleInvoiceCreatePayload, PaymentPayload, InvoicePaymentLine } from '@/types'

const confirm = useConfirm()
const store = useSalesStore()
const customersStore = useCustomersStore()
const productsStore = useProductsStore()
const accountsStore = useFinancialAccountsStore()

watch(
  () => store.error,
  (err) => {
    if (err) {
      showError(err)
      store.clearError()
    }
  },
)

const filters = ref({
  customer_id: null as number | null,
  status: null as 'unpaid' | 'partial' | 'paid' | null,
  type: null as 'cash' | 'credit' | null,
  dateRange: getCurrentMonthRange() as [Date, Date],
})

const invoiceDialogVisible = ref(false)
const isEditInvoice = ref(false)
const editingInvoiceId = ref<number | null>(null)
const formModel = ref<Partial<SaleInvoice> | null>(null)

const detailDialogVisible = ref(false)
const detailOpeningInvoiceNumber = ref<string | null>(null)
const paymentDialogVisible = ref(false)
const isEditPayment = ref(false)
const editingPaymentId = ref<number | null>(null)
const paymentFormModel = ref<Partial<PaymentPayload> | null>(null)
const dispensingItemId = ref<number | null>(null)

const invoicePdfRoot = ref<HTMLElement | null>(null)
const pdfExporting = ref(false)
const issuedAtTimestamp = ref(Date.now())

const issuedAtLabel = computed(() =>
  new Date(issuedAtTimestamp.value).toLocaleString('ar-EG', {
    dateStyle: 'long',
    timeStyle: 'short',
  }),
)

const customerOptions = computed(() => [
  { label: '— الكل —', value: null },
  ...customersStore.allCustomers.map((c) => ({ label: c.name, value: c.id })),
])

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

const formCustomers = computed(() => customersStore.allCustomers)

const statusLabel = (status: string) =>
  ({ paid: 'مدفوع', partial: 'مدفوع جزئياً', unpaid: 'غير مدفوع' })[status] ?? status

const typeLabel = (type: string) => ({ cash: 'نقدي', credit: 'آجل' })[type] ?? type

const statusSeverity = (status: string) =>
  ({ paid: 'success', partial: 'warn', unpaid: 'danger' })[status] ?? 'secondary'

function formatAmount(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2 })
}

function sanitizeFilename(name: string) {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'invoice'
}

function getSaleInvoicePdfOptions() {
  const inv = store.currentInvoice
  if (!inv) return null
  const customerName = inv.customer?.name ?? 'customer'
  return {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: `${sanitizeFilename(`sale-${inv.invoice_number}-${customerName}`)}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.92 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
  }
}

/** يفتح PDF في تبويب جديد (يمكن الطباعة من عارض PDF) */
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

const remainingAmount = computed(() => {
  const inv = store.currentInvoice
  if (!inv) return 0
  return Math.max(0, inv.total_amount - inv.paid_amount)
})

const undispensedCount = computed(() => {
  const items = store.currentInvoice?.items ?? []
  return items.filter((i) => !i.is_dispensed).length
})

const hasUndispensedItems = computed(() => undispensedCount.value > 0)

const dispensedCount = computed(() => {
  const items = store.currentInvoice?.items ?? []
  return items.filter((i) => i.is_dispensed).length
})
const hasDispensedItems = computed(() => dispensedCount.value > 0)

const formTitle = computed(() => (isEditInvoice.value ? 'تعديل الفاتورة' : 'إضافة فاتورة بيع'))

const paymentFormTitle = computed(() => (isEditPayment.value ? 'تعديل الدفعة' : 'إضافة دفعة'))

function toYMD(d: Date) {
  return formatDateLocal(d)
}

function applyFilters(page = 1) {
  const [date_from, date_to] = filters.value.dateRange
    ? [filters.value.dateRange[0], filters.value.dateRange[1]]
    : [undefined, undefined]
  store.fetchPage(page, store.perPage, {
    customer_id: filters.value.customer_id || undefined,
    status: filters.value.status || undefined,
    type: filters.value.type || undefined,
    date_from: date_from ? toYMD(date_from) : undefined,
    date_to: date_to ? toYMD(date_to) : undefined,
  })
}

async function openCreate() {
  await productsStore.fetchAllForSelect()
  isEditInvoice.value = false
  editingInvoiceId.value = null
  formModel.value = {
    customer_id: undefined,
    type: 'credit',
    invoice_date: formatDateLocal(new Date()),
    items: [],
  }
  invoiceDialogVisible.value = true
}

async function openEdit(row: SaleInvoice) {
  if (row.status !== 'unpaid') return
  await productsStore.fetchAllForSelect()
  isEditInvoice.value = true
  editingInvoiceId.value = row.id
  formModel.value = {
    customer_id: row.customer_id,
    customer: row.customer,
    type: row.type,
    invoice_date: row.invoice_date,
    items: row.items ?? [],
  }
  invoiceDialogVisible.value = true
}

async function onInvoiceFormSubmit(payload: SaleInvoiceCreatePayload) {
  try {
    if (isEditInvoice.value && editingInvoiceId.value !== null) {
      await store.update(editingInvoiceId.value, payload)
      showSuccess('تم تحديث الفاتورة بنجاح')
    } else {
      await store.create(payload)
      showSuccess('تم إنشاء الفاتورة بنجاح')
    }
    invoiceDialogVisible.value = false
    await applyFilters()
  } catch {
    // error via toast
  }
}

function onInvoiceFormCancel() {
  invoiceDialogVisible.value = false
}

function openDetail(row: SaleInvoice, openPaymentAfter = false) {
  detailDialogVisible.value = true
  detailOpeningInvoiceNumber.value = row.invoice_number ?? null
  store.clearCurrentInvoice()
  store.fetchById(row.id).then(() => {
    store.fetchPayments(row.id)
    if (openPaymentAfter) {
      openAddPayment()
    }
  })
}

function closeDetail() {
  detailDialogVisible.value = false
  detailOpeningInvoiceNumber.value = null
  store.clearCurrentInvoice()
}

function openAddPayment() {
  if (!store.currentInvoice) return
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
  if (!store.currentInvoice) return
  try {
    if (isEditPayment.value && editingPaymentId.value !== null) {
      await store.updatePayment(store.currentInvoice.id, editingPaymentId.value, payload)
      showSuccess('تم تحديث الدفعة بنجاح')
      await store.fetchPayments(store.currentInvoice.id)
    } else {
      await store.pay(store.currentInvoice.id, payload)
      showSuccess('تم إضافة الدفعة بنجاح')
      await store.fetchPayments(store.currentInvoice.id)
    }
    paymentDialogVisible.value = false
    await applyFilters(store.currentPage)
  } catch {
    // error via toast
  }
}

function onPaymentFormCancel() {
  paymentDialogVisible.value = false
}

async function onDispenseAll() {
  if (!store.currentInvoice) return
  try {
    await store.dispense(store.currentInvoice.id)
    showSuccess('تم صرف الأصناف بنجاح')
    await store.fetchById(store.currentInvoice.id)
    await store.fetchPayments(store.currentInvoice.id)
    await applyFilters(store.currentPage)
  } catch {
    // error via toast
  }
}

async function onDispenseItem(item: { id?: number }) {
  if (!store.currentInvoice || !item.id) return
  dispensingItemId.value = item.id
  try {
    await store.dispense(store.currentInvoice.id, [item.id])
    showSuccess('تم صرف الصنف بنجاح')
    await store.fetchById(store.currentInvoice.id)
    await store.fetchPayments(store.currentInvoice.id)
    await applyFilters(store.currentPage)
  } catch {
    // error via toast
  } finally {
    dispensingItemId.value = null
  }
}

async function onUndispenseAll() {
  if (!store.currentInvoice) return
  try {
    const dispensedIds =
      store.currentInvoice.items?.filter((i) => i.is_dispensed && i.id).map((i) => i.id!) ?? []
    if (dispensedIds.length === 0) return
    await store.undispense(store.currentInvoice.id, dispensedIds)
    showSuccess('تم تراجع صرف الأصناف بنجاح')
    await store.fetchById(store.currentInvoice.id)
    await store.fetchPayments(store.currentInvoice.id)
    await applyFilters(store.currentPage)
  } catch {
    // error via toast
  }
}

async function onUndispenseItem(item: { id?: number }) {
  if (!store.currentInvoice || !item.id) return
  dispensingItemId.value = item.id
  try {
    await store.undispense(store.currentInvoice.id, [item.id])
    showSuccess('تم تراجع صرف الصنف بنجاح')
    await store.fetchById(store.currentInvoice.id)
    await store.fetchPayments(store.currentInvoice.id)
    await applyFilters(store.currentPage)
  } catch {
    // error via toast
  } finally {
    dispensingItemId.value = null
  }
}

function confirmDeleteInvoice(row: SaleInvoice) {
  if (row.status !== 'unpaid') return
  confirm.require({
    message: `هل أنت متأكد من حذف الفاتورة ${row.invoice_number}؟`,
    header: 'تأكيد الحذف',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'إلغاء',
    acceptLabel: 'حذف',
    acceptClass: 'p-button-danger p-button-sm',
    rejectClass: 'p-button-text p-button-secondary p-button-sm',
    acceptIcon: 'pi pi-trash',
    accept: async () => {
      try {
        await store.remove(row.id)
        showSuccess('تم حذف الفاتورة بنجاح')
        if (detailDialogVisible.value && store.currentInvoice?.id === row.id) {
          closeDetail()
        }
        await applyFilters()
      } catch {
        // error via toast
      }
    },
  })
}

function confirmDeletePayment(payment: InvoicePaymentLine) {
  if (!store.currentInvoice) return
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
          await store.deleteBalancePayment(store.currentInvoice!.id, payment.id)
        } else {
          await store.deletePayment(store.currentInvoice!.id, payment.id)
        }
        showSuccess('تم حذف الدفعة بنجاح')
        await store.fetchPayments(store.currentInvoice!.id)
        await applyFilters(store.currentPage)
      } catch {
        // error via toast
      }
    },
  })
}

function onPageChange(page: number) {
  const [date_from, date_to] = filters.value.dateRange
    ? [filters.value.dateRange[0], filters.value.dateRange[1]]
    : [undefined, undefined]
  store.fetchPage(page, store.perPage, {
    customer_id: filters.value.customer_id || undefined,
    status: filters.value.status || undefined,
    type: filters.value.type || undefined,
    date_from: date_from ? toYMD(date_from) : undefined,
    date_to: date_to ? toYMD(date_to) : undefined,
  })
}

onMounted(async () => {
  await Promise.all([
    customersStore.fetchAllForSelect(),
    productsStore.fetchAllForSelect(),
    accountsStore.fetchAll(),
  ])
  await applyFilters()
})
</script>

<template>
  <div dir="rtl">
    <div class="flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div class="flex align-items-center gap-2 flex-wrap">
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
          @update:model-value="() => applyFilters()"
        />
        <Select
          v-model="filters.customer_id"
          :options="customerOptions"
          option-label="label"
          option-value="value"
          placeholder="العميل"
          class="w-12rem"
          @change="() => applyFilters()"
        />
        <Select
          v-model="filters.status"
          :options="[
            { label: 'الكل', value: null },
            { label: 'غير مدفوع', value: 'unpaid' },
            { label: 'مدفوع جزئياً', value: 'partial' },
            { label: 'مدفوع', value: 'paid' },
          ]"
          option-label="label"
          option-value="value"
          placeholder="الحالة"
          class="w-10rem"
          @change="() => applyFilters()"
        />
        <Select
          v-model="filters.type"
          :options="[
            { label: 'الكل', value: null },
            { label: 'نقدي', value: 'cash' },
            { label: 'آجل', value: 'credit' },
          ]"
          option-label="label"
          option-value="value"
          placeholder="النوع"
          class="w-10rem"
          @change="() => applyFilters()"
        />
      </div>
      <Button
        :label="store.indexLoading && store.items.length ? 'جارى التحديث' : 'إضافة فاتورة'"
        icon="pi pi-plus"
        :disabled="store.indexLoading && store.items.length > 0"
        :loading="store.indexLoading && store.items.length > 0"
        @click="openCreate"
      />
    </div>

    <div class="flex flex-wrap gap-3 mb-4">
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">الإجمالي</div>
          <div class="text-xl font-bold">
            {{ store.summary.total_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">المدفوع</div>
          <div class="text-xl font-bold text-green-600">
            {{ store.summary.paid_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">المتبقي</div>
          <div class="text-xl font-bold text-amber-600">
            {{
              store.summary.remaining_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })
            }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">إجمالي المصروف</div>
          <div class="text-xl font-bold text-blue-600">
            {{
              store.summary.total_dispensed_amount.toLocaleString('ar-EG', {
                minimumFractionDigits: 2,
              })
            }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">المتبقي للصرف</div>
          <div class="text-xl font-bold text-cyan-600">
            {{
              store.summary.total_remaining_dispense.toLocaleString('ar-EG', {
                minimumFractionDigits: 2,
              })
            }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">إجمالي المستحقات</div>
          <div class="text-xl font-bold text-orange-600">
            {{ store.summary.total_dues.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
          </div>
        </template>
      </Card>
    </div>

    <Card>
      <template #content>
        <div
          v-if="store.indexLoading && !store.items.length"
          class="flex justify-content-center align-items-center py-8"
        >
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>
        <div
          v-else-if="store.items.length === 0"
          class="flex flex-column align-items-center justify-content-center py-8 gap-3 empty-state"
        >
          <i class="pi pi-shopping-cart text-6xl text-color-secondary"></i>
          <p class="text-color-secondary m-0">لا توجد فواتير بيع</p>
          <p class="text-sm text-color-secondary m-0">أضف فاتورة جديدة للبدء</p>
          <Button label="إضافة فاتورة" icon="pi pi-plus" @click="openCreate" />
        </div>
        <DataTable
          v-else
          :value="store.items"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          class="p-datatable-sm"
        >
          <Column field="invoice_number" header="رقم الفاتورة" />
          <Column field="invoice_date" header="التاريخ" />
          <Column field="customer" header="العميل">
            <template #body="{ data }">{{ data.customer?.name ?? '—' }}</template>
          </Column>
          <Column field="type" header="النوع">
            <template #body="{ data }">{{ typeLabel(data.type) }}</template>
          </Column>
          <Column field="total_amount" header="الإجمالي">
            <template #body="{ data }">
              {{ data.total_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
            </template>
          </Column>
          <Column field="paid_amount" header="المدفوع">
            <template #body="{ data }">
              {{ data.paid_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
            </template>
          </Column>
          <Column field="status" header="الحالة">
            <template #body="{ data }">
              <Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" />
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
          <Column header="الإجراءات" style="width: 220px">
            <template #body="{ data }">
              <Button
                label="عرض"
                icon="pi pi-eye"
                text
                size="small"
                class="p-button-info"
                @click="openDetail(data)"
              />
              <Button
                v-if="data.status === 'unpaid'"
                label="تعديل"
                icon="pi pi-pencil"
                text
                size="small"
                class="p-button-success"
                @click="openEdit(data)"
              />
              <Button
                v-if="data.status === 'unpaid' || data.status === 'partial'"
                label="دفعة"
                icon="pi pi-wallet"
                text
                size="small"
                class="p-button-warning"
                @click="openDetail(data, true)"
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
      </template>
      <template v-if="store.lastPage > 1" #footer>
        <div class="flex justify-content-between align-items-center">
          <span class="text-sm text-color-secondary">
            عرض {{ store.meta?.from ?? 0 }} - {{ store.meta?.to ?? 0 }} من {{ store.total }}
          </span>
          <div class="flex gap-1">
            <Button
              icon="pi pi-chevron-right"
              text
              size="small"
              :disabled="store.currentPage <= 1"
              @click="onPageChange(store.currentPage - 1)"
            />
            <span class="flex align-items-center px-2 text-sm">
              {{ store.currentPage }} / {{ store.lastPage }}
            </span>
            <Button
              icon="pi pi-chevron-left"
              text
              size="small"
              :disabled="store.currentPage >= store.lastPage"
              @click="onPageChange(store.currentPage + 1)"
            />
          </div>
        </div>
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
        :customers="formCustomers"
        :product-options="productOptions"
        :loading="store.indexLoading"
        :is-edit="isEditInvoice"
        :existing-items="isEditInvoice && formModel?.items ? formModel.items : undefined"
        @submit="onInvoiceFormSubmit"
        @cancel="onInvoiceFormCancel"
      />
    </Dialog>

    <!-- Invoice Detail Dialog -->
    <Dialog
      v-model:visible="detailDialogVisible"
      :header="`فاتورة ${store.currentInvoice?.invoice_number ?? detailOpeningInvoiceNumber ?? '...'}`"
      class="invoice-details-dialog"
      :modal="true"
      :style="{ width: '100%', maxWidth: '800px', margin: '0 20px' }"
      @hide="closeDetail"
    >
      <div v-if="store.showLoading && !store.currentInvoice" class="flex justify-content-center py-6">
        <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
      </div>
      <div
        v-else-if="store.currentInvoice"
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
        <div class="flex flex-wrap gap-4">
          <div>
            <span class="text-color-secondary">العميل:</span>
            {{ store.currentInvoice.customer?.name ?? '—' }}
          </div>
          <div>
            <span class="text-color-secondary">النوع:</span>
            {{ typeLabel(store.currentInvoice.type) }}
          </div>
          <div>
            <span class="text-color-secondary">التاريخ:</span>
            {{ store.currentInvoice.invoice_date }}
          </div>
          <div>
            <span class="text-color-secondary">الحالة:</span>
            <Tag
              :value="statusLabel(store.currentInvoice.status)"
              :severity="statusSeverity(store.currentInvoice.status)"
            />
          </div>
        </div>
        <div class="flex gap-4">
          <div>
            <span class="text-color-secondary">الإجمالي:</span>
            {{
              store.currentInvoice.total_amount.toLocaleString('ar-EG', {
                minimumFractionDigits: 2,
              })
            }}
          </div>
          <div>
            <span class="text-color-secondary">المدفوع:</span>
            {{
              store.currentInvoice.paid_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })
            }}
          </div>
          <div v-if="store.currentInvoice.status !== 'paid'">
            <span class="text-color-secondary">المتبقي:</span>
            {{
              (store.currentInvoice.total_amount - store.currentInvoice.paid_amount).toLocaleString(
                'ar-EG',
                { minimumFractionDigits: 2 },
              )
            }}
          </div>
        </div>
        <div class="flex flex-wrap gap-4 align-items-center">
          <div>
            <span class="text-color-secondary">حالة الصرف:</span>
            <Tag
              :value="DISPENSE_STATUS_LABELS[getDispenseStats(store.currentInvoice.items).status]"
              :severity="
                DISPENSE_STATUS_SEVERITY[getDispenseStats(store.currentInvoice.items).status]
              "
            />
          </div>
          <div>
            <span class="text-color-secondary">تم الصرف:</span>
            {{ formatAmount(getDispenseStats(store.currentInvoice.items).dispensedAmount) }}
          </div>
          <div>
            <span class="text-color-secondary">متبقي الصرف:</span>
            {{ formatAmount(getDispenseStats(store.currentInvoice.items).remainingAmount) }}
          </div>
        </div>
        <div class="flex gap-2">
          <Button
            v-if="store.currentInvoice.status === 'unpaid'"
            label="تعديل"
            icon="pi pi-pencil"
            size="small"
            @click="openEdit(store.currentInvoice!)"
          />
          <Button
            v-if="store.currentInvoice.status === 'unpaid'"
            label="حذف"
            icon="pi pi-trash"
            severity="danger"
            size="small"
            @click="confirmDeleteInvoice(store.currentInvoice)"
          />
          <Button
            v-if="
              store.currentInvoice.status === 'unpaid' || store.currentInvoice.status === 'partial'
            "
            label="إضافة دفعة"
            icon="pi pi-plus"
            size="small"
            @click="openAddPayment"
          />
          <Button
            v-if="hasUndispensedItems"
            label="صرف الأصناف"
            icon="pi pi-box"
            size="small"
            severity="secondary"
            :loading="store.showLoading"
            @click="onDispenseAll"
          />
          <Button
            v-if="hasDispensedItems"
            label="تراجع الصرف"
            icon="pi pi-undo"
            size="small"
            severity="secondary"
            outlined
            :loading="store.showLoading"
            @click="onUndispenseAll"
          />
        </div>
        <div>
          <h4 class="mt-0 mb-2">الأصناف</h4>
          <DataTable :value="store.currentInvoice.items" size="small" class="p-datatable-sm">
            <Column field="product_name" header="المنتج">
              <template #body="{ data }">
                <span>{{ data.product?.name ?? data.product_name ?? '—' }}</span>
                <Tag v-if="data.is_dispensed" value="تم الصرف" severity="success" class="mr-2" />
              </template>
            </Column>
            <Column field="quantity" header="الكمية" />
            <Column field="unit_price" header="سعر الوحدة">
              <template #body="{ data }">{{
                data.unit_price?.toLocaleString('ar-EG', { minimumFractionDigits: 2 })
              }}</template>
            </Column>
            <Column field="total_price" header="المجموع">
              <template #body="{ data }">{{
                (data.total_price ?? data.quantity * data.unit_price)?.toLocaleString('ar-EG', {
                  minimumFractionDigits: 2,
                })
              }}</template>
            </Column>
            <Column header="الإجراءات" style="width: 140px">
              <template #body="{ data }">
                <Button
                  v-if="!data.is_dispensed && data.id"
                  label="صرف"
                  icon="pi pi-box"
                  text
                  size="small"
                  severity="secondary"
                  :loading="dispensingItemId === data.id"
                  @click="onDispenseItem(data)"
                />
                <Button
                  v-else-if="data.is_dispensed && data.id"
                  label="تراجع"
                  icon="pi pi-undo"
                  text
                  size="small"
                  severity="warn"
                  :loading="dispensingItemId === data.id"
                  @click="onUndispenseItem(data)"
                />
              </template>
            </Column>
          </DataTable>
        </div>
        <div>
          <h4 class="mt-0 mb-2">الدفعات</h4>
          <DataTable
            v-if="store.payments.length"
            :value="store.payments"
            size="small"
            class="p-datatable-sm"
          >
            <Column header="النوع" style="width: 7rem">
              <template #body="{ data }">
                <Tag
                  :value="data.payment_type === 'balance' ? 'رصيد' : 'نقدي'"
                  :severity="data.payment_type === 'balance' ? 'info' : 'success'"
                />
              </template>
            </Column>
            <Column field="date" header="التاريخ" />
            <Column field="amount" header="المبلغ" />
            <Column header="الحساب">
              <template #body="{ data }">
                <span v-if="data.payment_type === 'balance'">—</span>
                <span v-else>{{ data.account?.name ?? '—' }}</span>
              </template>
            </Column>
            <Column field="description" header="الوصف">
              <template #body="{ data }">{{ data.description ?? '—' }}</template>
            </Column>
            <Column header="الإجراءات" style="width: 120px">
              <template #body="{ data }">
                <Button
                  v-if="data.payment_type === 'cash'"
                  icon="pi pi-pencil"
                  text
                  size="small"
                  @click="openEditPayment(data)"
                />
                <Button
                  icon="pi pi-trash"
                  text
                  size="small"
                  severity="danger"
                  @click="confirmDeletePayment(data)"
                />
              </template>
            </Column>
          </DataTable>
          <p v-else class="text-color-secondary m-0">لا توجد دفعات</p>
        </div>
        </div>

        <div class="invoice-print-layout print-only">
          <header class="invoice-print-header">
            <div class="invoice-print-brand">فاتورة بيع</div>
            <h1 class="invoice-print-title">
              فاتورة رقم {{ store.currentInvoice.invoice_number }}
            </h1>
            <p class="invoice-print-meta m-0">
              العميل: {{ store.currentInvoice.customer?.name ?? '—' }}
            </p>
            <p class="invoice-print-meta m-0">التاريخ: {{ store.currentInvoice.invoice_date }}</p>
            <p class="invoice-print-meta m-0">النوع: {{ typeLabel(store.currentInvoice.type) }}</p>
            <p class="invoice-print-meta m-0">
              الحالة: {{ statusLabel(store.currentInvoice.status) }}
            </p>
            <p class="invoice-print-meta m-0">تاريخ الإصدار: {{ issuedAtLabel }}</p>
            <div class="invoice-print-rule" />
          </header>

          <section class="invoice-print-section">
            <h4 class="invoice-print-h4">الأصناف</h4>
            <table v-if="store.currentInvoice.items?.length" class="invoice-print-table">
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
                <tr v-for="(item, idx) in store.currentInvoice.items" :key="item.id ?? idx">
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
            <table v-if="store.payments.length" class="invoice-print-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(pmt, idx) in store.payments" :key="pmt.id ?? idx">
                  <td>{{ pmt.date }}</td>
                  <td>{{ formatAmount(pmt.amount) }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-color-secondary m-0">لا توجد دفعات</p>
          </section>

          <footer class="invoice-print-totals">
            <p class="m-0">
              <strong>الإجمالي:</strong> {{ formatAmount(store.currentInvoice.total_amount) }}
            </p>
            <p class="m-0">
              <strong>المدفوع:</strong> {{ formatAmount(store.currentInvoice.paid_amount) }}
            </p>
            <p class="m-0">
              <strong>المتبقي:</strong>
              {{
                formatAmount(
                  Math.max(0, store.currentInvoice.total_amount - store.currentInvoice.paid_amount),
                )
              }}
            </p>
          </footer>
        </div>
      </div>
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
        v-if="paymentDialogVisible && store.currentInvoice"
        :model-value="paymentFormModel"
        :account-options="accountOptions"
        :loading="store.showLoading"
        :max-amount="isEditPayment ? undefined : remainingAmount"
        :is-edit="isEditPayment"
        :allow-balance-split="!isEditPayment"
        :customer-balance="store.currentInvoice.customer?.balance ?? 0"
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
