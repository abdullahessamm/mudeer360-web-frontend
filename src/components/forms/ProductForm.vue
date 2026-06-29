<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { productEditRules, productRules } from '@/validations/schemas'
import { formatQty } from '@/lib/format'
import type { Product } from '@/types'

const props = defineProps<{
  modelValue?: Partial<Product> | null
  categoryOptions: { label: string; value: number }[]
  loading?: boolean
  isEdit?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: Partial<Product> & { auto_generate_code?: boolean }]
  cancel: []
}>()

const form = reactive({
  product_code: '',
  auto_generate_code: true,
  name: '',
  product_category_id: null as number | null,
  unit: 'قطعة',
  purchase_price: 0,
  sale_price: 0,
  opening_quantity: 0,
  quantity: 0,
  min_quantity: 0,
  description: '',
})

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function syncFromModel(v: NonNullable<typeof props.modelValue>) {
  form.product_code = v.product_code ?? ''
  form.auto_generate_code = props.isEdit
    ? Boolean((v as { auto_generate_code?: boolean }).auto_generate_code)
    : ((v as { auto_generate_code?: boolean }).auto_generate_code ?? true)
  form.name = v.name ?? ''
  form.product_category_id = v.product_category_id ?? null
  form.unit = v.unit ?? 'قطعة'
  form.purchase_price = num(v.purchase_price)
  form.sale_price = num(v.sale_price)
  form.opening_quantity =
    v.opening_quantity != null && Number.isFinite(Number(v.opening_quantity))
      ? num(v.opening_quantity)
      : num(v.quantity)
  form.quantity = num(v.quantity)
  form.min_quantity = num(v.min_quantity)
  form.description = v.description ?? ''
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) syncFromModel(v)
  },
  { immediate: true },
)

const validationRules = computed(() => (props.isEdit ? productEditRules : productRules))

const v$ = useVuelidate(validationRules, form)

const invalid = computed(() => v$.value.$invalid)

function normalizeNumericFields() {
  form.purchase_price = num(form.purchase_price)
  form.sale_price = num(form.sale_price)
  form.opening_quantity = num(form.opening_quantity)
  form.min_quantity = num(form.min_quantity)
}

async function onSubmit() {
  normalizeNumericFields()
  v$.value.$touch()
  if (v$.value.$invalid) return
  const payload: Partial<Product> & { auto_generate_code?: boolean } = {
    name: form.name.trim(),
    product_category_id: form.product_category_id || undefined,
    unit: form.unit.trim() || 'قطعة',
    purchase_price: form.purchase_price,
    sale_price: form.sale_price,
    opening_quantity: form.opening_quantity,
    min_quantity: form.min_quantity,
    description: form.description?.trim() || undefined,
  }
  if (form.auto_generate_code) {
    payload.auto_generate_code = true
  } else {
    payload.product_code = form.product_code?.trim() ?? ''
  }
  emit('submit', payload)
}

function onCancel() {
  v$.value.$reset()
  emit('cancel')
}

function displayQty(n: number | null | undefined) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return formatQty(v)
}

