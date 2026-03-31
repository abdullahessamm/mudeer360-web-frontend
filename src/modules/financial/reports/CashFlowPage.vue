<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { showError } from '@/composables/useToast'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import { useFinancialReportsStore } from '@/stores/financialReports'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'

const store = useFinancialReportsStore()
const accountsStore = useFinancialAccountsStore()

const dateRange = ref<Date[] | null>(null)
const accountId = ref<number | null>(null)

watch(
  () => store.error,
  (err) => {
    if (err) {
      showError(err)
      store.clearError()
    }
  },
)

const accountOptions = ref<{ label: string; value: number | null }[]>([{ label: 'كل الحسابات', value: null }])

function fmt(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function load() {
  const range = dateRange.value
  if (!range?.[0] || !range?.[1]) {
    showError('اختر تاريخ البداية والنهاية')
    return
  }
  await store.getCashFlow({
    date_from: formatDateLocal(range[0]),
    date_to: formatDateLocal(range[1]),
    financial_account_id: accountId.value ?? undefined,
  })
}

onMounted(async () => {
  const [a, b] = getCurrentMonthRange()
  dateRange.value = [a, b]
  try {
    await accountsStore.fetchAll()
    accountOptions.value = [
      { label: 'كل الحسابات', value: null },
      ...accountsStore.items.map((x) => ({ label: x.name, value: x.id })),
    ]
  } catch {
    // toast via store
  }
  load()
})
</script>

<template>
  <div dir="rtl" class="report-page">
    <Card class="mb-4">
      <template #title>التدفقات النقدية</template>
      <template #content>
        <div class="flex flex-wrap align-items-end gap-3 mb-4">
          <div class="flex flex-column gap-1">
            <label class="text-sm text-color-secondary">الفترة</label>
            <DatePicker
              v-model="dateRange"
              selection-mode="range"
              :manual-input="false"
              date-format="yy-mm-dd"
              placeholder="من — إلى"
              show-icon
              show-clear
              icon-display="input"
              class="w-20rem"
            />
          </div>
          <div class="flex flex-column gap-1">
            <label class="text-sm text-color-secondary">الحساب (اختياري)</label>
            <Select
              v-model="accountId"
              :options="accountOptions"
              option-label="label"
              option-value="value"
              placeholder="كل الحسابات"
              class="w-18rem"
              filter
              filter-placeholder="بحث…"
              show-clear
            />
          </div>
          <Button label="تطبيق" icon="pi pi-filter" outlined @click="load" />
        </div>

        <div v-if="store.loading" class="flex justify-content-center py-8">
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>

        <template v-else-if="store.cashFlow">
          <div class="summary-grid mb-4">
            <div class="summary-card">
              <span class="summary-label">الرصيد الافتتاحي</span>
              <span class="summary-value">{{ fmt(store.cashFlow.opening_balance) }}</span>
            </div>
            <div class="summary-card summary-income">
              <span class="summary-label">التدفقات الداخلة</span>
              <span class="summary-value">{{ fmt(store.cashFlow.inflow) }}</span>
            </div>
            <div class="summary-card summary-expense">
              <span class="summary-label">التدفقات الخارجة</span>
              <span class="summary-value">{{ fmt(store.cashFlow.outflow) }}</span>
            </div>
            <div class="summary-card summary-net">
              <span class="summary-label">الرصيد الختامي</span>
              <span class="summary-value">{{ fmt(store.cashFlow.closing_balance) }}</span>
            </div>
          </div>

          <h3 class="table-section-title">تفصيل حسب الحساب</h3>
          <DataTable
            :value="store.cashFlow.accounts"
            data-key="id"
            striped-rows
            responsive-layout="scroll"
            class="p-datatable-sm"
          >
            <Column field="name" header="الحساب" />
            <Column field="opening_balance" header="افتتاحي">
              <template #body="{ data }">{{ fmt(data.opening_balance) }}</template>
            </Column>
            <Column field="inflow" header="داخل">
              <template #body="{ data }">{{ fmt(data.inflow) }}</template>
            </Column>
            <Column field="outflow" header="خارج">
              <template #body="{ data }">{{ fmt(data.outflow) }}</template>
            </Column>
            <Column field="closing_balance" header="ختامي">
              <template #body="{ data }">{{ fmt(data.closing_balance) }}</template>
            </Column>
          </DataTable>
        </template>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.report-page {
  max-width: 1200px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.summary-card {
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border: 1px solid var(--surface-border);
  background: var(--surface-card);
}

.summary-income {
  border-right: 4px solid #22c55e;
}

.summary-expense {
  border-right: 4px solid #ef4444;
}

.summary-net {
  border-right: 4px solid #008cff;
}

.summary-label {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.summary-value {
  font-size: 1.2rem;
  font-weight: 700;
}

.table-section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
}
</style>
