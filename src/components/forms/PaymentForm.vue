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
}>()

const emit = defineEmits<{
  submit: [payload: PaymentPayload]
  cancel: []
}>()

const today = formatDateLocal(new Date())

const form = reactive({
  amount: props.modelValue?.amount ?? 0,
  date: props.modelValue?.date ?? today,
  financial_account_id: props.modelValue?.financial_account_id ?? (props.accountOptions[0]?.value ?? null) as number | null,
  description: props.modelValue?.description ?? '',
})

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.amount = v.amount ?? 0
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

const remainingHint = computed(() => {
  if (props.maxAmount == null || props.maxAmount <= 0) return ''
  return `المتبقي: ${props.maxAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}`
})

const canSubmit = computed(() => {
  if (form.amount <= 0 || !form.financial_account_id) return false
  if (props.maxAmount != null && form.amount > props.maxAmount) return false
  return true
})

function onSubmit() {
  if (!canSubmit.value || !form.financial_account_id) return
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
    <div class="field">
      <label for="pay-account">الحساب المالي <span class="text-red-500">*</span></label>
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
