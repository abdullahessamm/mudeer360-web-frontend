<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { assetRules } from '@/validations/schemas'
import { formatDateLocal, formatDateOnly } from '@/lib/date'
import { ASSET_STATUS_OPTIONS } from '@/lib/assetStatus'
import type { Asset, AssetStatusValue } from '@/types'

const props = defineProps<{
  modelValue?: Partial<Asset> | null
  categoryOptions: { label: string; value: number }[]
  loading?: boolean
  isEdit?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: Partial<Asset> & { auto_generate_code?: boolean }]
  cancel: []
}>()

const today = formatDateLocal(new Date())

const form = reactive({
  code: props.modelValue?.code ?? '',
  auto_generate_code: (props.modelValue as { auto_generate_code?: boolean } | undefined)
    ?.auto_generate_code ?? true,
  name: props.modelValue?.name ?? '',
  asset_category_id: props.modelValue?.asset_category_id ?? (null as number | null),
  purchase_price: props.modelValue?.purchase_price ?? 0,
  purchase_date: props.modelValue?.purchase_date
    ? formatDateOnly(props.modelValue.purchase_date)
    : today,
  status: (props.modelValue?.status as AssetStatusValue | undefined) ?? 'working',
  location: props.modelValue?.location ?? '',
  notes: props.modelValue?.notes ?? '',
})

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.code = v.code ?? ''
      form.auto_generate_code = props.isEdit ? false : true
      form.name = v.name ?? ''
      form.asset_category_id = v.asset_category_id ?? null
      form.purchase_price = v.purchase_price ?? 0
      form.purchase_date = v.purchase_date ? formatDateOnly(v.purchase_date) : today
      form.status = (v.status as AssetStatusValue) ?? 'working'
      form.location = v.location ?? ''
      form.notes = v.notes ?? ''
    }
  },
  { immediate: true },
)

const rules = assetRules
const v$ = useVuelidate(rules, form)

const invalid = computed(() => v$.value.$invalid)

const datePickerValue = computed({
  get: () => (form.purchase_date ? new Date(form.purchase_date + 'T12:00:00') : null),
  set: (d: Date | null) => {
    form.purchase_date = d ? formatDateLocal(d) : today
  },
})

async function onSubmit() {
  v$.value.$touch()
  if (v$.value.$invalid) return
  const payload: Partial<Asset> & { auto_generate_code?: boolean } = {
    name: form.name.trim(),
    asset_category_id: form.asset_category_id,
    purchase_price: form.purchase_price,
    purchase_date: form.purchase_date,
    status: form.status,
    location: form.location?.trim() || undefined,
    notes: form.notes?.trim() || undefined,
  }
  if (form.auto_generate_code) {
    payload.auto_generate_code = true
  } else {
    payload.code = form.code?.trim() ?? ''
  }
  emit('submit', payload)
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
      <div class="flex align-items-center gap-2 mb-2">
        <Checkbox
          v-model="form.auto_generate_code"
          input-id="a-auto-code"
          :binary="true"
        />
        <label for="a-auto-code" class="cursor-pointer text-sm">
          {{ props.isEdit ? 'توليد كود جديد' : 'توليد كود تلقائي' }}
        </label>
      </div>
      <InputText
        v-if="!form.auto_generate_code"
        id="a-code"
        v-model="form.code"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.code?.$error }"
        :placeholder="props.isEdit ? 'الكود الحالي أو اتركه فارغاً للتوليد' : 'كود الأصل (اختياري)'"
        maxlength="64"
        @blur="v$.code?.$touch()"
      />
      <small v-else class="text-color-secondary text-sm">
        {{ props.isEdit ? 'سيتم توليد كود جديد عند الحفظ' : 'سيتم توليد كود تلقائي' }}
      </small>
      <small v-if="v$.code?.$error" class="p-error">{{ errorMsg('code') }}</small>
    </div>
    <div class="field">
      <label for="a-name">الاسم <span class="text-red-500">*</span></label>
      <InputText
        id="a-name"
        v-model="form.name"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.name.$error }"
        placeholder="اسم الأصل"
        @blur="v$.name.$touch()"
      />
      <small v-if="v$.name.$error" class="p-error">{{ errorMsg('name') }}</small>
    </div>
    <div class="field">
      <label for="a-cat">فئة الأصل</label>
      <Select
        id="a-cat"
        v-model="form.asset_category_id"
        :options="categoryOptions"
        option-label="label"
        option-value="value"
        placeholder="اختر الفئة"
        class="w-full mt-1"
        show-clear
      />
    </div>
    <div class="field">
      <label for="a-price">سعر الشراء <span class="text-red-500">*</span></label>
      <InputNumber
        id="a-price"
        v-model="form.purchase_price"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.purchase_price.$error }"
        :min="0"
        :min-fraction-digits="0"
        :max-fraction-digits="2"
        @blur="v$.purchase_price.$touch()"
      />
      <small v-if="v$.purchase_price.$error" class="p-error">{{
        errorMsg('purchase_price')
      }}</small>
    </div>
    <div class="field">
      <label for="a-date">تاريخ الشراء <span class="text-red-500">*</span></label>
      <DatePicker
        id="a-date"
        v-model="datePickerValue"
        date-format="yy-mm-dd"
        show-icon
        icon-display="input"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.purchase_date.$error }"
        @blur="v$.purchase_date.$touch()"
      />
      <small v-if="v$.purchase_date.$error" class="p-error">{{ errorMsg('purchase_date') }}</small>
    </div>
    <div class="field">
      <label for="a-status">الحالة <span class="text-red-500">*</span></label>
      <Select
        id="a-status"
        v-model="form.status"
        :options="ASSET_STATUS_OPTIONS"
        option-label="label"
        option-value="value"
        placeholder="الحالة"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.status.$error }"
        @blur="v$.status.$touch()"
      />
      <small v-if="v$.status.$error" class="p-error">{{ errorMsg('status') }}</small>
    </div>
    <div class="field">
      <label for="a-loc">الموقع</label>
      <InputText
        id="a-loc"
        v-model="form.location"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.location?.$error }"
        placeholder="الموقع"
        maxlength="255"
        @blur="v$.location?.$touch()"
      />
      <small v-if="v$.location?.$error" class="p-error">{{ errorMsg('location') }}</small>
    </div>
    <div class="field">
      <label for="a-notes">ملاحظات</label>
      <Textarea
        id="a-notes"
        v-model="form.notes"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.notes?.$error }"
        placeholder="ملاحظات"
        rows="3"
        @blur="v$.notes?.$touch()"
      />
      <small v-if="v$.notes?.$error" class="p-error">{{ errorMsg('notes') }}</small>
    </div>
    <div class="flex justify-content-end gap-2 mt-2">
      <Button type="button" label="إلغاء" text @click="onCancel" />
      <Button type="submit" label="حفظ" icon="pi pi-check" :loading="loading" :disabled="invalid" />
    </div>
  </form>
</template>
