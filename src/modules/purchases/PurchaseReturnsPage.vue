<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { useConfirm } from 'primevue/useconfirm'
import { showError, showSuccess } from '@/composables/useToast'
import { usePurchaseReturnsStore } from '@/stores/purchaseReturns'
import { useSuppliersStore } from '@/stores/suppliers'
import { useProductsStore } from '@/stores/products'
import type { PurchaseReturn, PurchaseReturnCreatePayload, PurchaseInvoice } from '@/types'

const confirm = useConfirm()
const store = usePurchaseReturnsStore()
const suppliersStore = useSuppliersStore()
const productsStore = useProductsStore()

watch(
  () => store.error,
  (err) => {
    if (err) {
      showError(err)
      store.clearError()
    }
  },
)

// ── Filters ──────────────────────────────────────────────────────────────────
const filters = ref({
  supplier_id: null as number | null,
  dateRange: getCurrentMonthRange() as [Date, Date],
})

const currentPage = ref(1)

// ── Dialog state ─────────────────────────────────────────────────────────────
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const loadingInvoice = ref(false)

interface ReturnFormLine {
  product_id: number | null
  quantity: number
  unit_price: number
  max_quantity?: number
}

const formModel = ref<{
  supplier_id: number | null
  purchase_invoice_id: number | null
  date: string
  notes: string
  items: ReturnFormLine[]
}>({
  supplier_id: null,
  purchase_invoice_id: null,
  date: formatDateLocal(new Date()),
  notes: '',
  items: [],
})

const formDateValue = computed({
  get: () => (formModel.value.date ? new Date(formModel.value.date + 'T12:00:00') : null),
  set: (v: Date | null) => {
    formModel.value.date = v ? formatDateLocal(v) : formatDateLocal(new Date())
  },
})

function emptyLine(): ReturnFormLine {
  return { product_id: null, quantity: 1, unit_price: 0 }
}

// ── Auto-fill from purchase invoice ──────────────────────────────────────────
async function onInvoiceSelected(invoiceId: number | null) {
  if (!invoiceId) return

  if (!formModel.value.supplier_id) {
    showError('يرجى اختيار المورد أولاً')
    formModel.value.purchase_invoice_id = null
    return
  }

  loadingInvoice.value = true
  try {
    const invoice: PurchaseInvoice = await store.fetchPurchaseInvoice(invoiceId)
    
    if (invoice.supplier_id !== formModel.value.supplier_id) {
      showError('رقم الفاتورة المدخل لا يخص المورد المحدد')
      formModel.value.purchase_invoice_id = null
      return
    }

    if (invoice?.items?.length) {
      const itemsToReturn = invoice.items.map((item) => {
        const remaining = item.quantity - (item.returned_quantity || 0);
        return {
          product_id: item.product_id,
          quantity: remaining,
          unit_price: item.unit_price,
          max_quantity: remaining,
        }
      }).filter((item) => item.max_quantity > 0)
      
      if (itemsToReturn.length === 0) {
        showError('هذه الفاتورة تم إرجاع جميع أصنافها بالكامل')
        formModel.value.purchase_invoice_id = null
        loadingInvoice.value = false
        return
      }
      formModel.value.items = itemsToReturn
    }
  } catch {
    showError('فشل تحميل الفاتورة')
    formModel.value.purchase_invoice_id = null
  } finally {
    loadingInvoice.value = false
  }
}

// ── Options ───────────────────────────────────────────────────────────────────
const supplierOptions = computed(() => [
  { label: '— الكل —', value: null },
  ...suppliersStore.allSuppliers.map((s) => ({ label: s.name, value: s.id })),
])

const formSupplierOptions = computed(() =>
  suppliersStore.allSuppliers.map((s) => ({ label: s.name, value: s.id })),
)

const productOptions = computed(() =>
  productsStore.allProducts.map((p) => ({
    label: p.product_code ? `${p.product_code} - ${p.name}` : p.name,
    value: p.id,
    purchase_price: p.purchase_price,
  })),
)

// ── Computed line totals ──────────────────────────────────────────────────────
function lineTotal(line: ReturnFormLine): number {
  return Math.max(0, line.unit_price * line.quantity)
}

const formTotal = computed(() =>
  formModel.value.items.reduce((sum, l) => sum + lineTotal(l), 0),
)

function onProductSelected(line: ReturnFormLine, productId: number | null) {
  const opt = productOptions.value.find((p) => p.value === productId)
  if (opt) line.unit_price = opt.purchase_price ?? 0
}

function addLine() {
  formModel.value.items.push(emptyLine())
}

