<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { productCategoryRules } from '@/validations/schemas'
import type { ProductCategory } from '@/types'

const props = defineProps<{
  modelValue?: Partial<ProductCategory> | null
}>()

const emit = defineEmits<{
  submit: [payload: { name: string }]
  cancel: []
}>()

const form = reactive({
  name: props.modelValue?.name ?? '',
})

watch(
  () => props.modelValue,
  (v) => {
    form.name = v?.name ?? ''
  },
  { immediate: true },
)

const rules = productCategoryRules
const v$ = useVuelidate(rules, form)

const invalid = computed(() => v$.value.$invalid)

async function onSubmit() {
  v$.value.$touch()
  if (v$.value.$invalid) return
  emit('submit', { name: form.name.trim() })
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
  <form @submit.prevent="onSubmit" class="flex flex-column gap-3">
    <div class="field">
      <label for="cat-name">الاسم <span class="text-red-500">*</span></label>
      <InputText
        id="cat-name"
        v-model="form.name"
        class="w-full mt-1"
        :class="{ 'p-invalid': v$.name.$error }"
        placeholder="اسم الفئة"
        @blur="v$.name.$touch()"
      />
      <small v-if="v$.name.$error" class="p-error">{{ errorMsg('name') }}</small>
    </div>
    <div class="flex justify-content-end gap-2 mt-2">
      <Button type="button" label="إلغاء" text @click="onCancel" />
      <Button type="submit" label="حفظ" icon="pi pi-check" :disabled="invalid" />
    </div>
  </form>
</template>
