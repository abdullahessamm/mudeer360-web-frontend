<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import {
  getReceiveStats,
  RECEIVE_STATUS_LABELS,
  RECEIVE_STATUS_SEVERITY,
} from '@/lib/receive'
import { useConfirm } from 'primevue/useconfirm'
import { showError, showSuccess } from '@/composables/useToast'
import { usePurchasesStore } from '@/stores/purchases'
import { useSuppliersStore } from '@/stores/suppliers'
import { useProductsStore } from '@/stores/products'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'
import PurchaseInvoiceForm from '@/components/forms/PurchaseInvoiceForm.vue'
import PaymentForm from '@/components/forms/PaymentForm.vue'
import type { PurchaseInvoice, PurchaseInvoiceCreatePayload, PaymentPayload } from '@/types'
import type { FinancialTransaction } from '@/types'

const confirm = useConfirm()
const store = usePurchasesStore()
const suppliersStore = useSuppliersStore()
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
  supplier_id: null as number | null,
  status: null as 'unpaid' | 'partial' | 'paid' | null,
  type: null as 'cash' | 'credit' | null,
  dateRange: getCurrentMonthRange() as [Date, Date],
})

const invoiceDialogVisible = ref(false)
const isEditInvoice = ref(false)
const editingInvoiceId = ref<number | null>(null)
const formModel = ref<Partial<PurchaseInvoice> | null>(null)

const detailDialogVisible = ref(false)
const detailOpeningInvoiceNumber = ref<string | null>(null)
const paymentDialogVisible = ref(false)
const isEditPayment = ref(false)
const editingPaymentId = ref<number | null>(null)
const paymentFormModel = ref<Partial<PaymentPayload> | null>(null)
const receivingItemId = ref<number | null>(null)

const supplierOptions = computed(() => [
  { label: '— الكل —', value: null },
  ...suppliersStore.allSuppliers.map((s) => ({ label: s.name, value: s.id })),
])

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

const formSupplierOptions = computed(() => [
  { label: '— اختياري —', value: null },
  ...suppliersStore.allSuppliers.map((s) => ({ label: s.name, value: s.id })),
])

const statusLabel = (status: string) =>
  ({ paid: 'مدفوع', partial: 'مدفوع جزئياً', unpaid: 'غير مدفوع' }[status] ?? status)

const typeLabel = (type: string) => ({ cash: 'نقدي', credit: 'آجل' }[type] ?? type)

const statusSeverity = (status: string) =>
  ({ paid: 'success', partial: 'warn', unpaid: 'danger' }[status] ?? 'secondary')

function formatAmount(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2 })
}

const remainingAmount = computed(() => {
  const inv = store.currentInvoice
  if (!inv) return 0
  return Math.max(0, inv.total_amount - inv.paid_amount)
})

const unreceivedCount = computed(() => {
  const items = store.currentInvoice?.items ?? []
  return items.filter((i) => !i.is_received).length
})

const hasUnreceivedItems = computed(() => unreceivedCount.value > 0)

const receivedCount = computed(() => {
  const items = store.currentInvoice?.items ?? []
  return items.filter((i) => i.is_received).length
})
const hasReceivedItems = computed(() => receivedCount.value > 0)

const formTitle = computed(() =>
  isEditInvoice.value ? 'تعديل الفاتورة' : 'إضافة فاتورة شراء',
)

const paymentFormTitle = computed(() =>
  isEditPayment.value ? 'تعديل الدفعة' : 'إضافة دفعة',
)

function toYMD(d: Date) {
  return formatDateLocal(d)
}

