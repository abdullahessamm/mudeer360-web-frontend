<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { formatDateLocal } from '@/lib/date'
import type {
  PurchaseInvoice,
  PurchaseInvoiceCreatePayload,
  PurchaseInvoiceItem,
  PurchaseInvoiceOtherCost,
} from '@/types'
import { formatMoney } from '@/lib/format'

const props = defineProps<{
  modelValue?: Partial<PurchaseInvoice> | null
  supplierOptions: { label: string; value: number | null }[]
  productOptions: { label: string; value: number; purchase_price: number }[]
  loading?: boolean
  isEdit?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: PurchaseInvoiceCreatePayload]
  cancel: []
}>()

const today = formatDateLocal(new Date())

interface RowItem {
  _rowId: number
  product_id: number | null
  quantity: number
  unit_price: number
  returned_quantity: number
}

interface CostItem {
  _rowId: number
  description: string
  cost: number
}

let rowIdCounter = 0
let costIdCounter = 0
const rows = ref<RowItem[]>([])
const costRows = ref<CostItem[]>([])

const form = reactive({
  supplier_id: props.modelValue?.supplier_id ?? (null as number | null),
  type: (props.modelValue?.type ?? 'credit') as 'cash' | 'credit',
  invoice_date: props.modelValue?.invoice_date ?? today,
  notes: props.modelValue?.notes ?? '',
  discount_amount: props.modelValue?.discount_amount ?? 0,
  discount_percentage: props.modelValue?.discount_percentage ?? 0,
})

const datePickerValue = computed({
  get: () => (form.invoice_date ? new Date(form.invoice_date + 'T12:00:00') : null),
  set: (v: Date | null) => {
    form.invoice_date = v ? formatDateLocal(v) : today
  },
})

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.supplier_id = v.supplier_id ?? null
      form.type = (v.type ?? 'credit') as 'cash' | 'credit'
      form.invoice_date = v.invoice_date ?? today
      form.notes = v.notes ?? ''
      form.discount_amount = v.discount_amount ?? 0
      form.discount_percentage = v.discount_percentage ?? 0

      if (v.items?.length) {
        rows.value = v.items.map((it: PurchaseInvoiceItem) => ({
          _rowId: ++rowIdCounter,
          product_id: it.product_id ?? null,
          quantity: it.quantity ?? 0,
          unit_price: it.unit_price ?? 0,
          returned_quantity: it.returned_quantity ?? 0,
        }))
      } else {
        rows.value = []
      }

      if (v.other_costs?.length) {
        costRows.value = v.other_costs.map((c: PurchaseInvoiceOtherCost) => ({
          _rowId: ++costIdCounter,
          description: c.description ?? '',
          cost: c.cost ?? 0,
        }))
      } else {
        costRows.value = []
      }
    }
  },
  { immediate: true },
)

function addRow() {
  rows.value.push({
    _rowId: ++rowIdCounter,
    product_id: null,
    quantity: 1,
    unit_price: 0,
    returned_quantity: 0,
  })
}

function removeRow(index: number) {
  rows.value.splice(index, 1)
}

function addCostRow() {
  costRows.value.push({
    _rowId: ++costIdCounter,
    description: '',
    cost: 0,
  })
}

function removeCostRow(index: number) {
  costRows.value.splice(index, 1)
}

function onProductSelect(index: number, productId: number | null) {
  const row = rows.value[index]
  if (!row) return
  row.product_id = productId
  if (productId) {
    const opt = props.productOptions.find((o) => o.value === productId)
    if (opt) row.unit_price = opt.purchase_price
  } else {
    row.unit_price = 0
  }
}

const productsSubtotal = computed(() =>
  rows.value.reduce(
    (sum, r) => sum + (r.product_id ? (r.quantity || 0) * (r.unit_price || 0) : 0),
    0,
  ),
)

const costsSubtotal = computed(() =>
  costRows.value.reduce((sum, r) => sum + (Number(r.cost) || 0), 0),
)

const subtotalAmount = computed(() => productsSubtotal.value + costsSubtotal.value)

const finalDiscountAmount = computed(() => {
  if (form.discount_percentage > 0) {
    return (subtotalAmount.value * form.discount_percentage) / 100
  }
  return form.discount_amount || 0
})

const totalAmount = computed(() => Math.max(0, subtotalAmount.value - finalDiscountAmount.value))

