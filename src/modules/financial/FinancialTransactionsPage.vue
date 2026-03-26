<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { formatDateLocal } from '@/lib/date'
import { useConfirm } from 'primevue/useconfirm'
import { exportFinancialTransactionsReport } from '@/composables/useExportFinancialTransactions'
import { showError, showSuccess } from '@/composables/useToast'
import {
  useFinancialTransactionsStore,
  type FinancialPageScope,
} from '@/stores/financialTransactions'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'
import FinancialTransactionForm from '@/components/forms/FinancialTransactionForm.vue'
import { expenseTypeLabel } from '@/lib/expenseTypes'
import { incomeTypeLabel } from '@/lib/incomeTypes'
import type { FinancialTransaction } from '@/types'

const props = defineProps<{
  fixedType?: 'income' | 'expense'
}>()

const confirm = useConfirm()
const store = useFinancialTransactionsStore()
const accountsStore = useFinancialAccountsStore()

const pageScope = computed<FinancialPageScope>(() =>
  props.fixedType === 'income' ? 'income' : props.fixedType === 'expense' ? 'expense' : 'all',
)

const slice = computed(() => store.stateByScope[pageScope.value])

const overview = computed(() => {
  if (pageScope.value === 'income') return store.overviewByScope.income
  if (pageScope.value === 'expense') return store.overviewByScope.expense
  return null
})

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
const exportLoading = ref(false)

const formTitle = computed(() => (isEdit.value ? 'تعديل المعاملة' : 'إضافة معاملة مالية'))

const accountOptions = computed(() =>
  accountsStore.items.map((a) => ({ label: a.name, value: a.id })),
)

const overviewSum = computed(() =>
  (overview.value?.items ?? []).reduce((s, t) => s + (Number(t.amount) || 0), 0),
)

const overviewAvg = computed(() => {
  const list = overview.value?.items ?? []
  const n = list.length
  if (!n) return 0
  return overviewSum.value / n
})

const breakdownByAccount = computed(() => {
  const map = new Map<string, { name: string; sum: number; count: number }>()
  for (const t of overview.value?.items ?? []) {
    const name = t.account?.name ?? 'بدون حساب'
    const cur = map.get(name) ?? { name, sum: 0, count: 0 }
    cur.sum += Number(t.amount) || 0
    cur.count += 1
    map.set(name, cur)
  }
  return [...map.values()].sort((a, b) => b.sum - a.sum)
})

const accountChartPalette = [
  '#008cff',
  '#22c55e',
  '#eab308',
  '#a855f7',
  '#f97316',
  '#14b8a6',
  '#ec4899',
  '#64748b',
]

const chartByAccount = computed(() => {
  const rows = breakdownByAccount.value
  if (!rows.length) return null
  return {
    labels: rows.map((r) => r.name),
    datasets: [
      {
        data: rows.map((r) => r.sum),
        backgroundColor: rows.map((_, i) => accountChartPalette[i % accountChartPalette.length]),
        hoverBackgroundColor: rows.map(
          (_, i) => accountChartPalette[i % accountChartPalette.length],
        ),
      },
    ],
  }
})