function applyFilters(page = 1) {
  const [date_from, date_to] = filters.value.dateRange
    ? [filters.value.dateRange[0], filters.value.dateRange[1]]
    : [undefined, undefined]
  store.fetchPage(page, store.perPage, {
    supplier_id: filters.value.supplier_id || undefined,
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
    supplier_id: undefined,
    type: 'credit',
    invoice_date: formatDateLocal(new Date()),
    items: [],
  }
  invoiceDialogVisible.value = true
}

async function openEdit(row: PurchaseInvoice) {
  if (row.status !== 'unpaid') return
  await productsStore.fetchAllForSelect()
  isEditInvoice.value = true
  editingInvoiceId.value = row.id
  formModel.value = {
    supplier_id: row.supplier_id,
    supplier: row.supplier,
    type: row.type,
    invoice_date: row.invoice_date,
    items: row.items ?? [],
  }
  invoiceDialogVisible.value = true
}

async function onInvoiceFormSubmit(payload: PurchaseInvoiceCreatePayload) {
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

function openDetail(row: PurchaseInvoice, openPaymentAfter = false) {
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

async function onReceiveAll() {
  if (!store.currentInvoice) return
  try {
    await store.receive(store.currentInvoice.id)
    showSuccess('تم استلام الأصناف بنجاح')
    await store.fetchById(store.currentInvoice.id)
    await store.fetchPayments(store.currentInvoice.id)
    await applyFilters(store.currentPage)
  } catch {
    // error via toast
  }
}

async function onReceiveItem(item: { id?: number }) {
  if (!store.currentInvoice || !item.id) return
  receivingItemId.value = item.id
  try {
    await store.receive(store.currentInvoice.id, [item.id])
    showSuccess('تم استلام الصنف بنجاح')
    await store.fetchById(store.currentInvoice.id)
    await store.fetchPayments(store.currentInvoice.id)
    await applyFilters(store.currentPage)
  } catch {
    // error via toast
  } finally {
    receivingItemId.value = null
  }
}

async function onUnreceiveAll() {
  if (!store.currentInvoice) return
  try {
    const receivedIds =
      store.currentInvoice.items?.filter((i) => i.is_received && i.id).map((i) => i.id!) ?? []
    if (receivedIds.length === 0) return
    await store.unreceive(store.currentInvoice.id, receivedIds)
    showSuccess('تم تراجع استلام الأصناف بنجاح')
    await store.fetchById(store.currentInvoice.id)
    await store.fetchPayments(store.currentInvoice.id)
    await applyFilters(store.currentPage)
  } catch {
    // error via toast
  }
}

async function onUnreceiveItem(item: { id?: number }) {
  if (!store.currentInvoice || !item.id) return
  receivingItemId.value = item.id
  try {
    await store.unreceive(store.currentInvoice.id, [item.id])
    showSuccess('تم تراجع استلام الصنف بنجاح')
    await store.fetchById(store.currentInvoice.id)
    await store.fetchPayments(store.currentInvoice.id)
    await applyFilters(store.currentPage)
  } catch {
    // error via toast
  } finally {
    receivingItemId.value = null
  }
}

function confirmDeleteInvoice(row: PurchaseInvoice) {
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

function confirmDeletePayment(payment: FinancialTransaction) {
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
        await store.deletePayment(store.currentInvoice!.id, payment.id)
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
    supplier_id: filters.value.supplier_id || undefined,
    status: filters.value.status || undefined,
    type: filters.value.type || undefined,
    date_from: date_from ? toYMD(date_from) : undefined,
    date_to: date_to ? toYMD(date_to) : undefined,
  })
}

onMounted(async () => {
  await Promise.all([
    suppliersStore.fetchAllForSelect(),
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
          v-model="filters.supplier_id"
          :options="supplierOptions"
          option-label="label"
          option-value="value"
          placeholder="المورد"
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
          <div class="text-color-secondary text-sm mb-1">إجمالي المستلم</div>
          <div class="text-xl font-bold text-blue-600">
            {{
              store.summary.total_received_amount.toLocaleString('ar-EG', {
                minimumFractionDigits: 2,
              })
            }}
          </div>
        </template>
      </Card>
      <Card class="flex-1 min-w-10rem">
        <template #content>
          <div class="text-color-secondary text-sm mb-1">المتبقي للاستلام</div>
          <div class="text-xl font-bold text-cyan-600">
            {{
              store.summary.total_remaining_receive.toLocaleString('ar-EG', {
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
          <i class="pi pi-truck text-6xl text-color-secondary"></i>
          <p class="text-color-secondary m-0">لا توجد فواتير شراء</p>
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
          <Column field="supplier" header="المورد">
            <template #body="{ data }">{{ data.supplier?.name ?? '—' }}</template>
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
      <PurchaseInvoiceForm
        v-if="invoiceDialogVisible"
        :model-value="formModel"
        :supplier-options="formSupplierOptions"
        :product-options="productOptions"
        :loading="store.indexLoading"
        :is-edit="isEditInvoice"
        @submit="onInvoiceFormSubmit"
        @cancel="onInvoiceFormCancel"
      />
    </Dialog>

    <!-- Invoice Detail Dialog -->
    <Dialog
      v-model:visible="detailDialogVisible"
      :header="`فاتورة ${store.currentInvoice?.invoice_number ?? detailOpeningInvoiceNumber ?? '...'}`"
      :modal="true"
      :style="{ width: '100%', maxWidth: '800px', margin: '0 20px' }"
      @hide="closeDetail"
    >
      <div v-if="store.showLoading && !store.currentInvoice" class="flex justify-content-center py-6">
        <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
      </div>
      <div v-else-if="store.currentInvoice" class="flex flex-column gap-4">
        <div class="flex flex-wrap gap-4">
          <div><span class="text-color-secondary">المورد:</span> {{ store.currentInvoice.supplier?.name ?? '—' }}</div>
          <div><span class="text-color-secondary">النوع:</span> {{ typeLabel(store.currentInvoice.type) }}</div>
          <div><span class="text-color-secondary">التاريخ:</span> {{ store.currentInvoice.invoice_date }}</div>
          <div><span class="text-color-secondary">الحالة:</span>
            <Tag :value="statusLabel(store.currentInvoice.status)" :severity="statusSeverity(store.currentInvoice.status)" />
          </div>
        </div>
        <div class="flex gap-4">
          <div><span class="text-color-secondary">الإجمالي:</span> {{ store.currentInvoice.total_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}</div>
          <div><span class="text-color-secondary">المدفوع:</span> {{ store.currentInvoice.paid_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}</div>
          <div v-if="store.currentInvoice.status !== 'paid'">
            <span class="text-color-secondary">المتبقي:</span>
            {{ (store.currentInvoice.total_amount - store.currentInvoice.paid_amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
          </div>
        </div>
        <div class="flex flex-wrap gap-4 align-items-center">
          <div>
            <span class="text-color-secondary">حالة الاستلام:</span>
            <Tag
              :value="RECEIVE_STATUS_LABELS[getReceiveStats(store.currentInvoice.items).status]"
              :severity="RECEIVE_STATUS_SEVERITY[getReceiveStats(store.currentInvoice.items).status]"
            />
          </div>
          <div>
            <span class="text-color-secondary">تم الاستلام:</span>
            {{ formatAmount(getReceiveStats(store.currentInvoice.items).receivedAmount) }}
          </div>
          <div>
            <span class="text-color-secondary">متبقي الاستلام:</span>
            {{ formatAmount(getReceiveStats(store.currentInvoice.items).remainingAmount) }}
          </div>
        </div>
        <div class="flex gap-2 flex-wrap">
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
            v-if="store.currentInvoice.status === 'unpaid' || store.currentInvoice.status === 'partial'"
            label="إضافة دفعة"
            icon="pi pi-plus"
            size="small"
            @click="openAddPayment"
          />
          <Button
            v-if="hasUnreceivedItems"
            label="استلام الأصناف"
            icon="pi pi-box"
            size="small"
            severity="secondary"
            :loading="store.showLoading"
            @click="onReceiveAll"
          />
          <Button
            v-if="hasReceivedItems"
            label="تراجع الاستلام"
            icon="pi pi-undo"
            size="small"
            severity="secondary"
            outlined
            :loading="store.showLoading"
            @click="onUnreceiveAll"
          />
        </div>
        <div>
          <h4 class="mt-0 mb-2">الأصناف</h4>
          <DataTable :value="store.currentInvoice.items" size="small" class="p-datatable-sm">
            <Column field="product_name" header="المنتج">
              <template #body="{ data }">
                <span>{{ data.product?.name ?? data.product_name ?? '—' }}</span>
                <Tag v-if="data.is_received" value="تم الاستلام" severity="success" class="mr-2" />
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
                  v-if="!data.is_received && data.id"
                  label="استلام"
                  icon="pi pi-box"
                  text
                  size="small"
                  severity="secondary"
                  :loading="receivingItemId === data.id"
                  @click="onReceiveItem(data)"
                />
                <Button
                  v-else-if="data.is_received && data.id"
                  label="تراجع"
                  icon="pi pi-undo"
                  text
                  size="small"
                  severity="warn"
                  :loading="receivingItemId === data.id"
                  @click="onUnreceiveItem(data)"
                />
              </template>
            </Column>
          </DataTable>
        </div>
        <div>
          <h4 class="mt-0 mb-2">الدفعات</h4>
          <DataTable v-if="store.payments.length" :value="store.payments" size="small" class="p-datatable-sm">
            <Column field="date" header="التاريخ" />
            <Column field="amount" header="المبلغ" />
            <Column header="الحساب">
              <template #body="{ data }">{{ data.account?.name ?? '—' }}</template>
            </Column>
            <Column field="description" header="الوصف">
              <template #body="{ data }">{{ data.description ?? '—' }}</template>
            </Column>
            <Column header="الإجراءات" style="width: 120px">
              <template #body="{ data }">
                <Button icon="pi pi-pencil" text size="small" @click="openEditPayment(data)" />
                <Button icon="pi pi-trash" text size="small" severity="danger" @click="confirmDeletePayment(data)" />
              </template>
            </Column>
          </DataTable>
          <p v-else class="text-color-secondary m-0">لا توجد دفعات</p>
        </div>
      </div>
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
        v-if="paymentDialogVisible && store.currentInvoice"
        :model-value="paymentFormModel"
        :account-options="accountOptions"
        :loading="store.showLoading"
        :max-amount="isEditPayment ? undefined : remainingAmount"
        :is-edit="isEditPayment"
        @submit="onPaymentFormSubmit"
        @cancel="onPaymentFormCancel"
      />
    </Dialog>
  </div>
</template>