const validItems = computed(() => {
  return rows.value
    .filter((r) => r.product_id != null && r.quantity > 0 && r.unit_price >= 0)
    .map((r) => ({
      product_id: r.product_id!,
      quantity: r.quantity,
      unit_price: r.unit_price,
    }))
})

const validOtherCosts = computed(() => {
  return costRows.value
    .filter((r) => r.description.trim() !== '' && Number(r.cost) >= 0)
    .map((r) => ({
      description: r.description.trim(),
      cost: Number(r.cost) || 0,
    }))
})

const hasValidItems = computed(() => validItems.value.length > 0)
const hasValidCosts = computed(() => validOtherCosts.value.length > 0)
const canSubmit = computed(() => hasValidItems.value || hasValidCosts.value)

function onSubmit() {
  if (!canSubmit.value) return
  emit('submit', {
    supplier_id: form.supplier_id ?? undefined,
    type: form.type,
    invoice_date: form.invoice_date,
    notes: form.notes?.trim() || undefined,
    discount_amount: form.discount_amount > 0 ? form.discount_amount : undefined,
    discount_percentage: form.discount_percentage > 0 ? form.discount_percentage : undefined,
    items: validItems.value,
    other_costs: validOtherCosts.value,
  })
}

function onCancel() {
  emit('cancel')
}

// On create, start with 1 row if empty and no cost rows
watch(
  () => rows.value.length,
  (len) => {
    if (len === 0 && costRows.value.length === 0 && !props.isEdit) addRow()
  },
  { immediate: true },
)
</script>

