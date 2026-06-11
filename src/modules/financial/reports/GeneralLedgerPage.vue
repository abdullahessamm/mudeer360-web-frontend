<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { showError } from '@/composables/useToast'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import FinancialReportShell from '@/components/reports/FinancialReportShell.vue'
import { useFinancialReportsStore } from '@/stores/financialReports'
import { formatMoney } from '@/lib/format'

const store = useFinancialReportsStore()

const dateRange = ref<Date[] | null>(null)
const ledgerAccountId = ref<number | null>(null)

watch(
  () => store.error,
  (err) => {
    if (err) {
      showError(err)
      store.clearError()
    }
  },
)

const ledger = computed(() => store.generalLedger)

const accountOptions = computed(() => [
  { label: 'كل حسابات الدفتر', value: null },
  ...store.ledgerAccounts.map((a) => ({
    label: `${a.code} — ${a.name}`,
    value: a.id,
  })),
])

const typeLabels: Record<string, string> = {
  asset: 'أصول',
  liability: 'خصوم',
  equity: 'حقوق ملكية',
  income: 'إيرادات',
  expense: 'مصروفات',
}

function fmt(n: number) {
  return formatMoney(n)
}

function typeLabel(type: string) {
  return typeLabels[type] ?? type
}

function entryDescription(row: {
  line_description: string | null
  description: string | null
}) {
  return row.line_description || row.description || '—'
}

const groupedAccounts = computed(() => {
  if (!ledger.value?.accounts) return []
  
  const groups: Record<string, typeof ledger.value.accounts> = {
    asset: [],
    liability: [],
    equity: [],
    income: [],
    expense: []
  }
  
  ledger.value.accounts.forEach(account => {
    const type = account.type
    if (!groups[type]) {
      groups[type] = []
    }
    groups[type].push(account)
  })
  
  return Object.entries(groups)
    .filter(([_, list]) => list.length > 0)
    .map(([type, list]) => ({
      type,
      name: typeLabel(type),
      accounts: list
    }))
})

function groupIcon(type: string) {
  const icons: Record<string, string> = {
    asset: 'pi-wallet',
    liability: 'pi-credit-card',
    equity: 'pi-users',
    income: 'pi-arrow-down-left',
    expense: 'pi-arrow-up-right'
  }
  return icons[type] ?? 'pi-folder'
}

async function load() {
  const range = dateRange.value
  if (!range?.[0] || !range?.[1]) {
    showError('اختر تاريخ البداية والنهاية')
    return
  }
  await store.getGeneralLedger({
    date_from: formatDateLocal(range[0]),
    date_to: formatDateLocal(range[1]),
    ledger_account_id: ledgerAccountId.value ?? undefined,
  })
}

onMounted(async () => {
  const [a, b] = getCurrentMonthRange()
  dateRange.value = [a, b]
  try {
    await store.fetchLedgerAccounts()
  } catch {
    // toast via store
  }
  load()
})
</script>

