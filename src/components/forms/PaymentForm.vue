<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { formatDateLocal } from '@/lib/date'
import type { PaymentPayload } from '@/types'

const props = defineProps<{
  modelValue?: Partial<PaymentPayload> | null
  accountOptions: { label: string; value: number }[]
  loading?: boolean
  maxAmount?: number
  isEdit?: boolean
  /** When true, allow paying part from customer balance (sale invoices). */
  allowBalanceSplit?: boolean
  /** Available customer balance for the sale payment. */
  customerBalance?: number
}>()

const emit = defineEmits<{
  submit: [payload: PaymentPayload]
  cancel: []
}>()

const today = formatDateLocal(new Date())

const form = reactive({
  amount: props.modelValue?.amount ?? 0,
  balance_amount: props.modelValue?.balance_amount ?? 0,
  date: props.modelValue?.date ?? today,
  financial_account_id: props.modelValue?.financial_account_id ?? (props.accountOptions[0]?.value ?? null) as
    | number
    | null,
  description: props.modelValue?.description ?? '',
})

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.amount = v.amount ?? 0
      form.balance_amount = v.balance_amount ?? 0
      form.date = v.date ?? today
      form.financial_account_id = v.financial_account_id ?? (props.accountOptions[0]?.value ?? null)
      form.description = v.description ?? ''
    }
  },
  { immediate: true },
)

const datePickerValue = computed({
  get: () => (form.date ? new Date(form.date + 'T12:00:00') : null),
  set: (v: Date | null) => {
    form.date = v ? formatDateLocal(v) : today
  },
})

/** Portion of customer balance that can be applied to this invoice (prepaid only; ≤ 0 if they owe). */
const balanceApplyCap = computed(() =>
  props.allowBalanceSplit ? Math.max(0, props.customerBalance ?? 0) : 0,
)

const maxBalancePortion = computed(() => {
  if (!props.allowBalanceSplit || props.isEdit) return 0
  const cap = props.maxAmount ?? Infinity
  return Math.min(balanceApplyCap.value, cap)
})

watch(
  () => [props.customerBalance, props.allowBalanceSplit, props.maxAmount, props.isEdit] as const,
  () => {
    if (!props.allowBalanceSplit || props.isEdit) return
    const cap = maxBalancePortion.value
    if ((form.balance_amount ?? 0) > cap + 0.0001) {
      form.balance_amount = cap
    }
  },
)

const cashAmount = computed(() => Math.max(0, form.amount - (form.balance_amount ?? 0)))

const remainingHint = computed(() => {
  if (props.maxAmount == null || props.maxAmount <= 0) return ''
  return `المتبقي على الفاتورة: ${props.maxAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}`
})

const canSubmit = computed(() => {
  if (form.amount <= 0) return false
  if (props.maxAmount != null && form.amount > props.maxAmount + 0.0001) return false

  if (props.isEdit) {
    return !!form.financial_account_id
  }

  if (props.allowBalanceSplit) {
    const bal = form.balance_amount ?? 0
    if (bal < 0) return false
    if (bal > balanceApplyCap.value + 0.0001) return false
    if (bal > form.amount + 0.0001) return false
    const cash = form.amount - bal
    if (cash > 0.0001 && !form.financial_account_id) return false
    return true
  }

  return !!form.financial_account_id
})

function onSubmit() {
  if (!canSubmit.value) return

  if (props.isEdit) {
    if (!form.financial_account_id) return
    emit('submit', {
      amount: form.amount,
      date: form.date,
      financial_account_id: form.financial_account_id,
      description: form.description?.trim() || undefined,
    })
    return
  }

  if (props.allowBalanceSplit) {
    const bal = Math.min(form.balance_amount ?? 0, form.amount, maxBalancePortion.value)
    const cash = form.amount - bal
    emit('submit', {
      amount: form.amount,
      balance_amount: bal,
      date: form.date,
      financial_account_id: cash > 0.0001 ? form.financial_account_id ?? undefined : undefined,
      description: form.description?.trim() || undefined,
    })
    return
  }

  if (!form.financial_account_id) return
  emit('submit', {
    amount: form.amount,
    date: form.date,
    financial_account_id: form.financial_account_id,
    description: form.description?.trim() || undefined,
  })
}

function onCancel() {
  emit('cancel')
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="flex flex-column gap-3">
    <div class="field">
      <label for="pay-amount">المبلغ <span class="text-red-500">*</span></label>
      <InputNumber
        id="pay-amount"
        v-model="form.amount"
        :min="0.01"
        :max="maxAmount"
        :min-fraction-digits="0"
        :max-fraction-digits="4"
        class="w-full mt-1"
      />
      <small v-if="remainingHint" class="text-color-secondary">{{ remainingHint }}</small>
    </div>

    <template v-if="allowBalanceSplit && !isEdit">
      <div class="field">
        <label for="pay-balance">من رصيد العميل</label>
        <InputNumber
          id="pay-balance"
          v-model="form.balance_amount"
          :min="0"
          :max="maxBalancePortion"
          :min-fraction-digits="0"
          :max-fraction-digits="4"
          class="w-full mt-1"
        />
        <small class="text-color-secondary">
          يمكن خصمه من الرصيد:
          {{ balanceApplyCap.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
        </small>
      </div>
      <div v-if="cashAmount > 0.0001" class="text-sm text-color-secondary">
        النقدي (حساب مالي):
        {{ cashAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
      </div>
      <div v-else class="text-sm text-color-secondary">الدفعة بالكامل من الرصيد (لا يُسجّل نقدي)</div>
    </template>

    <div class="field">
      <label for="pay-date">التاريخ <span class="text-red-500">*</span></label>
      <DatePicker
        id="pay-date"
        v-model="datePickerValue"
        date-format="yy-mm-dd"
        show-icon
        icon-display="input"
        class="w-full mt-1"
      />
    </div>
    <div v-if="!allowBalanceSplit || isEdit || cashAmount > 0.0001" class="field">
      <label for="pay-account"
        >الحساب المالي
        <span v-if="!allowBalanceSplit || isEdit || cashAmount > 0.0001" class="text-red-500">*</span></label
      >
      <Select
        id="pay-account"
        v-model="form.financial_account_id"
        :options="accountOptions"
        option-label="label"
        option-value="value"
        placeholder="اختر الحساب"
        class="w-full mt-1"
      />
    </div>
    <div class="field">
      <label for="pay-desc">الوصف</label>
      <Textarea
        id="pay-desc"
        v-model="form.description"
        class="w-full mt-1"
        placeholder="وصف الدفعة"
        rows="2"
      />
    </div>
    <div class="flex justify-content-end gap-2 mt-2">
      <Button type="button" label="إلغاء" text @click="onCancel" />
      <Button type="submit" label="حفظ" icon="pi pi-check" :loading="loading" :disabled="!canSubmit" />
    </div>
  </form>
</template>
