<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { showError } from '@/composables/useToast'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import { incomeTypeLabel } from '@/lib/incomeTypes'
import { expenseTypeLabel } from '@/lib/expenseTypes'
import FinancialReportShell from '@/components/reports/FinancialReportShell.vue'
import { useFinancialReportsStore } from '@/stores/financialReports'
import { formatMoney } from '@/lib/format'

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
  return formatMoney(n)
}

function typeLabel(type: string, kind: 'income' | 'expense') {
  if (type === 'unspecified') return 'غير مصنف'
  return kind === 'income' ? incomeTypeLabel(type) : expenseTypeLabel(type)
}

const statement = computed(() => store.incomeStatement)

const isProfit = computed(() => (statement.value?.net_profit ?? 0) >= 0)

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
  <FinancialReportShell
    title="قائمة الدخل"
    subtitle="الإيرادات والمصروفات وصافي الربح للفترة المحددة"
    icon="pi-list"
    :loading="store.loading"
  >
    <template #filters>
      <div class="bs-filter-field">
        <label for="is-range">الفترة</label>
        <DatePicker
          id="is-range"
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
      <Button label="عرض التقرير" icon="pi pi-filter" :loading="store.loading" @click="load" />
    </template>

    <template v-if="statement">
      <div class="bs-kpi-row">
        <div class="bs-kpi bs-kpi--income">
          <div class="bs-kpi-icon"><i class="pi pi-arrow-down-left"></i></div>
          <div class="bs-kpi-body">
            <span class="bs-kpi-label">إجمالي الإيرادات</span>
            <span class="bs-kpi-value">{{ fmt(statement.total_income) }}</span>
          </div>
        </div>
        <div class="bs-kpi bs-kpi--expense">
          <div class="bs-kpi-icon"><i class="pi pi-arrow-up-right"></i></div>
          <div class="bs-kpi-body">
            <span class="bs-kpi-label">إجمالي المصروفات</span>
            <span class="bs-kpi-value">{{ fmt(statement.total_expense) }}</span>
          </div>
        </div>
        <div class="bs-kpi" :class="isProfit ? 'bs-kpi--net' : 'bs-kpi--net-negative'">
          <div class="bs-kpi-icon">
            <i class="pi" :class="isProfit ? 'pi-check-circle' : 'pi-times-circle'"></i>
          </div>
          <div class="bs-kpi-body">
            <span class="bs-kpi-label">صافي الربح</span>
            <span class="bs-kpi-value">{{ fmt(statement.net_profit) }}</span>
          </div>
        </div>
      </div>

      <div
        class="bs-highlight"
        :class="isProfit ? 'bs-highlight--profit' : 'bs-highlight--loss'"
      >
        <span class="bs-highlight-label">
          {{ isProfit ? 'ربح الفترة' : 'خسارة الفترة' }}
        </span>
        <span class="bs-highlight-value">{{ fmt(statement.net_profit) }}</span>
      </div>

      <div class="bs-columns">
        <section class="bs-panel bs-panel--income">
          <header class="bs-panel-head">
            <div class="bs-panel-head-main">
              <span class="bs-panel-icon"><i class="pi pi-plus-circle"></i></span>
              <h2>الإيرادات حسب التصنيف</h2>
            </div>
            <span class="bs-panel-total">{{ fmt(statement.total_income) }}</span>
          </header>
          <div class="bs-panel-body-pad">
            <p v-if="!statement.income.length" class="bs-empty">
              <i class="pi pi-inbox"></i>
              لا توجد إيرادات في هذه الفترة
            </p>
            <div v-else class="bs-table-wrap">
              <table class="bs-table">
                <thead>
                  <tr>
                    <th>التصنيف</th>
                    <th class="bs-td-num">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in statement.income" :key="row.type">
                    <td class="bs-td-strong">{{ typeLabel(row.type, 'income') }}</td>
                    <td class="bs-td-num bs-td-in">{{ fmt(row.total) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <footer class="bs-panel-foot bs-panel-foot--income">
            <span>مجموع الإيرادات</span>
            <span>{{ fmt(statement.total_income) }}</span>
          </footer>
        </section>

        <section class="bs-panel bs-panel--expense">
          <header class="bs-panel-head">
            <div class="bs-panel-head-main">
              <span class="bs-panel-icon"><i class="pi pi-minus-circle"></i></span>
              <h2>المصروفات حسب التصنيف</h2>
            </div>
            <span class="bs-panel-total">{{ fmt(statement.total_expense) }}</span>
          </header>
          <div class="bs-panel-body-pad">
            <p v-if="!statement.expenses.length" class="bs-empty">
              <i class="pi pi-inbox"></i>
              لا توجد مصروفات في هذه الفترة
            </p>
            <div v-else class="bs-table-wrap">
              <table class="bs-table">
                <thead>
                  <tr>
                    <th>التصنيف</th>
                    <th class="bs-td-num">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in statement.expenses" :key="row.type">
                    <td class="bs-td-strong">{{ typeLabel(row.type, 'expense') }}</td>
                    <td class="bs-td-num bs-td-out">{{ fmt(row.total) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <footer class="bs-panel-foot bs-panel-foot--expense">
            <span>مجموع المصروفات</span>
            <span>{{ fmt(statement.total_expense) }}</span>
          </footer>
        </section>
      </div>
    </template>
  </FinancialReportShell>
</template>
