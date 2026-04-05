<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { formatDateLocal } from '@/lib/date'
import { employeeAttendanceRules } from '@/validations/schemas'
import type { EmployeeAttendance } from '@/types'

const props = defineProps<{
  modelValue?: Partial<EmployeeAttendance> | null
  employeeOptions: { label: string; value: number }[]
  loading?: boolean
  isEdit?: boolean
  /** When set, employee is fixed (e.g. employee detail page) */
  fixedEmployeeId?: number | null
}>()

const emit = defineEmits<{
  submit: [
    payload: {
      employee_id: number
      work_date: string
      check_in: string | null
      check_out: string | null
      notes: string | null
    },
  ]
  cancel: []
}>()

function parseYMD(s: string): Date {
  const parts = s.slice(0, 10).split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  return new Date(y, m - 1, d)
}

const form = reactive({
  employee_id: null as number | null,
  work_date: null as Date | null,
  check_in: '' as string,
  check_out: '' as string,
  notes: '' as string,
})

watch(
  () => [props.modelValue, props.fixedEmployeeId] as const,
  ([v, fid]) => {
    if (fid != null) {
      form.employee_id = fid
    }
    if (v) {
      if (fid == null) form.employee_id = v.employee_id ?? null
      form.work_date = v.work_date ? parseYMD(v.work_date) : null
      form.check_in = v.check_in ?? ''
      form.check_out = v.check_out ?? ''
      form.notes = v.notes ?? ''
    } else if (fid == null) {
      form.employee_id = null
      form.work_date = null
      form.check_in = ''
      form.check_out = ''
      form.notes = ''
    } else {
      form.work_date = null
      form.check_in = ''
      form.check_out = ''
      form.notes = ''
    }
  },
  { immediate: true },
)

const rules = employeeAttendanceRules
const v$ = useVuelidate(rules, form)

function timeToPayload(s: string): string | null {
  const t = s?.trim()
  return t ? t.slice(0, 5) : null
}

async function onSubmit() {
  v$.value.$touch()
  if (v$.value.$invalid || !form.work_date) return
  const eid = props.fixedEmployeeId ?? form.employee_id
  if (eid == null) return
  emit('submit', {
    employee_id: eid,
    work_date: formatDateLocal(form.work_date),
    check_in: timeToPayload(form.check_in),
    check_out: timeToPayload(form.check_out),
    notes: form.notes?.trim() || null,
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
  return ''
}
</script>

<template>
  <form class="flex flex-column gap-3" @submit.prevent="onSubmit">
    <div v-if="fixedEmployeeId == null" class="field">
      <label for="ea-employee">الموظف <span class="text-red-500">*</span></label>
      <Select
        id="ea-employee"
        v-model="form.employee_id"
        :options="employeeOptions"
        option-label="label"
        option-value="value"
        placeholder="اختر الموظف"
        class="w-full mt-1"
        :disabled="isEdit"
        :class="{ 'p-invalid': v$.employee_id.$error }"
        @blur="v$.employee_id.$touch()"
      />
      <small v-if="v$.employee_id.$error" class="p-error">{{ errorMsg('employee_id') }}</small>
    </div>
    <div class="field">
      <label for="ea-date">يوم العمل <span class="text-red-500">*</span></label>
      <DatePicker
        id="ea-date"
        v-model="form.work_date"
        date-format="yy-mm-dd"
        show-icon
        :disabled="isEdit"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.work_date.$error }"
        @blur="v$.work_date.$touch()"
      />
      <small v-if="v$.work_date.$error" class="p-error">{{ errorMsg('work_date') }}</small>
    </div>
    <div class="flex gap-3 flex-wrap">
      <div class="field flex-1 min-w-10rem">
        <label for="ea-in">وقت الحضور</label>
        <InputText
          id="ea-in"
          v-model="form.check_in"
          type="time"
          class="w-full mt-1"
          step="60"
        />
      </div>
      <div class="field flex-1 min-w-10rem">
        <label for="ea-out">وقت الانصراف</label>
        <InputText
          id="ea-out"
          v-model="form.check_out"
          type="time"
          class="w-full mt-1"
          step="60"
        />
      </div>
    </div>
    <div class="field">
      <label for="ea-notes">ملاحظات</label>
      <Textarea
        id="ea-notes"
        v-model="form.notes"
        class="w-full mt-1"
        rows="2"
        :class="{ 'p-invalid': v$.notes.$error }"
        @blur="v$.notes.$touch()"
      />
      <small v-if="v$.notes.$error" class="p-error">{{ errorMsg('notes') }}</small>
    </div>
    <div class="flex justify-content-end gap-2">
      <Button label="إلغاء" type="button" text @click="onCancel" />
      <Button type="submit" label="حفظ" icon="pi pi-check" :loading="loading" />
    </div>
  </form>
</template>