function errorMsg(field: keyof typeof form) {
  const f = v$.value[field]
  if (!f?.$error) return ''
  if (f.required?.$invalid) return 'الحقل مطلوب'
  if (f.maxLength?.$invalid) return `الحد الأقصى ${f.maxLength.$params.max} حرف`
  if (f.minValue?.$invalid) return `الحد الأدنى ${f.minValue.$params.min}`
  if (f.numeric?.$invalid) return 'يجب أن يكون رقماً'
  return ''
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="flex flex-column gap-3">
    <div class="field">
      <div class="flex align-items-center gap-2 mb-2">
        <Checkbox
          v-model="form.auto_generate_code"
          input-id="p-auto-code"
          :binary="true"
        />
        <label for="p-auto-code" class="cursor-pointer text-sm">
          {{ props.isEdit ? 'توليد كود جديد' : 'توليد كود تلقائي' }}
        </label>
      </div>
      <InputText
        v-if="!form.auto_generate_code"
        id="p-code"
        v-model="form.product_code"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.product_code?.$error }"
        :placeholder="props.isEdit ? 'الكود الحالي أو اتركه فارغاً للتوليد' : 'كود المنتج (اختياري)'"
        maxlength="50"
        @blur="v$.product_code?.$touch()"
      />
      <small v-else class="text-color-secondary text-sm">
        {{ props.isEdit ? 'سيتم توليد كود جديد عند الحفظ' : 'سيتم توليد كود تلقائي (مثل PRD-000001)' }}
      </small>
      <small v-if="v$.product_code?.$error" class="p-error">{{ errorMsg('product_code') }}</small>
    </div>
    <div class="field">
      <label for="p-name">الاسم <span class="text-red-500">*</span></label>
      <InputText
        id="p-name"
        v-model="form.name"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.name.$error }"
        placeholder="اسم المنتج"
        @blur="v$.name.$touch()"
      />
      <small v-if="v$.name.$error" class="p-error">{{ errorMsg('name') }}</small>
    </div>
    <div class="field">
      <label for="p-cat">الفئة</label>
      <Select
        id="p-cat"
        v-model="form.product_category_id"
        :options="props.categoryOptions"
        option-label="label"
        option-value="value"
        placeholder="اختر الفئة"
        class="w-full mt-1"
        show-clear
      />
    </div>
    <div class="field">
      <label for="p-unit">الوحدة <span class="text-red-500">*</span></label>
      <InputText
        id="p-unit"
        v-model="form.unit"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.unit.$error }"
        placeholder="قطعة"
        @blur="v$.unit.$touch()"
      />
      <small v-if="v$.unit.$error" class="p-error">{{ errorMsg('unit') }}</small>
    </div>
    <div class="field">
      <label for="p-purchase">سعر الشراء <span class="text-red-500">*</span></label>
      <InputNumber
        id="p-purchase"
        v-model="form.purchase_price"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.purchase_price.$error }"
        :min-fraction-digits="0"
        :max-fraction-digits="2"
        @blur="v$.purchase_price.$touch()"
      />
      <small v-if="v$.purchase_price.$error" class="p-error">{{
        errorMsg('purchase_price')
      }}</small>
    </div>
    <div class="field">
      <label for="p-sale">سعر البيع <span class="text-red-500">*</span></label>
      <InputNumber
        id="p-sale"
        v-model="form.sale_price"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.sale_price.$error }"
        :min-fraction-digits="0"
        :max-fraction-digits="2"
        @blur="v$.sale_price.$touch()"
      />
      <small v-if="v$.sale_price.$error" class="p-error">{{ errorMsg('sale_price') }}</small>
    </div>

    <div class="field">
      <label for="p-opening">الكمية الافتتاحية <span class="text-red-500">*</span></label>
      <InputNumber
        id="p-opening"
        v-model="form.opening_quantity"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.opening_quantity?.$error }"
        :min="0"
        :min-fraction-digits="0"
        :max-fraction-digits="3"
        @blur="v$.opening_quantity?.$touch()"
      />
      <small class="text-color-secondary text-sm">
        تُسجَّل كرصيد أولي؛ تتغيّر الكمية الحالية لاحقاً عبر الشراء والبيع فقط.
      </small>
      <small v-if="v$.opening_quantity?.$error" class="p-error">{{
        errorMsg('opening_quantity')
      }}</small>
    </div>

    <div class="field">
      <label for="p-qty">الكمية الحالية</label>
      <InputText
        id="p-qty"
        :model-value="displayQty(form.quantity)"
        class="w-full mt-1"
        readonly
        disabled
      />
      <small class="text-color-secondary text-sm">
        تُحدَّث تلقائياً من حركات المخزون (استلام، صرف، …) ولا يمكن تعديلها يدوياً.
      </small>
    </div>

    <div class="field">
      <label for="p-min">الحد الأدنى للكمية <span class="text-red-500">*</span></label>
      <InputNumber
        id="p-min"
        v-model="form.min_quantity"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.min_quantity.$error }"
        :min="0"
        :min-fraction-digits="0"
        :max-fraction-digits="2"
        @blur="v$.min_quantity.$touch()"
      />
      <small v-if="v$.min_quantity.$error" class="p-error">{{ errorMsg('min_quantity') }}</small>
    </div>
    <div class="field">
      <label for="p-desc">الوصف</label>
      <Textarea
        id="p-desc"
        v-model="form.description"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.description?.$error }"
        placeholder="وصف المنتج"
        rows="3"
        @blur="v$.description?.$touch()"
      />
      <small v-if="v$.description?.$error" class="p-error">{{ errorMsg('description') }}</small>
    </div>
    <div class="flex justify-content-end gap-2 mt-2">
      <Button type="button" label="إلغاء" text @click="onCancel" />
      <Button type="submit" label="حفظ" icon="pi pi-check" :loading="loading" :disabled="invalid" />
    </div>
  </form>
</template>