<template>
  <FinancialReportShell
    title="دفتر الأستاذ العام"
    subtitle="قيود اليومية المزدوجة لكل حساب في دليل الحسابات خلال الفترة"
    icon="pi-book"
    :loading="store.loading"
  >
    <template #filters>
      <div class="bs-filter-field">
        <label for="gl-range">الفترة</label>
        <DatePicker
          id="gl-range"
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
        <label for="gl-account">حساب الدفتر</label>
        <Select
          id="gl-account"
          v-model="ledgerAccountId"
          :options="accountOptions"
          option-label="label"
          option-value="value"
          placeholder="كل حسابات الدفتر"
          class="w-22rem"
          filter
          filter-placeholder="بحث…"
          show-clear
        />
      </div>
      <Button label="عرض التقرير" icon="pi pi-filter" :loading="store.loading" @click="load" />
    </template>

    <template v-if="ledger">
      <p v-if="!ledger.accounts.length" class="bs-empty">
        <i class="pi pi-inbox"></i>
        لا توجد حركة في دليل الحسابات خلال هذه الفترة
      </p>

      <div
        v-for="group in groupedAccounts"
        :key="group.type"
        class="bs-ledger-group"
      >
        <h3 class="bs-ledger-group-title">
          <i class="pi" :class="groupIcon(group.type)"></i>
          {{ group.name }}
        </h3>

        <section
          v-for="account in group.accounts"
          :key="account.id"
          class="bs-panel bs-panel--ledger"
        >
          <header class="bs-panel-head">
            <div class="bs-panel-head-main">
              <span class="bs-panel-icon"><i class="pi pi-book"></i></span>
              <div>
                <h2>{{ account.code }} — {{ account.name }}</h2>
                <span class="bs-panel-sub">{{ typeLabel(account.type) }}</span>
              </div>
            </div>
            <span class="bs-panel-total">{{ fmt(account.closing_balance) }}</span>
          </header>

          <div class="bs-gl-summary">
            <div class="bs-gl-summary-item">
              <span class="bs-gl-summary-label">رصيد افتتاحي</span>
              <span class="bs-gl-summary-value">{{ fmt(account.opening_balance) }}</span>
            </div>
            <div class="bs-gl-summary-item">
              <span class="bs-gl-summary-label">مجموع المدين</span>
              <span class="bs-gl-summary-value bs-td-in">{{ fmt(account.total_debit) }}</span>
            </div>
            <div class="bs-gl-summary-item">
              <span class="bs-gl-summary-label">مجموع الدائن</span>
              <span class="bs-gl-summary-value bs-td-out">{{ fmt(account.total_credit) }}</span>
            </div>
            <div class="bs-gl-summary-item">
              <span class="bs-gl-summary-label">رصيد ختامي</span>
              <span class="bs-gl-summary-value">{{ fmt(account.closing_balance) }}</span>
            </div>
          </div>

          <div class="bs-panel-body-pad">
            <p v-if="!account.entries.length" class="bs-empty">
              <i class="pi pi-inbox"></i>
              لا توجد قيود في هذه الفترة
            </p>
            <div v-else class="bs-table-wrap">
              <table class="bs-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>رقم القيد</th>
                    <th>البيان</th>
                    <th class="bs-td-num">مدين</th>
                    <th class="bs-td-num">دائن</th>
                    <th class="bs-td-num">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="account.opening_balance !== 0" class="bs-gl-opening-row">
                    <td colspan="3" class="bs-td-strong">رصيد افتتاحي</td>
                    <td class="bs-td-num">—</td>
                    <td class="bs-td-num">—</td>
                    <td class="bs-td-num">{{ fmt(account.opening_balance) }}</td>
                  </tr>
                  <tr v-for="row in account.entries" :key="row.id">
                    <td>{{ row.date }}</td>
                    <td class="bs-td-mono">{{ row.entry_number }}</td>
                    <td>{{ entryDescription(row) }}</td>
                    <td class="bs-td-num bs-td-in">
                      {{ row.debit > 0 ? fmt(row.debit) : '—' }}
                    </td>
                    <td class="bs-td-num bs-td-out">
                      {{ row.credit > 0 ? fmt(row.credit) : '—' }}
                    </td>
                    <td class="bs-td-num">{{ fmt(row.balance) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <footer class="bs-panel-foot bs-panel-foot--closing">
            <span>الرصيد الختامي — {{ account.name }}</span>
            <span>{{ fmt(account.closing_balance) }}</span>
          </footer>
        </section>
      </div>
    </template>
  </FinancialReportShell>
</template>

<style scoped>
.bs-ledger-group {
  margin-bottom: 2.5rem;
}
.bs-ledger-group-title {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
  margin-top: 0;
  margin-bottom: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--surface-border);
}
.bs-ledger-group-title .pi {
  font-size: 1.1rem;
  color: var(--p-primary-color, #008cff);
}
</style>
