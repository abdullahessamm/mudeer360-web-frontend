<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useCustomersStore } from '@/stores/customers'
import { formatDateLocal } from '@/lib/date'
import type { Customer, SaleInvoice, SaleInvoiceCreatePayload, SaleInvoiceItem, SaleInvoiceOtherCost } from '@/types'
import { formatMoney } from '@/lib/format'

const props = defineProps<{
  modelValue?: Partial<SaleInvoice> | null
  customers: Customer[]
  productOptions: { label: string; value: number; sale_price: number; quantity: number }[]
  loading?: boolean
  isEdit?: boolean
  /** Original invoice items (for edit mode stock validation - quantities to add back) */
  existingItems?: SaleInvoiceItem[]
}>()

const customersStore = useCustomersStore()
const customerSuggestions = ref<Customer[]>([])

const emit = defineEmits<{
  submit: [payload: SaleInvoiceCreatePayload]
  cancel: []
}>()

const today = formatDateLocal(new Date())

interface RowItem {
  _rowId: number
  product_id: number | null
  quantity: number
  unit_price: number
}

interface RowCost {
  _rowId: number
  description: string
  cost: number
}

let rowIdCounter = 0
let costIdCounter = 0

const rows = ref<RowItem[]>([])
const costRows = ref<RowCost[]>([])

/** Customer input: selected Customer object or typed string (for new customer) */
const customerInput = ref<Customer | string | null>(null)