const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
    },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed?: number }) => {
          const v = ctx.parsed ?? 0
          return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}`
        },
      },
    },
  },
}

function applyFilters() {
  store.fetchPage(pageScope.value, 1)
  if (pageScope.value === 'income' || pageScope.value === 'expense') {
    store.loadOverview(pageScope.value)
  }
}

async function exportExcel() {
  if (props.fixedType !== 'income' && props.fixedType !== 'expense') return
  exportLoading.value = true
  try {
    const rows = await store.fetchAllForExport(props.fixedType)
    const fid = slice.value.filters.financial_account_id
    const accountLabel = fid
      ? (accountOptions.value.find((a) => a.value === fid)?.label ?? null)
      : null
    exportFinancialTransactionsReport({
      kind: props.fixedType,
      rows,
      dateRange: slice.value.filters.dateRange,
      accountLabel,
    })
    showSuccess('تم تصدير التقرير')
  } catch {
    showError('فشل تصدير التقرير')
  } finally {
    exportLoading.value = false
  }
}

function openCreate() {
  isEdit.value = false
  editingId.value = null
  formModel.value = {
    financial_account_id: accountOptions.value[0]?.value ?? 0,
    type: props.fixedType ?? 'income',
    amount: 0,
    date: formatDateLocal(new Date()),
    description: '',
    ...(props.fixedType === 'expense' ? { expense_type: 'other' as const } : {}),
    ...(props.fixedType === 'income' ? { income_type: 'other' as const } : {}),
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
    ...(row.type === 'expense' ? { expense_type: row.expense_type ?? 'other' } : {}),
    ...(row.type === 'income' ? { income_type: row.income_type ?? 'other' } : {}),
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
        expense_type?: string
        income_type?: string
      }
    | {
        type: 'income' | 'expense'
        amount: number
        date: string
        description?: string
        expense_type?: string
        income_type?: string
      },
) {
  try {
    const sc = pageScope.value
    if (isEdit.value && editingId.value !== null) {
      if ('financial_account_id' in payload)
        delete (payload as Record<string, unknown>).financial_account_id
      await store.update(editingId.value, payload, sc)
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
          expense_type?: string
          income_type?: string
        },
        sc,
      )
      showSuccess('تم إضافة المعاملة بنجاح')
    }
    dialogVisible.value = false
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
        await store.remove(row.id, pageScope.value)
        showSuccess('تم حذف المعاملة بنجاح')
      } catch {
        // error shown via toast
      }
    },
  })
}

function onPageChange(page: number) {
  store.fetchPage(pageScope.value, page)
}

watch(
  pageScope,
  async (sc) => {
    await store.fetchPage(sc, 1)
    if (sc === 'income' || sc === 'expense') await store.loadOverview(sc)
  },
  { immediate: true },
)

onMounted(async () => {
  await accountsStore.fetchAll()
})
</script>

<template>
  <div dir="rtl">
    <!-- تفاصيل تحليلية: الإيرادات / المصروفات فقط -->
    <div v-if="fixedType" class="mb-4">
      <div class="grid">
        <div class="col-12 md:col-4">
          <Card>
            <template #title>
              {{ fixedType === 'income' ? 'إجمالي الإيرادات (عينة)' : 'إجمالي المصروفات (عينة)' }}
            </template>
            <template #content>
              <div v-if="overview?.loading" class="py-4 text-center">
                <i class="pi pi-spin pi-spinner"></i>
              </div>
              <template v-else>
                <span
                  :class="[
                    'text-2xl font-bold',
                    fixedType === 'income' ? 'text-green-600' : 'text-red-600',
                  ]"
                >
                  {{ overviewSum.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
                </span>
                <p class="text-sm text-color-secondary m-0 mt-2">
                  مجموع المبالغ من أول {{ (overview?.items ?? []).length }} سجل مطابق للفلتر (للتحليل).
                  إجمالي السجلات المطابقة:
                  {{ (overview?.totalCount ?? 0).toLocaleString('ar-EG') }}.
                </p>
              </template>
            </template>
          </Card>
        </div>
        <div class="col-12 md:col-4">
          <Card>
            <template #title>متوسط قيمة المعاملة</template>
            <template #content>
              <span class="text-2xl font-bold text-900">
                {{ overviewAvg.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
              </span>
              <p class="text-sm text-color-secondary m-0 mt-2">حسب عينة التحليل أعلاه</p>
            </template>
          </Card>
        </div>
        <div class="col-12 md:col-4">
          <Card>
            <template #title>رصيد الحساب (المحدد في الفلتر)</template>
            <template #content>
              <span
                :class="[
                  'text-2xl font-bold',
                  slice.accountBalance >= 0 ? 'text-green-600' : 'text-red-600',
                ]"
              >
                {{ slice.accountBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
              </span>
              <p class="text-sm text-color-secondary m-0 mt-2">
                يتأثر باختيار الحساب في الجدول أدناه عند وجوده
              </p>
            </template>
          </Card>
        </div>
      </div>

      <div class="grid mt-3">
        <div class="col-12 lg:col-6">
          <Card class="chart-card-fin">
            <template #title>توزيع المبالغ حسب الحساب</template>
            <template #content>
              <div v-if="chartByAccount" class="chart-container-fin">
                <Chart type="doughnut" :data="chartByAccount" :options="doughnutChartOptions" />
              </div>
              <p v-else class="text-color-secondary m-0">لا توجد بيانات كافية للرسم</p>
            </template>
          </Card>
        </div>
        <div class="col-12 lg:col-6">
          <Card>
            <template #title>تفصيل حسب الحساب</template>
            <template #content>
              <DataTable
                :value="breakdownByAccount"
                data-key="name"
                striped-rows
                class="p-datatable-sm"
              >
                <Column field="name" header="الحساب" />
                <Column field="sum" header="المجموع">
                  <template #body="{ data }">
                    {{ data.sum.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
                  </template>
                </Column>
                <Column field="count" header="عدد العمليات" />
              </DataTable>
              <p v-if="!breakdownByAccount.length" class="text-color-secondary m-0 text-sm">
                غيّر نطاق التاريخ أو الحساب لعرض التفاصيل.
              </p>
            </template>
          </Card>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div class="flex align-items-center gap-2">
        <span class="text-lg font-semibold">رصيد الحساب:</span>
        <span
          :class="['text-xl font-bold', slice.accountBalance >= 0 ? 'text-green-600' : 'text-red-600']"
        >
          {{ slice.accountBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
        </span>
      </div>
      <Button label="إضافة معاملة" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div v-if="fixedType" class="flex flex-wrap justify-content-end gap-2 mb-3">
      <Button
        v-if="fixedType === 'income' || fixedType === 'expense'"
        label="تصدير Excel"
        icon="pi pi-file-excel"
        severity="success"
        outlined
        :loading="exportLoading"
        @click="exportExcel"
      />
      <Button label="إضافة معاملة" icon="pi pi-plus" @click="openCreate" />
    </div>

    <Card>
      <template #content>
        <div class="flex flex-wrap gap-2 mb-4">
          <Select
            v-model="slice.filters.financial_account_id"
            :options="[{ label: 'كل الحسابات', value: null }, ...accountOptions]"
            option-label="label"
            option-value="value"
            placeholder="الحساب"
            class="w-12rem"
            @change="applyFilters"
          />
          <Select
            v-if="!fixedType"
            v-model="slice.filters.type"
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
          <Tag v-else :value="fixedType === 'income' ? 'إيرادات فقط' : 'مصروفات فقط'" class="align-self-center" />
          <DatePicker
            v-model="slice.filters.dateRange"
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
          <Button
            v-if="fixedType === 'income' || fixedType === 'expense'"
            label="تصدير Excel"
            icon="pi pi-download"
            severity="success"
            outlined
            :loading="exportLoading"
            @click="exportExcel"
          />
        </div>

        <div v-if="slice.loading" class="flex justify-content-center align-items-center py-8">
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>
        <div
          v-else-if="slice.items.length === 0"
          class="flex flex-column align-items-center justify-content-center py-8 gap-3 empty-state"
        >
          <i class="pi pi-wallet text-6xl text-color-secondary"></i>
          <p class="text-color-secondary m-0">لا توجد معاملات مالية</p>
          <p class="text-sm text-color-secondary m-0">أضف معاملة جديدة للبدء</p>
          <Button label="إضافة معاملة" icon="pi pi-plus" @click="openCreate" />
        </div>
        <DataTable
          v-else
          :value="slice.items"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          class="p-datatable-sm"
        >
          <Column field="date" header="التاريخ" style="width: 120px">
            <template #body="{ data }">{{ data.date }}</template>
          </Column>
          <Column v-if="!fixedType" field="type" header="النوع" style="width: 100px">
            <template #body="{ data }">
              <Tag
                :value="data.type === 'income' ? 'إيراد' : 'مصروف'"
                :severity="data.type === 'income' ? 'success' : 'danger'"
              />
            </template>
          </Column>
          <Column
            v-if="fixedType !== 'income'"
            field="expense_type"
            header="تصنيف المصروف"
            style="min-width: 130px"
          >
            <template #body="{ data }">
              {{
                data.type === 'expense' ? expenseTypeLabel(data.expense_type) : '—'
              }}
            </template>
          </Column>
          <Column
            v-if="fixedType !== 'income'"
            field="supplier_name"
            header="المورد"
            style="min-width: 120px"
          >
            <template #body="{ data }">
              {{
                data.type === 'expense' ? (data.supplier_name ?? '—') : '—'
              }}
            </template>
          </Column>
          <Column
            v-if="fixedType !== 'income'"
            field="invoice_number"
            header="رقم فاتورة الشراء"
            style="min-width: 110px"
          >
            <template #body="{ data }">
              {{ data.type === 'expense' ? (data.invoice_number ?? '—') : '—' }}
            </template>
          </Column>
          <Column
            v-if="fixedType !== 'expense'"
            field="income_type"
            header="تصنيف الإيراد"
            style="min-width: 130px"
          >
            <template #body="{ data }">
              {{ data.type === 'income' ? incomeTypeLabel(data.income_type) : '—' }}
            </template>
          </Column>
          <Column
            v-if="fixedType !== 'expense'"
            field="customer_name"
            header="العميل"
            style="min-width: 120px"
          >
            <template #body="{ data }">
              {{ data.type === 'income' ? (data.customer_name ?? '—') : '—' }}
            </template>
          </Column>
          <Column
            v-if="fixedType !== 'expense'"
            field="invoice_number_sale"
            header="رقم فاتورة البيع"
            style="min-width: 110px"
          >
            <template #body="{ data }">
              {{ data.type === 'income' ? (data.invoice_number ?? '—') : '—' }}
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
      <template v-if="(slice.meta?.last_page ?? 1) > 1" #footer>
        <div class="flex justify-content-between align-items-center">
          <span class="text-sm text-color-secondary">
            عرض {{ slice.meta?.from ?? 0 }} - {{ slice.meta?.to ?? 0 }} من
            {{ slice.meta?.total ?? 0 }}
          </span>
          <div class="flex gap-1">
            <Button
              icon="pi pi-chevron-right"
              text
              size="small"
              :disabled="(slice.meta?.current_page ?? 1) <= 1"
              @click="onPageChange((slice.meta?.current_page ?? 1) - 1)"
            />
            <span class="flex align-items-center px-2 text-sm">
              {{ slice.meta?.current_page ?? 1 }} / {{ slice.meta?.last_page ?? 1 }}
            </span>
            <Button
              icon="pi pi-chevron-left"
              text
              size="small"
              :disabled="(slice.meta?.current_page ?? 1) >= (slice.meta?.last_page ?? 1)"
              @click="onPageChange((slice.meta?.current_page ?? 1) + 1)"
            />
          </div>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="dialogVisible"
      :header="formTitle"
      :modal="true"
      :style="{ width: '460px' }"
      @hide="dialogVisible = false"
    >
      <FinancialTransactionForm
        v-if="dialogVisible"
        :model-value="formModel"
        :account-options="accountOptions"
        :account-label="isEdit ? editingAccountLabel : undefined"
        :loading="slice.loading"
        :is-edit="isEdit"
        :locked-type="fixedType"
        @submit="onFormSubmit"
        @cancel="onFormCancel"
      />
    </Dialog>
  </div>
</template>

<style scoped>
.chart-card-fin :deep(.p-card-content) {
  min-height: 260px;
}
.chart-container-fin {
  height: 240px;
  position: relative;
}
</style>
