<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { productRules } from '@/validations/schemas'
import type { Product } from '@/types'

const props = defineProps<{
  modelValue?: Partial<Product> | null
  categoryOptions: { label: string; value: number }[]
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: Partial<Product>]
  cancel: []
}>()

const form = reactive({
  name: props.modelValue?.name ?? '',
  product_category_id: props.modelValue?.product_category_id ?? (null as number | null),
  unit: props.modelValue?.unit ?? 'قطعة',
  purchase_price: props.modelValue?.purchase_price ?? 0,
  sale_price: props.modelValue?.sale_price ?? 0,
  quantity: props.modelValue?.quantity ?? 0,
  min_quantity: props.modelValue?.min_quantity ?? 0,
  description: props.modelValue?.description ?? '',
})

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.name = v.name ?? ''
      form.product_category_id = v.product_category_id ?? null
      form.unit = v.unit ?? 'قطعة'
      form.purchase_price = v.purchase_price ?? 0
      form.sale_price = v.sale_price ?? 0
      form.quantity = v.quantity ?? 0
      form.min_quantity = v.min_quantity ?? 0
      form.description = v.description ?? ''
    }
  },
  { immediate: true },
)

const rules = productRules
const v$ = useVuelidate(rules, form)

const invalid = computed(() => v$.value.$invalid)

async function onSubmit() {
  v$.value.$touch()
  if (v$.value.$invalid) return
  emit('submit', {
    name: form.name.trim(),
    product_category_id: form.product_category_id || undefined,
    unit: form.unit.trim() || 'قطعة',
    purchase_price: form.purchase_price,
    sale_price: form.sale_price,
    quantity: form.quantity,
    min_quantity: form.min_quantity,
    description: form.description?.trim() || undefined,
  })
}

function onCancel() {
  v$.value.$reset()
  emit('cancel')
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
        :options="categoryOptions"
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
      <label for="p-qty">الكمية <span class="text-red-500">*</span></label>
      <InputNumber
        id="p-qty"
        v-model="form.quantity"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.quantity.$error }"
        :min="0"
        :min-fraction-digits="0"
        :max-fraction-digits="3"
        @blur="v$.quantity.$touch()"
      />
      <small v-if="v$.quantity.$error" class="p-error">{{ errorMsg('quantity') }}</small>
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
        :class="{ 'p-invalid': v$.description.$error }"
        placeholder="وصف المنتج"
        rows="3"
        @blur="v$.description.$touch()"
      />
      <small v-if="v$.description.$error" class="p-error">{{ errorMsg('description') }}</small>
    </div>
    <div class="flex justify-content-end gap-2 mt-2">
      <Button type="button" label="إلغاء" text @click="onCancel" />
      <Button type="submit" label="حفظ" icon="pi pi-check" :loading="loading" :disabled="invalid" />
    </div>
  </form>
</template>
