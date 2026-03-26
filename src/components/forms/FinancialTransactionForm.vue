<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { required } from '@vuelidate/validators'
import { formatDateLocal } from '@/lib/date'
import { MANUAL_EXPENSE_TYPE_OPTIONS } from '@/lib/expenseTypes'
import { MANUAL_INCOME_TYPE_OPTIONS } from '@/lib/incomeTypes'
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
  /** When set (صفحة إيرادات/مصروفات), نوع المعاملة ثابت ولا يُعرض حقل النوع */
  lockedType?: 'income' | 'expense' | null
}>()

const emit = defineEmits<{
  submit: [
    payload:
      | {
          financial_account_id: number
          type: 'income' | 'expense'
          amount: number
          date: string
          description?: string
          expense_type?: string
          income_type?: string
        }
      | {
          type: 'income' | 'expense'
          amount: number
          date: string
          description?: string
          expense_type?: string
          income_type?: string
        },
  ]
  cancel: []
}>()

const today = formatDateLocal(new Date())

const form = reactive({
  financial_account_id: props.modelValue?.financial_account_id ?? null as number | null,
  type: (props.modelValue?.type ?? props.lockedType ?? 'income') as 'income' | 'expense',
  amount: props.modelValue?.amount ?? 0,
  date: props.modelValue?.date ?? today,
  description: props.modelValue?.description ?? '',
  /** Manual expense categories only; ignored when type is income. */
  expense_type: (props.modelValue?.expense_type as string | undefined) ?? 'other',
  /** Manual income categories only; ignored when type is expense. */
  income_type: (props.modelValue?.income_type as string | undefined) ?? 'other',
})

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.financial_account_id = v.financial_account_id ?? null
      form.type = (v.type ?? props.lockedType ?? 'income') as 'income' | 'expense'
      form.amount = v.amount ?? 0
      form.date = v.date ?? today
      form.description = v.description ?? ''
      form.expense_type =
        v.type === 'expense' && v.expense_type ? String(v.expense_type) : 'other'
      form.income_type =
        v.type === 'income' && v.income_type ? String(v.income_type) : 'other'
    }
  },
  { immediate: true },
)

watch(
  () => props.lockedType,
  (lt) => {
    if (lt) form.type = lt
  },
  { immediate: true },
)

watch(
  () => form.type,
  (t) => {
    if (t === 'expense' && !form.expense_type) form.expense_type = 'other'
    if (t === 'income' && !form.income_type) form.income_type = 'other'
  },
)

const isExpenseEntry = computed(
  () => props.lockedType === 'expense' || (!props.lockedType && form.type === 'expense'),
)

const isIncomeEntry = computed(
  () => props.lockedType === 'income' || (!props.lockedType && form.type === 'income'),
)

const rules = computed(() => ({
  ...financialTransactionRules,
  expense_type: isExpenseEntry.value ? { required } : {},
  income_type: isIncomeEntry.value ? { required } : {},
}))
const v$ = useVuelidate(rules, form)

const datePickerValue = computed({
  get: () => (form.date ? new Date(form.date + 'T12:00:00') : null),
  set: (v: Date | null) => {
    form.date = v ? formatDateLocal(v) : today
  },
})

const invalid = computed(() =>
  props.isEdit
    ? !!(
        v$.value.amount?.$invalid ||
        v$.value.date?.$invalid ||
        v$.value.description?.$invalid ||
        (!props.lockedType && v$.value.type?.$invalid) ||
        (isExpenseEntry.value && v$.value.expense_type?.$invalid) ||
        (isIncomeEntry.value && v$.value.income_type?.$invalid)
      )
    : v$.value.$invalid,
)

async function onSubmit() {
  v$.value.$touch()
  const effectiveType = props.lockedType ?? form.type
  if (props.isEdit) {
    if (
      v$.value.amount?.$invalid ||
      v$.value.date?.$invalid ||
      v$.value.description?.$invalid ||
      (!props.lockedType && v$.value.type?.$invalid) ||
      (isExpenseEntry.value && v$.value.expense_type?.$invalid) ||
      (isIncomeEntry.value && v$.value.income_type?.$invalid)
    )
      return
    emit('submit', {
      type: effectiveType,
      amount: form.amount,
      date: form.date,
      description: form.description?.trim() || undefined,
      ...(effectiveType === 'expense' ? { expense_type: form.expense_type } : {}),
      ...(effectiveType === 'income' ? { income_type: form.income_type } : {}),
    })
  } else {
    if (v$.value.$invalid) return
    if (!form.financial_account_id) return
    emit('submit', {
      financial_account_id: form.financial_account_id,
      type: effectiveType,
      amount: form.amount,
      date: form.date,
      description: form.description?.trim() || undefined,
      ...(effectiveType === 'expense' ? { expense_type: form.expense_type } : {}),
      ...(effectiveType === 'income' ? { income_type: form.income_type } : {}),
    })
  }
}

const showTypeField = computed(() => !props.lockedType)

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
    <div v-if="showTypeField" class="field">
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
    <div v-if="isExpenseEntry" class="field">
      <label for="ft-expense-type">نوع المصروف <span class="text-red-500">*</span></label>
      <Select
        id="ft-expense-type"
        v-model="form.expense_type"
        :options="[...MANUAL_EXPENSE_TYPE_OPTIONS]"
        option-label="label"
        option-value="value"
        placeholder="اختر التصنيف"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.expense_type.$error }"
        @blur="v$.expense_type.$touch()"
      />
      <small v-if="v$.expense_type.$error" class="p-error">{{ errorMsg('expense_type') }}</small>
    </div>
    <div v-if="isIncomeEntry" class="field">
      <label for="ft-income-type">نوع الإيراد <span class="text-red-500">*</span></label>
      <Select
        id="ft-income-type"
        v-model="form.income_type"
        :options="[...MANUAL_INCOME_TYPE_OPTIONS]"
        option-label="label"
        option-value="value"
        placeholder="اختر التصنيف"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.income_type.$error }"
        @blur="v$.income_type.$touch()"
      />
      <small v-if="v$.income_type.$error" class="p-error">{{ errorMsg('income_type') }}</small>
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
