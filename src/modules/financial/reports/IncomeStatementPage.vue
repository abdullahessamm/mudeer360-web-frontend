<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { showError } from '@/composables/useToast'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import { incomeTypeLabel } from '@/lib/incomeTypes'
import { expenseTypeLabel } from '@/lib/expenseTypes'
import { useFinancialReportsStore } from '@/stores/financialReports'

const store = useFinancialReportsStore()

const dateRange = ref<Date[] | null>(null)

watch(
  () => store.error,
  (err) => {
    if (err) {
      showError(err)
      store.clearError()
    }
  },
)

function fmt(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function typeLabel(type: string, kind: 'income' | 'expense') {
  if (type === 'unspecified') return 'غير مصنف'
  return kind === 'income' ? incomeTypeLabel(type) : expenseTypeLabel(type)
}

const statement = computed(() => store.incomeStatement)

async function load() {
  const range = dateRange.value
  if (!range?.[0] || !range?.[1]) {
    showError('اختر تاريخ البداية والنهاية')
    return
  }
  await store.getIncomeStatement({
    date_from: formatDateLocal(range[0]),
    date_to: formatDateLocal(range[1]),
  })
}

onMounted(() => {
  const [a, b] = getCurrentMonthRange()
  dateRange.value = [a, b]
  load()
})
</script>

<template>
  <div dir="rtl" class="report-page">
    <Card class="mb-4">
      <template #title>قائمة الدخل</template>
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
          <Button label="تطبيق" icon="pi pi-filter" outlined @click="load" />
        </div>

        <div v-if="store.loading" class="flex justify-content-center py-8">
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>

        <template v-else-if="statement">
          <div class="summary-grid mb-4">
            <div class="summary-card summary-income">
              <span class="summary-label">إجمالي الإيرادات</span>
              <span class="summary-value">{{ fmt(statement.total_income) }}</span>
            </div>
            <div class="summary-card summary-expense">
              <span class="summary-label">إجمالي المصروفات</span>
              <span class="summary-value">{{ fmt(statement.total_expense) }}</span>
            </div>
            <div class="summary-card summary-net" :class="{ negative: statement.net_profit < 0 }">
              <span class="summary-label">صافي الربح</span>
              <span class="summary-value">{{ fmt(statement.net_profit) }}</span>
            </div>
          </div>

          <div class="grid">
            <div class="col-12 lg:col-6">
              <h3 class="table-section-title">الإيرادات حسب التصنيف</h3>
              <DataTable
                :value="statement.income"
                data-key="type"
                striped-rows
                responsive-layout="scroll"
                class="p-datatable-sm"
              >
                <Column field="type" header="التصنيف">
                  <template #body="{ data: row }">{{ typeLabel(row.type, 'income') }}</template>
                </Column>
                <Column field="total" header="المبلغ">
                  <template #body="{ data: row }">{{ fmt(row.total) }}</template>
                </Column>
              </DataTable>
            </div>
            <div class="col-12 lg:col-6">
              <h3 class="table-section-title">المصروفات حسب التصنيف</h3>
              <DataTable
                :value="statement.expenses"
                data-key="type"
                striped-rows
                responsive-layout="scroll"
                class="p-datatable-sm"
              >
                <Column field="type" header="التصنيف">
                  <template #body="{ data: row }">{{ typeLabel(row.type, 'expense') }}</template>
                </Column>
                <Column field="total" header="المبلغ">
                  <template #body="{ data: row }">{{ fmt(row.total) }}</template>
                </Column>
              </DataTable>
            </div>
          </div>
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
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

.summary-net.negative {
  border-right-color: #ef4444;
}

.summary-label {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.summary-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-color);
}

.table-section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
}
</style>