function removeLine(index: number) {
  formModel.value.items.splice(index, 1)
}

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadPage(page = 1) {
  currentPage.value = page
  const [dateFrom, dateTo] = filters.value.dateRange ?? []
  await store.fetchPage(page, 15, {
    supplier_id: filters.value.supplier_id ?? undefined,
    date_from: dateFrom ? formatDateLocal(dateFrom) : undefined,
    date_to: dateTo ? formatDateLocal(dateTo) : undefined,
  })
}

watch(filters, () => loadPage(1), { deep: true })

onMounted(async () => {
  await Promise.all([
    suppliersStore.fetchAllForSelect(),
    productsStore.fetchAllForSelect(),
  ])
  await loadPage(1)
})

// ── Dialog helpers ────────────────────────────────────────────────────────────
function openCreate() {
  isEdit.value = false
  editingId.value = null
  formModel.value = {
    supplier_id: null,
    purchase_invoice_id: null,
    date: formatDateLocal(new Date()),
    notes: '',
    items: [emptyLine()],
  }
  dialogVisible.value = true
}

function openEdit(r: PurchaseReturn) {
  isEdit.value = true
  editingId.value = r.id
  formModel.value = {
    supplier_id: r.supplier_id,
    purchase_invoice_id: r.purchase_invoice_id,
    date: r.date,
    notes: r.notes ?? '',
    items: r.items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
    })),
  }
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
}

async function submitForm() {
  if (!formModel.value.supplier_id) {
    showError('يرجى اختيار المورد')
    return
  }
  if (!formModel.value.items.length || formModel.value.items.some((i) => !i.product_id)) {
    showError('يرجى إضافة منتجات صحيحة')
    return
  }

  if (formModel.value.purchase_invoice_id) {
    const invalidItem = formModel.value.items.find(
      (i) => i.max_quantity !== undefined && i.quantity > i.max_quantity
    )
    if (invalidItem) {
      const prodName = productOptions.value.find(p => p.value === invalidItem.product_id)?.label || 'المنتج'
      showError(`الكمية المرتجعة للصنف (${prodName}) لا يمكن أن تتجاوز الكمية الأصلية في الفاتورة (${invalidItem.max_quantity})`)
      return
    }
  }

  const payload: PurchaseReturnCreatePayload = {
    supplier_id: formModel.value.supplier_id!,
    purchase_invoice_id: formModel.value.purchase_invoice_id || null,
    date: formModel.value.date,
    notes: formModel.value.notes || null,
    items: formModel.value.items.map((i) => ({
      product_id: i.product_id!,
      quantity: i.quantity,
      unit_price: i.unit_price,
    })),
  }

  try {
    if (isEdit.value && editingId.value) {
      await store.update(editingId.value, payload)
      showSuccess('تم تحديث المرتجع بنجاح')
    } else {
      await store.create(payload)
      showSuccess('تم إنشاء المرتجع بنجاح')
    }
    closeDialog()
    await loadPage(currentPage.value)
  } catch {
    // Error shown via watcher
  }
}

function confirmDelete(r: PurchaseReturn) {
  confirm.require({
    message: `هل أنت متأكد من حذف المرتجع ${r.code}؟ سيتم استرجاع كميات المخزون وعكس رصيد المورد.`,
    header: 'تأكيد الحذف',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'إلغاء', severity: 'secondary', outlined: true },
    acceptProps: { label: 'حذف', severity: 'danger' },
    accept: async () => {
      try {
        await store.remove(r.id)
        showSuccess('تم حذف المرتجع بنجاح')
        await loadPage(currentPage.value)
      } catch {
        // Error shown via watcher
      }
    },
  })
}

function formatAmount(n: number) {
  return formatMoney(n)
}
</script>

