<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { formatDateLocal } from '@/lib/date'
import { financialTransactionRules } from '@/validations/schemas'
import type { FinancialTransaction } from '@/types'

const props = defineProps<{
  modelValue?: Partial<FinancialTransaction> | null
  accountOptions: { label: string; value: number }[]
  loading?: boolean
  /** Edit mode: account shown read-only; only type/amount/date/description editable */
  isEdit?: boolean
  /** Account label for edit mode (e.g. transaction.account?.name) */
  accountLabel?: string
}>()

const emit = defineEmits<{
  submit: [
    payload:
      | { financial_account_id: number; type: 'income' | 'expense'; amount: number; date: string; description?: string }
      | { type: 'income' | 'expense'; amount: number; date: string; description?: string },
  ]
  cancel: []
}>()

const today = formatDateLocal(new Date())

const form = reactive({
  financial_account_id: props.modelValue?.financial_account_id ?? null as number | null,
  type: (props.modelValue?.type ?? 'income') as 'income' | 'expense',
  amount: props.modelValue?.amount ?? 0,
  date: props.modelValue?.date ?? today,
  description: props.modelValue?.description ?? '',
})

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.financial_account_id = v.financial_account_id ?? null
      form.type = (v.type ?? 'income') as 'income' | 'expense'
      form.amount = v.amount ?? 0
      form.date = v.date ?? today
      form.description = v.description ?? ''
    }
  },
  { immediate: true },
)

const rules = financialTransactionRules
const v$ = useVuelidate(rules, form)

const datePickerValue = computed({
  get: () => (form.date ? new Date(form.date + 'T12:00:00') : null),
  set: (v: Date | null) => {
    form.date = v ? formatDateLocal(v) : today
  },
})

const invalid = computed(() =>
  props.isEdit
    ? !!(v$.value.type?.$invalid || v$.value.amount?.$invalid || v$.value.date?.$invalid || v$.value.description?.$invalid)
    : v$.value.$invalid,
)

async function onSubmit() {
  v$.value.$touch()
  if (props.isEdit) {
    if (v$.value.type?.$invalid || v$.value.amount?.$invalid || v$.value.date?.$invalid || v$.value.description?.$invalid) return
    emit('submit', {
      type: form.type,
      amount: form.amount,
      date: form.date,
      description: form.description?.trim() || undefined,
    })
  } else {
    if (v$.value.$invalid) return
    if (!form.financial_account_id) return
    emit('submit', {
      financial_account_id: form.financial_account_id,
      type: form.type,
      amount: form.amount,
      date: form.date,
      description: form.description?.trim() || undefined,
    })
  }
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
    <div v-if="!isEdit" class="field">
      <label for="ft-account">الحساب <span class="text-red-500">*</span></label>
      <Select
        id="ft-account"
        v-model="form.financial_account_id"
        :options="accountOptions"
        option-label="label"
        option-value="value"
        placeholder="اختر الحساب"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.financial_account_id.$error }"
        @blur="v$.financial_account_id.$touch()"
      />
      <small v-if="v$.financial_account_id.$error" class="p-error">{{ errorMsg('financial_account_id') }}</small>
    </div>
    <div v-else class="field">
      <label>الحساب</label>
      <InputText :model-value="accountLabel ?? accountOptions.find((a) => a.value === form.financial_account_id)?.label ?? '—'" class="w-full mt-1" disabled />
    </div>
    <div class="field">
      <label for="ft-type">النوع <span class="text-red-500">*</span></label>
      <Select
        id="ft-type"
        v-model="form.type"
        :options="[
          { label: 'إيراد', value: 'income' },
          { label: 'مصروف', value: 'expense' },
        ]"
        option-label="label"
        option-value="value"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.type.$error }"
        @blur="v$.type.$touch()"
      />
      <small v-if="v$.type.$error" class="p-error">{{ errorMsg('type') }}</small>
    </div>
    <div class="field">
      <label for="ft-amount">المبلغ <span class="text-red-500">*</span></label>
      <InputNumber
        id="ft-amount"
        v-model="form.amount"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.amount.$error }"
        :min="0"
        :min-fraction-digits="0"
        :max-fraction-digits="4"
        @blur="v$.amount.$touch()"
      />
      <small v-if="v$.amount.$error" class="p-error">{{ errorMsg('amount') }}</small>
    </div>
    <div class="field">
      <label for="ft-date">التاريخ <span class="text-red-500">*</span></label>
      <DatePicker
        id="ft-date"
        v-model="datePickerValue"
        date-format="yy-mm-dd"
        show-icon
        icon-display="input"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.date.$error }"
        @blur="v$.date.$touch()"
      />
      <small v-if="v$.date.$error" class="p-error">{{ errorMsg('date') }}</small>
    </div>
    <div class="field">
      <label for="ft-desc">الوصف <span class="text-red-500">*</span></label>
      <Textarea
        id="ft-desc"
        v-model="form.description"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.description.$error }"
        placeholder="وصف المعاملة"
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
