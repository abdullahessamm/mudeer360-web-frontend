<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import { useConfirm } from 'primevue/useconfirm'
import { showError, showSuccess } from '@/composables/useToast'
import { useFinancialTransactionsStore } from '@/stores/financialTransactions'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'
import FinancialTransactionForm from '@/components/forms/FinancialTransactionForm.vue'
import type { FinancialTransaction } from '@/types'

const confirm = useConfirm()
const store = useFinancialTransactionsStore()
const accountsStore = useFinancialAccountsStore()

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
const formModel = ref<Partial<FinancialTransaction> | null>(null)
const editingAccountLabel = ref<string>('')

const formTitle = computed(() => (isEdit.value ? 'تعديل المعاملة' : 'إضافة معاملة مالية'))

const accountOptions = computed(() =>
  accountsStore.items.map((a) => ({ label: a.name, value: a.id })),
)

const filters = ref({
  financial_account_id: null as number | null,
  type: null as 'income' | 'expense' | null,
  dateRange: getCurrentMonthRange() as [Date, Date],
})

function toYMD(d: Date) {
  return formatDateLocal(d)
}

function applyFilters() {
  const [date_from, date_to] = filters.value.dateRange
    ? [filters.value.dateRange[0], filters.value.dateRange[1]]
    : [undefined, undefined]
  store.fetchPage(1, store.perPage, {
    financial_account_id: filters.value.financial_account_id || undefined,
    type: filters.value.type || undefined,
    date_from: date_from ? toYMD(date_from) : undefined,
    date_to: date_to ? toYMD(date_to) : undefined,
  })
}

function openCreate() {
  isEdit.value = false
  editingId.value = null
  formModel.value = {
    financial_account_id: accountOptions.value[0]?.value ?? 0,
    type: 'income',
    amount: 0,
    date: formatDateLocal(new Date()),
    description: '',
  }
  dialogVisible.value = true
}

function openEdit(row: FinancialTransaction) {
  if (!row.is_manual) return
  isEdit.value = true
  editingId.value = row.id
  editingAccountLabel.value = row.account?.name ?? '—'
  formModel.value = {
    financial_account_id: row.financial_account_id,
    type: row.type,
    amount: row.amount,
    date: row.date,
    description: row.description ?? '',
  }
  dialogVisible.value = true
}

async function onFormSubmit(
  payload:
    | {
        financial_account_id: number
        type: 'income' | 'expense'
        amount: number
        date: string
        description?: string
      }
    | { type: 'income' | 'expense'; amount: number; date: string; description?: string },
) {
  try {
    if (isEdit.value && editingId.value !== null) {
      if ('financial_account_id' in payload)
        delete (payload as Record<string, unknown>).financial_account_id
      await store.update(editingId.value, payload)
      showSuccess('تم تحديث المعاملة بنجاح')
    } else {
      if (!('financial_account_id' in payload)) return
      await store.create(
        payload as {
          financial_account_id: number
          type: 'income' | 'expense'
          amount: number
          date: string
          description?: string
        },
      )
      showSuccess('تم إضافة المعاملة بنجاح')
    }
    dialogVisible.value = false
    const [df, dt] = filters.value.dateRange
      ? [toYMD(filters.value.dateRange[0]), toYMD(filters.value.dateRange[1])]
      : [undefined, undefined]
    await store.fetchPage(store.currentPage, store.perPage, {
      financial_account_id: filters.value.financial_account_id || undefined,
      type: filters.value.type || undefined,
      date_from: df,
      date_to: dt,
    })
  } catch {
    // error shown via toast
  }
}

function onFormCancel() {
  dialogVisible.value = false
}

function confirmDelete(row: FinancialTransaction) {
  if (!row.is_manual) return
  confirm.require({
    message: `هل أنت متأكد من حذف هذه المعاملة (${row.type === 'income' ? 'إيراد' : 'مصروف'} - ${row.amount})؟`,
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
        showSuccess('تم حذف المعاملة بنجاح')
        const [df, dt] = filters.value.dateRange
          ? [toYMD(filters.value.dateRange[0]), toYMD(filters.value.dateRange[1])]
          : [undefined, undefined]
        await store.fetchPage(store.currentPage, store.perPage, {
          financial_account_id: filters.value.financial_account_id || undefined,
          type: filters.value.type || undefined,
          date_from: df,
          date_to: dt,
        })
      } catch {
        // error shown via toast
      }
    },
  })
}

function onPageChange(page: number) {
  const [df, dt] = filters.value.dateRange
    ? [toYMD(filters.value.dateRange[0]), toYMD(filters.value.dateRange[1])]
    : [undefined, undefined]
  store.fetchPage(page, store.perPage, {
    financial_account_id: filters.value.financial_account_id || undefined,
    type: filters.value.type || undefined,
    date_from: df,
    date_to: dt,
  })
}

onMounted(async () => {
  await accountsStore.fetchAll()
  const [date_from, date_to] = filters.value.dateRange
    ? [filters.value.dateRange[0], filters.value.dateRange[1]]
    : [undefined, undefined]
  await store.fetchPage(1, store.perPage, {
    financial_account_id: filters.value.financial_account_id || undefined,
    type: filters.value.type || undefined,
    date_from: date_from ? toYMD(date_from) : undefined,
    date_to: date_to ? toYMD(date_to) : undefined,
  })
})
</script>

