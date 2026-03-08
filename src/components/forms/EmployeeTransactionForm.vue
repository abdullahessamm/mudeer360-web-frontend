<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { formatDateLocal } from '@/lib/date'
import { employeeTransactionRules } from '@/validations/schemas'
import type { EmployeeTransaction } from '@/types'

const props = defineProps<{
  modelValue?: Partial<EmployeeTransaction> | null
  employeeOptions: { label: string; value: number }[]
  accountOptions: { label: string; value: number }[]
  loading?: boolean
  /** When set, employee is fixed (e.g. from detail page) */
  fixedEmployeeId?: number | null
}>()

const emit = defineEmits<{
  submit: [
    payload: {
      employee_id: number
      type: 'bonus' | 'deduction' | 'loan'
      amount: number
      date: string
      description?: string
      financial_account_id?: number
    },
  ]
  cancel: []
}>()

const today = formatDateLocal(new Date())

const form = reactive({
  employee_id: props.modelValue?.employee_id ?? (props.fixedEmployeeId ?? null) as number | null,
  type: (props.modelValue?.type ?? 'bonus') as 'bonus' | 'deduction' | 'loan',
  amount: props.modelValue?.amount ?? 0,
  date: today, // always current date (frozen)
  description: props.modelValue?.description ?? '',
  financial_account_id: null as number | null,
})

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.employee_id = v.employee_id ?? props.fixedEmployeeId ?? null
      form.type = (v.type ?? 'bonus') as 'bonus' | 'deduction' | 'loan'
      form.amount = v.amount ?? 0
      form.description = v.description ?? ''
      // date stays frozen to current
    }
  },
  { immediate: true },
)

watch(
  () => props.fixedEmployeeId,
  (id) => {
    if (id != null) form.employee_id = id
  },
  { immediate: true },
)

const rules = employeeTransactionRules
const v$ = useVuelidate(rules, form)

/** Date is always current date (frozen) */
const currentDateDisplay = computed(() => formatDateLocal(new Date()))

const showFinancialAccount = computed(() => form.type === 'loan')

const invalid = computed(() => {
  if (v$.value.$invalid) return true
  if (form.type === 'loan' && !form.financial_account_id) return true
  return false
})

async function onSubmit() {
  v$.value.$touch()
  if (v$.value.$invalid) return
  if (form.type === 'loan' && !form.financial_account_id) return
  if (!form.employee_id) return
  emit('submit', {
    employee_id: form.employee_id,
    type: form.type,
    amount: Number(form.amount),
    date: formatDateLocal(new Date()),
    description: form.description?.trim() || undefined,
    financial_account_id: form.type === 'loan' ? form.financial_account_id ?? undefined : undefined,
  })
}

function onCancel() {
  v$.value.$reset()
  emit('cancel')
}

function errorMsg(field: keyof typeof form) {
  const f = v$.value[field]
  if (!f?.$error) return ''
  if (f.required?.$invalid || f.requiredIf?.$invalid) return 'الحقل مطلوب'
  if (f.maxLength?.$invalid) return `الحد الأقصى ${f.maxLength.$params.max} حرف`
  if (f.minValue?.$invalid) return `الحد الأدنى ${f.minValue.$params.min}`
  if (f.numeric?.$invalid) return 'يجب أن يكون رقماً'
  return ''
}

const typeOptions = [
  { label: 'مكافأة', value: 'bonus' },
  { label: 'خصم', value: 'deduction' },
  { label: 'سلفة', value: 'loan' },
]
</script>

<template>
  <form @submit.prevent="onSubmit" class="flex flex-column gap-3">
    <div v-if="!fixedEmployeeId" class="field">
      <label for="et-employee">الموظف <span class="text-red-500">*</span></label>
      <Select
        id="et-employee"
        v-model="form.employee_id"
        :options="employeeOptions"
        option-label="label"
        option-value="value"
        placeholder="اختر الموظف"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.employee_id.$error }"
        @blur="v$.employee_id.$touch()"
      />
      <small v-if="v$.employee_id.$error" class="p-error">{{ errorMsg('employee_id') }}</small>
    </div>
    <div class="field">
      <label for="et-type">النوع <span class="text-red-500">*</span></label>
      <Select
        id="et-type"
        v-model="form.type"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.type.$error }"
        @blur="v$.type.$touch()"
      />
      <small v-if="v$.type.$error" class="p-error">{{ errorMsg('type') }}</small>
    </div>
    <div v-if="showFinancialAccount" class="field">
      <label for="et-account">الحساب المالي <span class="text-red-500">*</span></label>
      <Select
        id="et-account"
        v-model="form.financial_account_id"
        :options="accountOptions"
        option-label="label"
        option-value="value"
        placeholder="اختر الحساب (مطلوب للسلفة)"
        class="w-full mt-1"
        :class="{ 'p-invalid': form.type === 'loan' && !form.financial_account_id }"
        @blur="v$.financial_account_id?.$touch?.()"
      />
      <small v-if="form.type === 'loan' && !form.financial_account_id" class="p-error">
        الحساب مطلوب عند اختيار سلفة
      </small>
    </div>
    <div class="field">
      <label for="et-amount">المبلغ <span class="text-red-500">*</span></label>
      <InputNumber
        id="et-amount"
        v-model="form.amount"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.amount.$error }"
        :min="0.01"
        :min-fraction-digits="0"
        :max-fraction-digits="4"
        @blur="v$.amount.$touch()"
      />
      <small v-if="v$.amount.$error" class="p-error">{{ errorMsg('amount') }}</small>
    </div>
    <div class="field">
      <label for="et-date">التاريخ</label>
      <InputText
        id="et-date"
        :model-value="currentDateDisplay"
        class="w-full mt-1"
        disabled
      />
    </div>
    <div class="field">
      <label for="et-desc">الوصف</label>
      <Textarea
        id="et-desc"
        v-model="form.description"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.description?.$error }"
        placeholder="وصف المعاملة"
        rows="3"
        @blur="v$.description?.$touch?.()"
      />
      <small v-if="v$.description?.$error" class="p-error">{{ errorMsg('description') }}</small>
    </div>
    <div class="flex justify-content-end gap-2 mt-2">
      <Button type="button" label="إلغاء" text @click="onCancel" />
      <Button type="submit" label="حفظ" icon="pi pi-check" :loading="loading" :disabled="invalid" />
    </div>
  </form>
</template>
