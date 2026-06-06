<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { showError } from '@/composables/useToast'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import FinancialReportShell from '@/components/reports/FinancialReportShell.vue'
import { useFinancialReportsStore } from '@/stores/financialReports'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'
import { formatMoney } from '@/lib/format'

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

const accountOptions = ref<{ label: string; value: number | null }[]>([
  { label: 'كل الحسابات', value: null },
])

const cashFlow = computed(() => store.cashFlow)

function fmt(n: number) {
  return formatMoney(n)
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
  <FinancialReportShell
    title="التدفقات النقدية"
    subtitle="حركة النقد داخل وخارج الحسابات المالية خلال الفترة"
    icon="pi-sync"
    :loading="store.loading"
  >
    <template #filters>
      <div class="bs-filter-field">
        <label for="cf-range">الفترة</label>
        <DatePicker
          id="cf-range"
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
      <div class="bs-filter-field">
        <label for="cf-account">الحساب</label>
        <Select
          id="cf-account"
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
      <Button label="عرض التقرير" icon="pi pi-filter" :loading="store.loading" @click="load" />
    </template>

    <template v-if="cashFlow">
      <div class="bs-kpi-row bs-kpi-row--4">
        <div class="bs-kpi bs-kpi--neutral">
          <div class="bs-kpi-icon"><i class="pi pi-history"></i></div>
          <div class="bs-kpi-body">
            <span class="bs-kpi-label">الرصيد الافتتاحي</span>
            <span class="bs-kpi-value">{{ fmt(cashFlow.opening_balance) }}</span>
          </div>
        </div>
        <div class="bs-kpi bs-kpi--inflow">
          <div class="bs-kpi-icon"><i class="pi pi-arrow-down-left"></i></div>
          <div class="bs-kpi-body">
            <span class="bs-kpi-label">التدفقات الداخلة</span>
            <span class="bs-kpi-value">{{ fmt(cashFlow.inflow) }}</span>
          </div>
        </div>
        <div class="bs-kpi bs-kpi--outflow">
          <div class="bs-kpi-icon"><i class="pi pi-arrow-up-right"></i></div>
          <div class="bs-kpi-body">
            <span class="bs-kpi-label">التدفقات الخارجة</span>
            <span class="bs-kpi-value">{{ fmt(cashFlow.outflow) }}</span>
          </div>
        </div>
        <div class="bs-kpi bs-kpi--net">
          <div class="bs-kpi-icon"><i class="pi pi-wallet"></i></div>
          <div class="bs-kpi-body">
            <span class="bs-kpi-label">الرصيد الختامي</span>
            <span class="bs-kpi-value">{{ fmt(cashFlow.closing_balance) }}</span>
          </div>
        </div>
      </div>

      <section class="bs-panel bs-panel--cash">
        <header class="bs-panel-head">
          <div class="bs-panel-head-main">
            <span class="bs-panel-icon"><i class="pi pi-table"></i></span>
            <h2>تفصيل حسب الحساب</h2>
          </div>
          <span class="bs-panel-total">{{ fmt(cashFlow.closing_balance) }}</span>
        </header>
        <div class="bs-panel-body-pad">
          <p v-if="!cashFlow.accounts.length" class="bs-empty">
            <i class="pi pi-inbox"></i>
            لا توجد حركة نقدية في هذه الفترة
          </p>
          <div v-else class="bs-table-wrap">
            <table class="bs-table">
              <thead>
                <tr>
                  <th>الحساب</th>
                  <th class="bs-td-num">افتتاحي</th>
                  <th class="bs-td-num">داخل</th>
                  <th class="bs-td-num">خارج</th>
                  <th class="bs-td-num">ختامي</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in cashFlow.accounts" :key="row.id">
                  <td class="bs-td-strong">{{ row.name }}</td>
                  <td class="bs-td-num">{{ fmt(row.opening_balance) }}</td>
                  <td class="bs-td-num bs-td-in">{{ fmt(row.inflow) }}</td>
                  <td class="bs-td-num bs-td-out">{{ fmt(row.outflow) }}</td>
                  <td class="bs-td-num">{{ fmt(row.closing_balance) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <footer class="bs-panel-foot bs-panel-foot--closing">
          <span>إجمالي الرصيد الختامي</span>
          <span>{{ fmt(cashFlow.closing_balance) }}</span>
        </footer>
      </section>
    </template>
  </FinancialReportShell>
</template>