const form = reactive({
  type: (props.modelValue?.type ?? 'credit') as 'cash' | 'credit',
  invoice_date: props.modelValue?.invoice_date ?? today,
  notes: (props.modelValue?.notes ?? '') as string,
  discount_amount: (props.modelValue?.discount_amount ?? 0) as number,
  discount_percentage: (props.modelValue?.discount_percentage ?? 0) as number,
  tax_percentage: (props.modelValue?.tax_percentage ?? 0) as number,
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
      if (v.customer && typeof v.customer === 'object') {
        customerInput.value = v.customer
      } else if (v.customer_id && props.customers.length) {
        customerInput.value = props.customers.find((x) => x.id === v.customer_id) ?? null
      } else {
        customerInput.value = null
      }
      form.type = (v.type ?? 'credit') as 'cash' | 'credit'
      form.invoice_date = v.invoice_date ?? today
      form.notes = v.notes ?? ''
      form.discount_amount = v.discount_amount ?? 0
      form.discount_percentage = v.discount_percentage ?? 0
      form.tax_percentage = v.tax_percentage ?? 0

      if (v.items?.length) {
        rows.value = v.items.map((it: SaleInvoiceItem) => ({
          _rowId: ++rowIdCounter,
          product_id: it.product_id ?? null,
          quantity: it.quantity ?? 0,
          unit_price: it.unit_price ?? 0,
        }))
      } else {
        rows.value = []
      }

      if (v.other_costs?.length) {
        costRows.value = v.other_costs.map((c: SaleInvoiceOtherCost) => ({
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
    if (opt) row.unit_price = opt.sale_price
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

const calculatedDiscountAmount = computed(() => {
  if (form.discount_percentage > 0) {
    return (subtotalAmount.value * form.discount_percentage) / 100
  }
  return form.discount_amount
})

const amountAfterDiscount = computed(() => subtotalAmount.value - calculatedDiscountAmount.value)

const calculatedTaxAmount = computed(() => {
  return (amountAfterDiscount.value * form.tax_percentage) / 100
})

const totalAmount = computed(() => amountAfterDiscount.value + calculatedTaxAmount.value)

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

function onCustomerComplete(event: { query: string }) {
  const q = (event.query ?? '').trim().toLowerCase()
  if (!q) {
    customerSuggestions.value = [...props.customers]
    return
  }
  customerSuggestions.value = props.customers.filter((c) => c.name.toLowerCase().includes(q))
}

/** Stock is validated when dispensing, not at create/update */
async function onSubmit() {
  if (!canSubmit.value) return
  let customerId: number | undefined
  const inp = customerInput.value
  if (inp) {
    if (typeof inp === 'object' && inp.id) {
      customerId = inp.id
    } else if (typeof inp === 'string' && inp.trim()) {
      const customer = await customersStore.findOrCreate(inp.trim())
      customerId = customer.id
    }
  }
  emit('submit', {
    customer_id: customerId,
    type: form.type,
    invoice_date: form.invoice_date,
    notes: form.notes?.trim() || undefined,
    discount_amount: form.discount_amount > 0 ? form.discount_amount : 0,
    discount_percentage: form.discount_percentage > 0 ? form.discount_percentage : 0,
    tax_percentage: form.tax_percentage > 0 ? form.tax_percentage : 0,
    items: validItems.value,
    other_costs: validOtherCosts.value,
  })
}

function onCancel() {
  emit('cancel')
}

// On create, start with 1 row if empty
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
      <label for="si-customer">العميل</label>
      <AutoComplete
        id="si-customer"
        v-model="customerInput"
        :suggestions="customerSuggestions"
        option-label="name"
        placeholder="اكتب اسم العميل أو اختر من القائمة"
        class="w-full mt-1"
        :force-selection="false"
        fluid
        @complete="onCustomerComplete"
      />
      <small class="text-color-secondary block mt-1"
        >اختر عميلاً موجوداً أو اكتب اسماً جديداً لإنشائه</small
      >
    </div>

    <div class="field">
      <label for="si-type">النوع <span class="text-red-500">*</span></label>
      <Select
        id="si-type"
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
      <label for="si-date">تاريخ الفاتورة <span class="text-red-500">*</span></label>
      <DatePicker
        id="si-date"
        v-model="datePickerValue"
        date-format="yy-mm-dd"
        show-icon
        icon-display="input"
        class="w-full mt-1"
      />
    </div>

    <div class="field">
      <label for="si-notes">ملاحظات الفاتورة</label>
      <Textarea
        id="si-notes"
        v-model="form.notes"
        rows="2"
        placeholder="أدخل أي ملاحظات خاصة بالفاتورة أو تعليمات التسليم..."
        class="w-full mt-1"
        auto-resize
      />
    </div>

    <div class="flex align-items-start gap-2">
      <div class="flex-1">
        <div class="field">
          <label for="si-discount-percentage">نسبة الخصم (%) </label>
          <InputNumber
            id="si-discount-percentage"
            v-model="form.discount_percentage"
            :min="0"
            :max="100"
            :min-fraction-digits="0"
            :max-fraction-digits="2"
            class="w-full mt-1"
            fluid
          />
        </div>
      </div>
      <div class="flex-1">
        <div class="field">
          <label for="si-discount-amount">المبلغ الثابت للخصم</label>
          <InputNumber
            id="si-discount-amount"
            v-model="form.discount_amount"
            :min="0"
            :min-fraction-digits="0"
            :max-fraction-digits="2"
            class="w-full mt-1"
            :disabled="form.discount_percentage > 0"
            fluid
          />
          <small v-if="form.discount_percentage > 0" class="text-color-secondary block mt-1">
            يتم تجاهل هذا المبلغ عند تفعيل نسبة الخصم
          </small>
        </div>
      </div>
    </div>

    <div class="field">
      <label for="si-tax-percentage">نسبة الضريبة (%) </label>
      <InputNumber
        id="si-tax-percentage"
        v-model="form.tax_percentage"
        :min="0"
        :min-fraction-digits="0"
        :max-fraction-digits="2"
        class="w-full mt-1"
        fluid
      />
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
              @update:model-value="(v: number) => onProductSelect(index, v)"
            />
          </template>
        </Column>
        <Column header="الكمية" style="width: 110px">
          <template #body="{ data }">
            <InputNumber
              v-model="data.quantity"
              :min="0.01"
              :min-fraction-digits="0"
              :max-fraction-digits="4"
              class="w-full"
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
            />
          </template>
        </Column>
        <Column header="المجموع" style="width: 100px">
          <template #body="{ data }">
            {{ formatMoney((data.quantity || 0) * (data.unit_price || 0)) }}
          </template>
        </Column>
        <Column header="" style="width: 50px">
          <template #body="{ index }">
            <Button
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
          <span class="text-xs text-color-secondary">(اختياري - شحن، تركيب، خدمات...)</span>
        </div>
        <Button label="إضافة تكلفة" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addCostRow" />
      </div>

      <DataTable v-if="costRows.length > 0" :value="costRows" data-key="_rowId" size="small" class="p-datatable-sm">
        <Column header="الوصف / البيان" style="min-width: 250px">
          <template #body="{ data }">
            <InputText
              v-model="data.description"
              placeholder="مثال: رسوم شحن وتوصيل، خدمة تركيب..."
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
              class="w-full p-inputtext-sm"
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
        لا توجد تكاليف أخرى مضافة.
      </div>

      <small v-if="!canSubmit" class="p-error block mt-2">
        يجب أن تحتوي الفاتورة على صنف واحد على الأقل أو تكلفة أخرى واحدة على الأقل.
      </small>
    </div>

    <!-- Summary & Totals Box -->
    <div
      class="flex flex-column gap-2 mt-2 p-3 border-round"
      style="background-color: var(--surface-50)"
    >
      <div v-if="productsSubtotal > 0 && costsSubtotal > 0" class="flex justify-content-between text-sm text-color-secondary">
        <span>إجمالي الأصناف:</span>
        <span>{{ formatMoney(productsSubtotal) }}</span>
      </div>
      <div v-if="costsSubtotal > 0 && productsSubtotal > 0" class="flex justify-content-between text-sm text-color-secondary">
        <span>إجمالي التكاليف الأخرى:</span>
        <span>{{ formatMoney(costsSubtotal) }}</span>
      </div>
      <div class="flex justify-content-between">
        <span>الإجمالي الجزئي:</span>
        <span class="font-semibold">{{ formatMoney(subtotalAmount) }}</span>
      </div>
      <div v-if="calculatedDiscountAmount > 0" class="flex justify-content-between text-orange-600">
        <span>الخصم:</span>
        <span class="font-semibold">- {{ formatMoney(calculatedDiscountAmount) }}</span>
      </div>
      <div v-if="calculatedTaxAmount > 0" class="flex justify-content-between text-blue-600">
        <span>الضريبة:</span>
        <span class="font-semibold">+ {{ formatMoney(calculatedTaxAmount) }}</span>
      </div>
      <Divider />
      <div class="flex justify-content-between">
        <span class="font-bold">الإجمالي النهائي:</span>
        <span class="font-bold text-xl text-green-600">{{ formatMoney(totalAmount) }}</span>
      </div>
    </div>

    <div class="flex justify-content-end gap-2 mt-3">
      <Button type="button" label="إلغاء" text @click="onCancel" />
      <Button
        type="submit"
        label="حفظ"
        icon="pi pi-check"
        :loading="loading"
        :disabled="!canSubmit"
      />
    </div>
  </form>
</template>
