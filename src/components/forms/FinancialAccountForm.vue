<script setup lang="ts">
import { reactive, watch, computed } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { required, maxLength } from '@vuelidate/validators'
import { FINANCIAL_ACCOUNT_TYPE_OPTIONS } from '@/lib/financialAccountTypes'
import type { FinancialAccount } from '@/types'

const props = defineProps<{
  modelValue?: Partial<FinancialAccount> | null
  loading?: boolean
  isEdit?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: { name: string; type?: string | null; opening_balance?: number }]
  cancel: []
}>()

const form = reactive({
  name: '',
  type: null as string | null,
  opening_balance: 0,
})

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const typeSelectOptions = computed((): { label: string; value: string | null }[] => {
  const base: { label: string; value: string }[] = FINANCIAL_ACCOUNT_TYPE_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }))
  const cur = props.modelValue?.type
  if (cur && !base.some((o) => o.value === cur)) {
    base.unshift({ value: cur, label: cur })
  }
  return [{ label: 'بدون تحديد', value: null }, ...base]
})

function normalizeType(t: string | undefined | null): string | null {
  if (t == null || t === '') return null
  const k = t.trim().toLowerCase()
  const known = FINANCIAL_ACCOUNT_TYPE_OPTIONS.some((o) => o.value === k)
  return known ? k : t.trim()
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.name = v.name ?? ''
      form.type = normalizeType(v.type)
      form.opening_balance = num(v.opening_balance)
    }
  },
  { immediate: true },
)

const rules = {
  name: { required, maxLength: maxLength(255) },
  type: { maxLength: maxLength(100) },
}
const v$ = useVuelidate(rules, form)

const invalid = computed(() => v$.value.$invalid)

async function onSubmit() {
  v$.value.$touch()
  if (v$.value.$invalid) return
  emit('submit', {
    name: form.name.trim(),
    type: form.type ?? null,
    opening_balance: num(form.opening_balance),
  })
}

function onCancel() {
  v$.value.$reset()
  emit('cancel')
}

function errorMsg(field: 'name' | 'type') {
  const f = v$.value[field]
  if (!f?.$error) return ''
  if (f.required?.$invalid) return 'الحقل مطلوب'
  if (f.maxLength?.$invalid) return `الحد الأقصى ${f.maxLength.$params.max} حرف`
  return ''
}
</script>

<template>
  <form class="flex flex-column gap-3" @submit.prevent="onSubmit">
    <div class="field">
      <label for="fa-name">اسم الحساب <span class="text-red-500">*</span></label>
      <InputText
        id="fa-name"
        v-model="form.name"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.name.$error }"
        placeholder="مثال: الصندوق الرئيسي"
        @blur="v$.name.$touch()"
      />
      <small v-if="v$.name.$error" class="p-error">{{ errorMsg('name') }}</small>
    </div>
    <div class="field">
      <label for="fa-type">نوع الحساب</label>
      <Select
        id="fa-type"
        v-model="form.type"
        :options="typeSelectOptions"
        option-label="label"
        option-value="value"
        placeholder="اختر نوع الحساب"
        show-clear
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.type.$error }"
        @blur="v$.type.$touch()"
      />
      <small v-if="v$.type.$error" class="p-error">{{ errorMsg('type') }}</small>
    </div>
    <div class="field">
      <label for="fa-opening">الرصيد الافتتاحي</label>
      <InputNumber
        id="fa-opening"
        v-model="form.opening_balance"
        class="w-full mt-1"
        :min-fraction-digits="0"
        :max-fraction-digits="2"
        locale="en-US"
      />
      <small class="text-color-secondary text-sm">
        يُضاف إلى حركة الحساب في التقارير ويُسجَّل قيداً مزدوجاً (نقدية / حقوق ملكية).
      </small>
    </div>
    <div class="flex justify-content-end gap-2 mt-2">
      <Button type="button" label="إلغاء" text @click="onCancel" />
      <Button type="submit" label="حفظ" icon="pi pi-check" :loading="loading" :disabled="invalid" />
    </div>
  </form>
</template>