<template>
  <form @submit.prevent="onSubmit" class="flex flex-column gap-3">
    <div class="field">
      <label for="pi-supplier">المورد</label>
      <Select
        id="pi-supplier"
        v-model="form.supplier_id"
        :options="supplierOptions"
        option-label="label"
        option-value="value"
        placeholder="اختر المورد (اختياري)"
        class="w-full mt-1"
        show-clear
      />
    </div>

    <div class="field">
      <label for="pi-type">النوع <span class="text-red-500">*</span></label>
      <Select
        id="pi-type"
        v-model="form.type"
        :options="[
          { label: 'نقدي', value: 'cash' },
          { label: 'آجل', value: 'credit' },
        ]"
        option-label="label"
        option-value="value"
        class="w-full mt-1"
      />
    </div>

    <div class="field">
      <label for="pi-date">تاريخ الفاتورة <span class="text-red-500">*</span></label>
      <DatePicker
        id="pi-date"
        v-model="datePickerValue"
        date-format="yy-mm-dd"
        show-icon
        icon-display="input"
        class="w-full mt-1"
      />
    </div>

    <div class="field">
      <label for="pi-notes">ملاحظات</label>
      <InputText id="pi-notes" v-model="form.notes" class="w-full mt-1" placeholder="ملاحظات اختيارية..." />
    </div>

    <div class="flex flex-column md:flex-row gap-3">
      <div class="field flex-1">
        <label for="pi-discount-pct">نسبة الخصم (%)</label>
        <InputNumber
          id="pi-discount-pct"
          v-model="form.discount_percentage"
          :min="0"
          :max="100"
          :min-fraction-digits="0"
          :max-fraction-digits="2"
          class="w-full mt-1"
          @update:modelValue="form.discount_amount = 0"
        />
      </div>
      <div class="field flex-1">
        <label for="pi-discount-amt">قيمة الخصم</label>
        <InputNumber
          id="pi-discount-amt"
          v-model="form.discount_amount"
          :min="0"
          :min-fraction-digits="0"
          :max-fraction-digits="2"
          class="w-full mt-1"
          :disabled="form.discount_percentage > 0"
        />
      </div>
    </div>

    <!-- Products Table Section -->
    <div class="field">
      <div class="flex justify-content-between align-items-center mb-2">
        <div class="flex align-items-center gap-2">
          <label class="font-bold">الأصناف / المنتجات</label>
          <span class="text-xs text-color-secondary">(اختياري)</span>
        </div>
        <Button label="إضافة صنف" icon="pi pi-plus" size="small" outlined @click="addRow" />
      </div>

      <DataTable v-if="rows.length > 0" :value="rows" data-key="_rowId" size="small" class="p-datatable-sm">
        <Column header="المنتج" style="min-width: 200px">
          <template #body="{ data, index }">
            <Select
              :model-value="data.product_id"
              :options="productOptions"
              option-label="label"
              option-value="value"
              placeholder="اختر المنتج"
              class="w-full"
              :disabled="data.returned_quantity > 0"
              @update:model-value="(v: number) => onProductSelect(index, v)"
            />
            <small v-if="data.returned_quantity > 0" class="text-orange-500 block mt-1">يوجد مرتجع ({{ data.returned_quantity }})</small>
          </template>
        </Column>
        <Column header="الكمية" style="width: 120px">
          <template #body="{ data }">
            <InputNumber
              v-model="data.quantity"
              :min="0.01"
              :min-fraction-digits="0"
              :max-fraction-digits="4"
              class="w-full"
              :disabled="data.returned_quantity > 0"
            />
          </template>
        </Column>
        <Column header="سعر الوحدة" style="width: 120px">
          <template #body="{ data }">
            <InputNumber
              v-model="data.unit_price"
              :min="0"
              :min-fraction-digits="0"
              :max-fraction-digits="4"
              class="w-full"
              :disabled="data.returned_quantity > 0"
            />
          </template>
        </Column>
        <Column header="المجموع" style="width: 100px">
          <template #body="{ data }">
            {{ formatMoney((data.quantity || 0) * (data.unit_price || 0)) }}
          </template>
        </Column>
        <Column header="" style="width: 50px">
          <template #body="{ data, index }">
            <Button
              v-if="!data.returned_quantity"
              icon="pi pi-trash"
              text
              severity="danger"
              size="small"
              @click="removeRow(index)"
            />
          </template>
        </Column>
      </DataTable>

      <div
        v-else
        class="p-3 text-center border-round border-1 border-dashed surface-border text-color-secondary text-sm"
      >
        لا توجد أصناف مضافة. يمكنك إضافة صنف أو الاكتفاء بالتكاليف الأخرى.
      </div>
    </div>

    <!-- Other Costs Section -->
    <div class="field mt-2">
      <div class="flex justify-content-between align-items-center mb-2">
        <div class="flex align-items-center gap-2">
          <label class="font-bold">التكاليف الأخرى</label>
          <span class="text-xs text-color-secondary">(اختياري - شحن، نقل، تخليص جمركي...)</span>
        </div>
        <Button label="إضافة تكلفة" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addCostRow" />
      </div>

      <DataTable v-if="costRows.length > 0" :value="costRows" data-key="_rowId" size="small" class="p-datatable-sm">
        <Column header="الوصف / البيان" style="min-width: 250px">
          <template #body="{ data }">
            <InputText
              v-model="data.description"
              placeholder="مثال: رسوم شحن ونقل، رسوم تخليص..."
              class="w-full p-inputtext-sm"
            />
          </template>
        </Column>
        <Column header="التكلفة" style="width: 140px">
          <template #body="{ data }">
            <InputNumber
              v-model="data.cost"
              :min="0"
              :min-fraction-digits="0"
              :max-fraction-digits="2"
              class="w-full"
            />
          </template>
        </Column>
        <Column header="" style="width: 50px">
          <template #body="{ index }">
            <Button
              icon="pi pi-trash"
              text
              severity="danger"
              size="small"
              @click="removeCostRow(index)"
            />
          </template>
        </Column>
      </DataTable>

      <div
        v-else
        class="p-3 text-center border-round border-1 border-dashed surface-border text-color-secondary text-sm"
      >
        لا توجد تكاليف أخرى مضافة
      </div>
    </div>

    <!-- Invoice Summary -->
    <div class="flex flex-column gap-1 mt-2 mb-2 p-3 bg-gray-50 border-round">
      <div class="flex justify-content-between">
        <span>المجموع الفرعي:</span>
        <span>{{ formatMoney(subtotalAmount) }}</span>
      </div>
      <div class="flex justify-content-between text-red-500" v-if="finalDiscountAmount > 0">
        <span>الخصم:</span>
        <span>-{{ formatMoney(finalDiscountAmount) }}</span>
      </div>
      <div class="flex justify-content-between font-bold text-lg border-top-1 border-gray-300 pt-2 mt-1">
        <span>الإجمالي النهائي:</span>
        <span>{{ formatMoney(totalAmount) }}</span>
      </div>
    </div>

    <small v-if="!canSubmit" class="p-error block text-center">
      يجب إضافة صنف واحد على الأقل أو تكلفة أخرى صالحة
    </small>

    <div class="flex justify-content-end align-items-center mt-2">
      <div class="flex gap-2">
        <Button type="button" label="إلغاء" text @click="onCancel" />
        <Button type="submit" label="حفظ" icon="pi pi-check" :loading="loading" :disabled="!canSubmit" />
      </div>
    </div>
  </form>
</template>
