<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useCustomersStore } from '@/stores/customers'
import { formatDateLocal } from '@/lib/date'
import type { Customer, SaleInvoice, SaleInvoiceCreatePayload, SaleInvoiceItem } from '@/types'
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

let rowIdCounter = 0
const rows = ref<RowItem[]>([])

/** Customer input: selected Customer object or typed string (for new customer) */
const customerInput = ref<Customer | string | null>(null)

const form = reactive({
  type: (props.modelValue?.type ?? 'credit') as 'cash' | 'credit',
  invoice_date: props.modelValue?.invoice_date ?? today,
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

const subtotalAmount = computed(() =>
  rows.value.reduce((sum, r) => sum + r.quantity * r.unit_price, 0),
)

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

const canSubmit = computed(() => validItems.value.length >= 1)

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
    discount_amount: form.discount_amount > 0 ? form.discount_amount : undefined,
    discount_percentage: form.discount_percentage > 0 ? form.discount_percentage : undefined,
    tax_percentage: form.tax_percentage > 0 ? form.tax_percentage : undefined,
    items: validItems.value,
  })
}

function onCancel() {
  emit('cancel')
}

// Ensure at least one row on create
watch(
  () => rows.value.length,
  (len) => {
    if (len === 0 && !props.isEdit) addRow()
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
    <div class="grid gap-3">
      <div class="col-12 md:col-6">
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
          />
        </div>
      </div>
      <div class="col-12 md:col-6">
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
          />
          <small v-if="form.discount_percentage > 0" class="text-color-secondary block mt-1">
            يتم تجاهل هذا المبلغ عند تفعيل نسبة الخصم
          </small>
        </div>
      </div>
      <div class="col-12 md:col-6">
        <div class="field">
          <label for="si-tax-percentage">نسبة الضريبة (%) </label>
          <InputNumber
            id="si-tax-percentage"
            v-model="form.tax_percentage"
            :min="0"
            :min-fraction-digits="0"
            :max-fraction-digits="2"
            class="w-full mt-1"
          />
        </div>
      </div>
    </div>
    <div class="field">
      <div class="flex justify-content-between align-items-center mb-2">
        <label>الأصناف <span class="text-red-500">*</span></label>
        <Button label="إضافة صنف" icon="pi pi-plus" size="small" @click="addRow" />
      </div>
      <DataTable :value="rows" data-key="_rowId" size="small" class="p-datatable-sm">
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
        <Column header="الكمية" style="width: 120px">
          <template #body="{ data, index }">
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
          <template #body="{ data, index }">
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
            {{ formatMoney(data.quantity * data.unit_price) }}
          </template>
        </Column>
        <Column header="" style="width: 60px">
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
      <small v-if="!canSubmit && rows.length > 0" class="p-error"
        >يجب إضافة صنف واحد على الأقل بكمية وسعر صحيحين</small
      >
    </div>
    <div class="flex flex-column gap-2 mt-3 p-3 border-round" style="background-color: var(--surface-50)">
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
