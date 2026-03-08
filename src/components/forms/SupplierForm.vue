<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { supplierRules } from '@/validations/schemas'
import type { Supplier } from '@/types'

const props = defineProps<{
  modelValue?: Partial<Supplier> | null
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: Partial<Supplier>]
  cancel: []
}>()

const form = reactive({
  name: props.modelValue?.name ?? '',
  phone: props.modelValue?.phone ?? '',
  email: props.modelValue?.email ?? '',
  address: props.modelValue?.address ?? '',
  notes: props.modelValue?.notes ?? '',
})

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.name = v.name ?? ''
      form.phone = v.phone ?? ''
      form.email = v.email ?? ''
      form.address = v.address ?? ''
      form.notes = v.notes ?? ''
    }
  },
  { immediate: true },
)

const rules = supplierRules
const v$ = useVuelidate(rules, form)

const invalid = computed(() => v$.value.$invalid)

async function onSubmit() {
  v$.value.$touch()
  if (v$.value.$invalid) return
  emit('submit', {
    name: form.name.trim(),
    phone: form.phone?.trim() || undefined,
    email: form.email?.trim() || undefined,
    address: form.address?.trim() || undefined,
    notes: form.notes?.trim() || undefined,
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
  if (f.email?.$invalid || f.optionalEmail?.$invalid) return 'البريد الإلكتروني غير صالح'
  return ''
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="flex flex-column gap-3">
    <div class="field">
      <label for="s-name">الاسم <span class="text-red-500">*</span></label>
      <InputText
        id="s-name"
        v-model="form.name"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.name.$error }"
        placeholder="اسم المورد"
        @blur="v$.name.$touch()"
      />
      <small v-if="v$.name.$error" class="p-error">{{ errorMsg('name') }}</small>
    </div>
    <div class="field">
      <label for="s-phone">الهاتف</label>
      <InputText
        id="s-phone"
        v-model="form.phone"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.phone.$error }"
        placeholder="رقم الهاتف"
        @blur="v$.phone.$touch()"
      />
      <small v-if="v$.phone.$error" class="p-error">{{ errorMsg('phone') }}</small>
    </div>
    <div class="field">
      <label for="s-email">البريد الإلكتروني</label>
      <InputText
        id="s-email"
        v-model="form.email"
        type="email"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.email.$error }"
        placeholder="example@email.com"
        @blur="v$.email.$touch()"
      />
      <small v-if="v$.email.$error" class="p-error">{{ errorMsg('email') }}</small>
    </div>
    <div class="field">
      <label for="s-address">العنوان</label>
      <InputText
        id="s-address"
        v-model="form.address"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.address.$error }"
        placeholder="العنوان"
        @blur="v$.address.$touch()"
      />
      <small v-if="v$.address.$error" class="p-error">{{ errorMsg('address') }}</small>
    </div>
    <div class="field">
      <label for="s-notes">ملاحظات</label>
      <InputText
        id="s-notes"
        v-model="form.notes"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.notes.$error }"
        placeholder="ملاحظات إضافية"
        @blur="v$.notes.$touch()"
      />
      <small v-if="v$.notes.$error" class="p-error">{{ errorMsg('notes') }}</small>
    </div>
    <div class="flex justify-content-end gap-2 mt-2">
      <Button type="button" label="إلغاء" text @click="onCancel" />
      <Button type="submit" label="حفظ" icon="pi pi-check" :loading="loading" :disabled="invalid" />
    </div>
  </form>
</template>