<template>
  <div class="page-container" dir="rtl">
    <ConfirmDialog />

    <!-- Header -->
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">مرتجعات المشتريات</h1>
        <span class="page-subtitle">إدارة البضاعة المرتجعة إلى الموردين</span>
      </div>
      <Button
        id="btn-create-purchase-return"
        label="مرتجع جديد"
        icon="pi pi-plus"
        @click="openCreate"
      />
    </div>

    <!-- Summary cards -->
    <div class="summary-cards">
      <div class="summary-card summary-card--orange">
        <i class="pi pi-arrow-right summary-card__icon"></i>
        <div>
          <p class="summary-card__label">إجمالي المرتجعات</p>
          <p class="summary-card__value">{{ formatAmount(store.summary.total_amount) }}</p>
        </div>
      </div>
      <div class="summary-card summary-card--teal">
        <i class="pi pi-list summary-card__icon"></i>
        <div>
          <p class="summary-card__label">عدد المرتجعات</p>
          <p class="summary-card__value">{{ store.summary.total_returns }}</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <Select
        v-model="filters.supplier_id"
        :options="supplierOptions"
        option-label="label"
        option-value="value"
        placeholder="كل الموردين"
        class="filter-select"
      />
      <DatePicker
        v-model="filters.dateRange"
        selection-mode="range"
        date-format="yy-mm-dd"
        placeholder="نطاق التاريخ"
        show-button-bar
        class="filter-datepicker"
      />
    </div>

    <!-- Table -->
    <div class="table-card">
      <DataTable
        :value="store.items"
        :loading="store.loading"
        striped-rows
        responsive-layout="scroll"
      >
        <Column field="code" header="الكود" style="width: 140px" />
        <Column header="المورد">
          <template #body="{ data }">{{ data.supplier?.name ?? '—' }}</template>
        </Column>
        <Column field="date" header="التاريخ" style="width: 120px" />
        <Column header="عدد الأصناف" style="width: 110px">
          <template #body="{ data }">{{ data.items?.length ?? 0 }}</template>
        </Column>
        <Column header="الإجمالي" style="width: 130px">
          <template #body="{ data }">{{ formatAmount(data.net_amount) }}</template>
        </Column>
        <Column header="الإجراءات" style="width: 120px">
          <template #body="{ data }">
            <div class="flex gap-2">
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                size="small"
                text
                :id="`btn-edit-pr-${data.id}`"
                @click="openEdit(data)"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                size="small"
                text
                :id="`btn-delete-pr-${data.id}`"
                @click="confirmDelete(data)"
              />
            </div>
          </template>
        </Column>
        <template #empty>
          <div class="table-empty">لا توجد مرتجعات للفترة المحددة</div>
        </template>
      </DataTable>

      <!-- Pagination -->
      <div v-if="store.lastPage > 1" class="pagination-bar">
        <Paginator
          :rows="store.perPage"
          :total-records="store.total"
          :first="(currentPage - 1) * store.perPage"
          @page="(e) => loadPage(e.page + 1)"
        />
      </div>
    </div>

    <!-- Create / Edit Dialog -->
    <Dialog
      v-model:visible="dialogVisible"
      :header="isEdit ? 'تعديل المرتجع' : 'مرتجع مشتريات جديد'"
      modal
      :style="{ width: '850px', maxWidth: '96vw' }"
      dir="rtl"
      class="modern-dialog"
    >
      <div class="return-form-container">
        <!-- Section: General Info -->
        <div class="form-section">
          <h3 class="section-title"><i class="pi pi-info-circle"></i> البيانات الأساسية</h3>
          <div class="form-grid">
            <div class="form-field">
              <label class="form-label">المورد <span class="required">*</span></label>
              <Select
                v-model="formModel.supplier_id"
                :options="formSupplierOptions"
                option-label="label"
                option-value="value"
                placeholder="اختر المورد"
                class="w-full"
                filter
              />
            </div>
            <div class="form-field">
              <label class="form-label">فاتورة الشراء (اختياري)</label>
              <InputNumber
                v-model="formModel.purchase_invoice_id"
                placeholder="رقم الفاتورة للتعبئة التلقائية"
                class="w-full"
                :use-grouping="false"
                @update:model-value="onInvoiceSelected($event)"
              />
              <small v-if="loadingInvoice" class="text-primary mt-1 flex align-items-center gap-1">
                <i class="pi pi-spin pi-spinner"></i> جاري تحميل بنود الفاتورة...
              </small>
            </div>
            <div class="form-field">
              <label class="form-label">التاريخ <span class="required">*</span></label>
              <DatePicker
                v-model="formDateValue"
                date-format="yy-mm-dd"
                class="w-full"
              />
            </div>
            <div class="form-field">
              <label class="form-label">ملاحظات</label>
              <InputText v-model="formModel.notes" placeholder="ملاحظات اختيارية" class="w-full" />
            </div>
          </div>
        </div>

        <!-- Section: Items -->
        <div class="form-section items-wrapper">
          <div class="items-header">
            <h3 class="section-title m-0 border-none pb-0"><i class="pi pi-box"></i> البنود المرتجعة</h3>
            <Button label="إضافة منتج" icon="pi pi-plus" size="small" outlined @click="addLine" />
          </div>

          <div v-if="formModel.items.length === 0" class="items-empty-state">
            <i class="pi pi-inbox text-4xl mb-3 text-gray-400"></i>
            <p class="m-0 font-bold text-gray-700">لا توجد بنود حالياً</p>
            <small class="text-gray-500 mt-1">اضغط على "إضافة منتج" أو أدخل رقم فاتورة للتعبئة التلقائية</small>
          </div>

          <div class="items-list" v-else>
            <div v-for="(line, idx) in formModel.items" :key="idx" class="item-card">
              <div class="item-card-header">
                <span class="item-badge">#{{ idx + 1 }}</span>
                <Button icon="pi pi-trash" severity="danger" text rounded aria-label="حذف" @click="removeLine(idx)" />
              </div>
              <div class="item-card-body">
                <div class="item-field product-col">
                  <label class="item-label">المنتج</label>
                  <Select
                    v-model="line.product_id"
                    :options="productOptions"
                    option-label="label"
                    option-value="value"
                    placeholder="اختر المنتج"
                    class="w-full"
                    filter
                    @update:model-value="onProductSelected(line, $event)"
                  />
                </div>
                <div class="item-field">
                  <label class="item-label">الكمية</label>
                  <InputNumber v-model="line.quantity" :min="0.01" :min-fraction-digits="0" :max-fraction-digits="4" class="w-full" />
                </div>
                <div class="item-field">
                  <label class="item-label">سعر الوحدة</label>
                  <InputNumber v-model="line.unit_price" :min="0" :min-fraction-digits="0" :max-fraction-digits="4" class="w-full" />
                </div>
                <div class="item-total-block">
                  <span class="item-total-label">الإجمالي</span>
                  <span class="item-total-value">{{ formatAmount(lineTotal(line)) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="form-grand-total" v-if="formModel.items.length">
            <div class="total-label">الإجمالي الكلي للمرتجع</div>
            <div class="total-amount">{{ formatAmount(formTotal) }}</div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-actions">
          <Button label="إلغاء" icon="pi pi-times" severity="secondary" outlined @click="closeDialog" />
          <Button
            :label="isEdit ? 'حفظ التعديلات' : 'اعتماد المرتجع'"
            icon="pi pi-check"
            :loading="store.loading"
            @click="submitForm"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.page-container {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.page-subtitle {
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #6b7280);
}

.summary-cards {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  flex: 1;
  min-width: 180px;
  color: #fff;
}

.summary-card--orange { background: linear-gradient(135deg, #f97316, #ea580c); }
.summary-card--teal   { background: linear-gradient(135deg, #14b8a6, #0d9488); }

.summary-card__icon { font-size: 1.75rem; opacity: 0.8; }
.summary-card__label { font-size: 0.8rem; opacity: 0.85; margin: 0; }
.summary-card__value { font-size: 1.25rem; font-weight: 700; margin: 0; }

.filter-bar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-select { min-width: 200px; }
.filter-datepicker { min-width: 240px; }

.table-card {
  background: var(--p-surface-card, #fff);
  border-radius: 12px;
  border: 1px solid var(--p-surface-border, #e5e7eb);
  overflow: hidden;
}

.table-empty {
  text-align: center;
  padding: 2rem;
  color: var(--p-text-muted-color, #6b7280);
}

.pagination-bar {
  display: flex;
  justify-content: center;
  padding: 0.75rem;
  border-top: 1px solid var(--p-surface-border, #e5e7eb);
}

/* Modern Dialog Styles */
.return-form-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-top: 0.5rem;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--p-text-color, #1f2937);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--p-surface-border, #e5e7eb);
}

.section-title i {
  color: var(--p-primary-color, #3b82f6);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--p-text-color, #374151);
}

.required {
  color: #ef4444;
}

/* Items specific */
.items-wrapper {
  background: var(--p-surface-ground, #f9fafb);
  border: 1px solid var(--p-surface-border, #e5e7eb);
  border-radius: 12px;
  padding: 1.25rem;
}

.items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.items-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  background: #ffffff;
  border-radius: 8px;
  border: 1px dashed var(--p-surface-border, #d1d5db);
  text-align: center;
  margin-top: 1rem;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.item-card {
  background: #ffffff;
  border: 1px solid var(--p-surface-border, #e5e7eb);
  border-radius: 10px;
  padding: 1rem;
  transition: box-shadow 0.2s;
}

.item-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.item-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--p-surface-border, #f3f4f6);
}

.item-badge {
  background: var(--p-primary-50, #eff6ff);
  color: var(--p-primary-600, #2563eb);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 700;
}

.item-card-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 1rem;
  align-items: flex-end;
}

.product-col {
  grid-column: span 2;
}

.item-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0; /* Prevents flex/grid overflow */
}

/* Ensure PrimeVue elements don't overflow the cell */
.item-field :deep(.p-select),
.item-field :deep(.p-inputnumber),
.item-field :deep(.p-inputtext) {
  width: 100%;
}

.item-label {
  font-size: 0.8rem;
  color: var(--p-text-muted-color, #6b7280);
  font-weight: 600;
  white-space: nowrap;
}

.item-total-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--p-surface-ground, #f9fafb);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--p-surface-border, #e5e7eb);
  width: 100%;
}

.item-total-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color, #6b7280);
}

.item-total-value {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--p-primary-color, #3b82f6);
}

.form-grand-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--p-primary-50, #eff6ff);
  border: 1px solid var(--p-primary-200, #bfdbfe);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  margin-top: 1rem;
}

.total-label {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--p-primary-700, #1d4ed8);
}

.total-amount {
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--p-primary-800, #1e40af);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  width: 100%;
}
</style>
