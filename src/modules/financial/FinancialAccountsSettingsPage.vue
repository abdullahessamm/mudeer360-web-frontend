<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { showError, showSuccess } from '@/composables/useToast'
import { formatDateOnly } from '@/lib/date'
import { financialAccountTypeLabel } from '@/lib/financialAccountTypes'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'
import FinancialAccountForm from '@/components/forms/FinancialAccountForm.vue'
import type { FinancialAccount } from '@/types'

const confirm = useConfirm()
const store = useFinancialAccountsStore()

watch(
  () => store.error,
  (err) => {
    if (err) {
      showError(err)
      store.clearError()
    }
  },
)

const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formModel = ref<Partial<FinancialAccount> | null>(null)

const formTitle = computed(() => (isEdit.value ? 'تعديل الحساب' : 'إضافة حساب مالي'))

const deleteBlockedHint =
  'لا يمكن حذف الحساب ما دام رصيده لا يساوي صفراً (بعد التسوية أو التصحيح).'

function accountBalance(row: FinancialAccount): number {
  return Number(row.computed_balance ?? 0)
}

function canDeleteAccount(row: FinancialAccount): boolean {
  return accountBalance(row) === 0
}

function openCreate() {
  isEdit.value = false
  editingId.value = null
  formModel.value = { name: '', type: undefined }
  dialogVisible.value = true
}

function openEdit(row: FinancialAccount) {
  isEdit.value = true
  editingId.value = row.id
  formModel.value = { name: row.name, type: row.type ?? undefined }
  dialogVisible.value = true
}

async function onFormSubmit(payload: { name: string; type?: string | null }) {
  try {
    if (isEdit.value && editingId.value !== null) {
      await store.update(editingId.value, payload)
      showSuccess('تم تحديث الحساب بنجاح')
    } else {
      await store.create(payload)
      showSuccess('تم إضافة الحساب بنجاح')
    }
    dialogVisible.value = false
    await store.fetchAll()
  } catch {
    // toast via store.error
  }
}

function onFormCancel() {
  dialogVisible.value = false
}

function confirmDelete(row: FinancialAccount) {
  if (!canDeleteAccount(row)) {
    showError(deleteBlockedHint)
    return
  }
  confirm.require({
    message: `حذف الحساب «${row.name}»؟ قد يؤثر ذلك على المعاملات المرتبطة.`,
    header: 'تأكيد الحذف',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'إلغاء',
    acceptLabel: 'حذف',
    acceptClass: 'p-button-danger p-button-sm',
    rejectClass: 'p-button-text p-button-secondary p-button-sm',
    acceptIcon: 'pi pi-trash',
    accept: async () => {
      try {
        await store.remove(row.id)
        showSuccess('تم حذف الحساب')
        await store.fetchAll()
      } catch {
        // toast via store
      }
    },
  })
}

onMounted(() => {
  store.fetchAll()
})
</script>

<template>
  <div dir="rtl">
    <div class="flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <p class="text-color-secondary m-0 max-w-30rem">
        إدارة الحسابات النقدية والبنكية المستخدمة في الإيرادات والمصروفات وسجل المعاملات.
      </p>
      <Button label="إضافة حساب" icon="pi pi-plus" @click="openCreate" />
    </div>

    <Card>
      <template #content>
        <div v-if="store.loading" class="flex justify-content-center align-items-center py-8">
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>
        <div
          v-else-if="store.items.length === 0"
          class="flex flex-column align-items-center justify-content-center py-8 gap-3"
        >
          <i class="pi pi-building-columns text-6xl text-color-secondary"></i>
          <p class="text-color-secondary m-0">لا توجد حسابات بعد</p>
          <Button label="إضافة حساب" icon="pi pi-plus" @click="openCreate" />
        </div>
        <DataTable v-else :value="store.items" data-key="id" striped-rows responsive-layout="scroll">
          <Column field="name" header="اسم الحساب" />
          <Column field="type" header="النوع">
            <template #body="{ data }">{{ financialAccountTypeLabel(data.type) }}</template>
          </Column>
          <Column field="computed_balance" header="الرصيد">
            <template #body="{ data }">
              <span
                :class="[
                  'font-semibold',
                  (data.computed_balance ?? 0) >= 0 ? 'text-green-600' : 'text-red-600',
                ]"
              >
                {{
                  (data.computed_balance ?? 0).toLocaleString('ar-EG', {
                    minimumFractionDigits: 2,
                  })
                }}
              </span>
            </template>
          </Column>
          <Column field="created_at" header="تاريخ الإنشاء">
            <template #body="{ data }">{{ formatDateOnly(data.created_at) || '—' }}</template>
          </Column>
          <Column header="الإجراءات" style="width: 160px">
            <template #body="{ data }">
              <Button
                label="تعديل"
                icon="pi pi-pencil"
                text
                size="small"
                class="p-button-success"
                @click="openEdit(data)"
              />
              <Button
                label="حذف"
                icon="pi pi-trash"
                text
                size="small"
                class="p-button-danger"
                :disabled="!canDeleteAccount(data)"
                :title="canDeleteAccount(data) ? '' : deleteBlockedHint"
                @click="confirmDelete(data)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog
      v-model:visible="dialogVisible"
      :header="formTitle"
      :modal="true"
      :style="{ width: '420px' }"
      @hide="dialogVisible = false"
    >
      <FinancialAccountForm
        v-if="dialogVisible"
        :model-value="formModel"
        :loading="store.loading"
        @submit="onFormSubmit"
        @cancel="onFormCancel"
      />
    </Dialog>
  </div>
</template>
