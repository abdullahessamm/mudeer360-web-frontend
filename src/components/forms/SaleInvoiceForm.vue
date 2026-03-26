<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useCustomersStore } from '@/stores/customers'
import { formatDateLocal } from '@/lib/date'
import type { Customer, SaleInvoice, SaleInvoiceCreatePayload, SaleInvoiceItem } from '@/types'

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

const totalAmount = computed(() =>
  rows.value.reduce((sum, r) => sum + r.quantity * r.unit_price, 0),
)

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
            {{
              (data.quantity * data.unit_price).toLocaleString('ar-EG', {
                minimumFractionDigits: 2,
              })
            }}
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
    <div class="flex justify-content-between align-items-center mt-2">
      <span class="font-semibold"
        >الإجمالي: {{ totalAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}</span
      >
      <div class="flex gap-2">
        <Button type="button" label="إلغاء" text @click="onCancel" />
        <Button
          type="submit"
          label="حفظ"
          icon="pi pi-check"
          :loading="loading"
          :disabled="!canSubmit"
        />
      </div>
    </div>
  </form>
</template>
