<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { employeeRules } from '@/validations/schemas'
import type { Employee } from '@/types'

const props = defineProps<{
  modelValue?: Partial<Employee> | null
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: { name: string; position?: string; salary: number }]
  cancel: []
}>()

const form = reactive({
  name: props.modelValue?.name ?? '',
  position: props.modelValue?.position ?? '',
  salary: props.modelValue?.salary ?? 0,
})

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.name = v.name ?? ''
      form.position = v.position ?? ''
      form.salary = v.salary ?? 0
    }
  },
  { immediate: true },
)

const rules = employeeRules
const v$ = useVuelidate(rules, form)

const invalid = computed(() => v$.value.$invalid)

async function onSubmit() {
  v$.value.$touch()
  if (v$.value.$invalid) return
  emit('submit', {
    name: form.name.trim(),
    position: form.position?.trim() || undefined,
    salary: Number(form.salary),
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
      <label for="e-name">الاسم <span class="text-red-500">*</span></label>
      <InputText
        id="e-name"
        v-model="form.name"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.name.$error }"
        placeholder="اسم الموظف"
        @blur="v$.name.$touch()"
      />
      <small v-if="v$.name.$error" class="p-error">{{ errorMsg('name') }}</small>
    </div>
    <div class="field">
      <label for="e-position">الوظيفة</label>
      <InputText
        id="e-position"
        v-model="form.position"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.position.$error }"
        placeholder="الوظيفة"
        @blur="v$.position.$touch()"
      />
      <small v-if="v$.position.$error" class="p-error">{{ errorMsg('position') }}</small>
    </div>
    <div class="field">
      <label for="e-salary">الراتب <span class="text-red-500">*</span></label>
      <InputNumber
        id="e-salary"
        v-model="form.salary"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.salary.$error }"
        :min="0"
        :min-fraction-digits="0"
        :max-fraction-digits="2"
        placeholder="0"
        @blur="v$.salary.$touch()"
      />
      <small v-if="v$.salary.$error" class="p-error">{{ errorMsg('salary') }}</small>
    </div>
    <div class="flex justify-content-end gap-2 mt-2">
      <Button type="button" label="إلغاء" text @click="onCancel" />
      <Button type="submit" label="حفظ" icon="pi pi-check" :loading="loading" :disabled="invalid" />
    </div>
  </form>
</template>