<template>
  <div dir="rtl">
    <div class="flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div class="flex align-items-center gap-2">
        <span class="text-lg font-semibold">رصيد الحساب:</span>
        <span
          :class="[
            'text-xl font-bold',
            store.accountBalance >= 0 ? 'text-green-600' : 'text-red-600',
          ]"
        >
          {{ store.accountBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
        </span>
      </div>
      <Button label="إضافة معاملة" icon="pi pi-plus" @click="openCreate" />
    </div>

    <Card>
      <template #content>
        <div class="flex flex-wrap gap-2 mb-4">
          <Select
            v-model="filters.financial_account_id"
            :options="[{ label: 'كل الحسابات', value: null }, ...accountOptions]"
            option-label="label"
            option-value="value"
            placeholder="الحساب"
            class="w-12rem"
            @change="applyFilters"
          />
          <Select
            v-model="filters.type"
            :options="[
              { label: 'الكل', value: null },
              { label: 'إيراد', value: 'income' },
              { label: 'مصروف', value: 'expense' },
            ]"
            option-label="label"
            option-value="value"
            placeholder="النوع"
            class="w-10rem"
            @change="applyFilters"
          />
          <DatePicker
            v-model="filters.dateRange"
            selection-mode="range"
            :manual-input="false"
            date-format="yy-mm-dd"
            placeholder="من تاريخ - إلى تاريخ"
            show-icon
            show-clear
            icon-display="input"
            class="w-15rem"
            @update:model-value="applyFilters"
          />
          <Button label="تطبيق" icon="pi pi-filter" outlined @click="applyFilters" />
        </div>

        <div v-if="store.loading" class="flex justify-content-center align-items-center py-8">
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>
        <div
          v-else-if="store.items.length === 0"
          class="flex flex-column align-items-center justify-content-center py-8 gap-3 empty-state"
        >
          <i class="pi pi-wallet text-6xl text-color-secondary"></i>
          <p class="text-color-secondary m-0">لا توجد معاملات مالية</p>
          <p class="text-sm text-color-secondary m-0">أضف معاملة جديدة للبدء</p>
          <Button label="إضافة معاملة" icon="pi pi-plus" @click="openCreate" />
        </div>
        <DataTable
          v-else
          :value="store.items"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          class="p-datatable-sm"
        >
          <Column field="date" header="التاريخ" style="width: 120px">
            <template #body="{ data }">{{ data.date }}</template>
          </Column>
          <Column field="type" header="النوع" style="width: 100px">
            <template #body="{ data }">
              <Tag
                :value="data.type === 'income' ? 'إيراد' : 'مصروف'"
                :severity="data.type === 'income' ? 'success' : 'danger'"
              />
            </template>
          </Column>
          <Column field="amount" header="المبلغ">
            <template #body="{ data }">
              {{ data.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
            </template>
          </Column>
          <Column field="description" header="الوصف">
            <template #body="{ data }">{{ data.description ?? '—' }}</template>
          </Column>
          <Column field="account" header="الحساب">
            <template #body="{ data }">{{ data.account?.name ?? '—' }}</template>
          </Column>
          <Column field="is_manual" header="يدوي">
            <template #body="{ data }">
              <i v-if="data.is_manual" class="pi pi-check text-green-600"></i>
              <i v-else class="pi pi-link text-color-secondary" title="مرتبط"></i>
            </template>
          </Column>
          <Column header="الإجراءات" style="width: 180px">
            <template #body="{ data }">
              <Button
                v-if="data.is_manual"
                label="تعديل"
                icon="pi pi-pencil"
                text
                size="small"
                class="p-button-success"
                @click="openEdit(data)"
              />
              <Button
                v-if="data.is_manual"
                label="حذف"
                icon="pi pi-trash"
                text
                size="small"
                class="p-button-danger"
                @click="confirmDelete(data)"
              />
              <span v-else class="text-sm text-color-secondary">—</span>
            </template>
          </Column>
        </DataTable>
      </template>
      <template v-if="store.lastPage > 1" #footer>
        <div class="flex justify-content-between align-items-center">
          <span class="text-sm text-color-secondary">
            عرض {{ store.meta?.from ?? 0 }} - {{ store.meta?.to ?? 0 }} من {{ store.total }}
          </span>
          <div class="flex gap-1">
            <Button
              icon="pi pi-chevron-right"
              text
              size="small"
              :disabled="store.currentPage <= 1"
              @click="onPageChange(store.currentPage - 1)"
            />
            <span class="flex align-items-center px-2 text-sm">
              {{ store.currentPage }} / {{ store.lastPage }}
            </span>
            <Button
              icon="pi pi-chevron-left"
              text
              size="small"
              :disabled="store.currentPage >= store.lastPage"
              @click="onPageChange(store.currentPage + 1)"
            />
          </div>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="dialogVisible"
      :header="formTitle"
      :modal="true"
      :style="{ width: '420px' }"
      @hide="dialogVisible = false"
    >
      <FinancialTransactionForm
        v-if="dialogVisible"
        :model-value="formModel"
        :account-options="accountOptions"
        :account-label="isEdit ? editingAccountLabel : undefined"
        :loading="store.loading"
        :is-edit="isEdit"
        @submit="onFormSubmit"
        @cancel="onFormCancel"
      />
    </Dialog>
  </div>
</template>
