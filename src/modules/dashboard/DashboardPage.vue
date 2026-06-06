<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showError } from '@/composables/useToast'
import FinancialReportShell from '@/components/reports/FinancialReportShell.vue'
import { formatNumber, formatQty } from '@/lib/format'
import { useDashboardStore } from '@/stores/dashboard'

const router = useRouter()
const dashboardStore = useDashboardStore()

watch(
  () => dashboardStore.error,
  (err) => {
    if (err) {
      showError(err)
      dashboardStore.clearError()
    }
  },
)

const stats = computed(() => {
  const d = dashboardStore.data
  return [
    {
      title: 'إجمالي المنتجات',
      value: formatNumber(d?.products_count ?? 0),
      icon: 'pi pi-box',
      kpi: 'bs-kpi--neutral',
    },
    {
      title: 'إجمالي الموردين',
      value: formatNumber(d?.suppliers_count ?? 0),
      icon: 'pi pi-users',
      kpi: 'bs-kpi--neutral',
    },
    {
      title: 'فواتير البيع',
      value: formatNumber(d?.sales_invoices_count ?? 0),
      icon: 'pi pi-shopping-cart',
      kpi: 'bs-kpi--income',
    },
    {
      title: 'فواتير الشراء',
      value: formatNumber(d?.purchase_invoices_count ?? 0),
      icon: 'pi pi-truck',
      kpi: 'bs-kpi--expense',
    },
  ]
})

const salesVsPurchasesChart = computed(() => {
  const d = dashboardStore.data?.current_month
  if (!d) return null
  return {
    labels: ['المبيعات', 'المشتريات'],
    datasets: [
      {
        label: 'المبلغ',
        data: [d.sales_total, d.purchases_total],
        backgroundColor: ['#22c55e', '#ef4444'],
      },
    ],
  }
})

const chartYTicks = {
  callback: (value: string | number) => formatNumber(Number(value)),
}

const salesVsPurchasesOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, ticks: chartYTicks },
  },
}

const monthLabels: Record<string, string> = {
  '01': 'يناير',
  '02': 'فبراير',
  '03': 'مارس',
  '04': 'أبريل',
  '05': 'مايو',
  '06': 'يونيو',
  '07': 'يوليو',
  '08': 'أغسطس',
  '09': 'سبتمبر',
  '10': 'أكتوبر',
  '11': 'نوفمبر',
  '12': 'ديسمبر',
}

const monthlyChart = computed(() => {
  const totals = dashboardStore.data?.monthly_totals ?? []
  return {
    labels: totals.map((t) => {
      const [y, m] = t.month.split('-')
      return `${monthLabels[m ?? '01'] ?? m} ${y}`
    }),
    datasets: [
      {
        label: 'المبيعات',
        data: totals.map((t) => t.sales),
        fill: false,
        borderColor: '#22c55e',
        tension: 0.3,
      },
      {
        label: 'المشتريات',
        data: totals.map((t) => t.purchases),
        fill: false,
        borderColor: '#ef4444',
        tension: 0.3,
      },
    ],
  }
})

const monthlyChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const } },
  scales: {
    y: { beginAtZero: true, ticks: chartYTicks },
  },
}

function makeStatusChart(paid: number, partial: number, unpaid: number) {
  if (paid + partial + unpaid === 0) return null
  return {
    labels: ['مدفوع', 'مدفوع جزئياً', 'غير مدفوع'],
    datasets: [
      {
        data: [paid, partial, unpaid],
        backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
        hoverBackgroundColor: ['#16a34a', '#ca8a04', '#dc2626'],
      },
    ],
  }
}

const salesInvoiceStatusChart = computed(() => {
  const s = dashboardStore.data?.sales_status
  if (!s) return null
  return makeStatusChart(s.paid ?? 0, s.partial ?? 0, s.unpaid ?? 0)
})

const purchasesInvoiceStatusChart = computed(() => {
  const p = dashboardStore.data?.purchases_status
  if (!p) return null
  return makeStatusChart(p.paid ?? 0, p.partial ?? 0, p.unpaid ?? 0)
})

const invoiceStatusOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' as const } },
}

const lowStockProducts = computed(() => dashboardStore.data?.low_stock_products ?? [])
const lowStockTotal = computed(() => dashboardStore.data?.low_stock_total ?? 0)
const lowStockOthersCount = computed(() =>
  Math.max(0, lowStockTotal.value - lowStockProducts.value.length),
)

const currentMonthSales = computed(
  () => dashboardStore.data?.current_month?.sales_total ?? 0,
)
const currentMonthPurchases = computed(
  () => dashboardStore.data?.current_month?.purchases_total ?? 0,
)

function refresh() {
  dashboardStore.fetchDashboard()
}

onMounted(() => {
  refresh()
})
</script>

<template>
  <FinancialReportShell
    title="لوحة التحكم"
    subtitle="ملخص سريع للمنتجات والفواتير والمبيعات والمشتريات والمخزون"
    icon="pi-home"
    :loading="dashboardStore.loading"
  >
    <template #toolbar>
      <Button
        label="تحديث"
        icon="pi pi-refresh"
        :loading="dashboardStore.loading"
        @click="refresh"
      />
    </template>

    <template v-if="dashboardStore.data">
      <div class="bs-kpi-row bs-kpi-row--4">
        <div v-for="stat in stats" :key="stat.title" class="bs-kpi" :class="stat.kpi">
          <div class="bs-kpi-icon"><i :class="stat.icon"></i></div>
          <div class="bs-kpi-body">
            <span class="bs-kpi-label">{{ stat.title }}</span>
            <span class="bs-kpi-value">{{ stat.value }}</span>
          </div>
        </div>
      </div>

      <div
        v-if="dashboardStore.data.current_month"
        class="bs-highlight bs-highlight--profit"
      >
        <span class="bs-highlight-label">نشاط الشهر الحالي (مبيعات / مشتريات)</span>
        <span class="bs-highlight-value">
          {{ formatNumber(currentMonthSales) }} /
          {{ formatNumber(currentMonthPurchases) }}
        </span>
      </div>

      <div class="bs-dashboard-charts bs-dashboard-charts--2">
        <section class="bs-panel bs-panel--cash">
          <header class="bs-panel-head">
            <div class="bs-panel-head-main">
              <span class="bs-panel-icon"><i class="pi pi-chart-bar"></i></span>
              <h2>المبيعات vs المشتريات (الشهر الحالي)</h2>
            </div>
          </header>
          <div class="bs-panel-body-pad">
            <div v-if="salesVsPurchasesChart" class="bs-chart-wrap">
              <Chart type="bar" :data="salesVsPurchasesChart" :options="salesVsPurchasesOptions" />
            </div>
            <p v-else class="bs-empty"><i class="pi pi-inbox"></i> لا توجد بيانات</p>
          </div>
        </section>

        <section class="bs-panel bs-panel--cash">
          <header class="bs-panel-head">
            <div class="bs-panel-head-main">
              <span class="bs-panel-icon"><i class="pi pi-chart-line"></i></span>
              <h2>المبيعات والمشتريات (آخر 6 أشهر)</h2>
            </div>
          </header>
          <div class="bs-panel-body-pad">
            <div v-if="monthlyChart?.datasets?.[0]?.data?.length" class="bs-chart-wrap">
              <Chart type="line" :data="monthlyChart" :options="monthlyChartOptions" />
            </div>
            <p v-else class="bs-empty"><i class="pi pi-inbox"></i> لا توجد بيانات</p>
          </div>
        </section>
      </div>

      <div class="bs-dashboard-charts bs-dashboard-charts--3">
        <section class="bs-panel bs-panel--income">
          <header class="bs-panel-head">
            <div class="bs-panel-head-main">
              <span class="bs-panel-icon"><i class="pi pi-shopping-cart"></i></span>
              <h2>حالة فواتير البيع</h2>
            </div>
          </header>
          <div class="bs-panel-body-pad">
            <div v-if="salesInvoiceStatusChart" class="bs-chart-wrap bs-chart-wrap--doughnut">
              <Chart
                type="doughnut"
                :data="salesInvoiceStatusChart"
                :options="invoiceStatusOptions"
              />
            </div>
            <p v-else class="bs-empty"><i class="pi pi-inbox"></i> لا توجد بيانات</p>
          </div>
        </section>

        <section class="bs-panel bs-panel--expense">
          <header class="bs-panel-head">
            <div class="bs-panel-head-main">
              <span class="bs-panel-icon"><i class="pi pi-truck"></i></span>
              <h2>حالة فواتير الشراء</h2>
            </div>
          </header>
          <div class="bs-panel-body-pad">
            <div v-if="purchasesInvoiceStatusChart" class="bs-chart-wrap bs-chart-wrap--doughnut">
              <Chart
                type="doughnut"
                :data="purchasesInvoiceStatusChart"
                :options="invoiceStatusOptions"
              />
            </div>
            <p v-else class="bs-empty"><i class="pi pi-inbox"></i> لا توجد بيانات</p>
          </div>
        </section>

        <section class="bs-panel bs-panel--warn">
          <header class="bs-panel-head">
            <div class="bs-panel-head-main">
              <span class="bs-panel-icon"><i class="pi pi-exclamation-triangle"></i></span>
              <h2>منتجات منخفضة المخزون</h2>
            </div>
          </header>
          <div class="bs-panel-body-pad">
            <div v-if="lowStockProducts.length" class="bs-low-stock-list">
              <button
                v-for="p in lowStockProducts"
                :key="p.id"
                type="button"
                class="bs-low-stock-item"
                @click="router.push('/products')"
              >
                <span class="bs-low-stock-name">
                  {{ p.product_code ? `${p.product_code} - ` : '' }}{{ p.name }}
                </span>
                <span class="bs-low-stock-qty">
                  {{ formatQty(p.quantity) }} / {{ formatQty(p.min_quantity) }} {{ p.unit }}
                </span>
              </button>
              <p v-if="lowStockOthersCount" class="bs-low-stock-more">
                +{{ formatNumber(lowStockOthersCount) }} أخرى
              </p>
              <Button
                label="عرض المنتجات"
                link
                size="small"
                class="mt-2"
                @click="router.push('/products')"
              />
            </div>
            <p v-else class="bs-empty"><i class="pi pi-check-circle"></i> لا توجد منتجات منخفضة المخزون</p>
          </div>
        </section>
      </div>

      <div class="bs-welcome-row">
        <div class="bs-welcome-card">
          <h3 class="bs-welcome-title">مرحباً بك في مدير 360</h3>
          <p class="bs-welcome-text">
            نظام إدارة الأعمال المتكامل. من إدارة المنتجات والمخزون إلى فواتير البيع والشراء، ستجد
            كل ما تحتاجه لإدارة عملك.
          </p>
        </div>
        <div class="bs-welcome-card bs-welcome-card--brand">
          <div class="bs-welcome-brand">
            <span class="bs-welcome-logo">م</span>
            <span class="bs-welcome-brand-text">مدير 360</span>
          </div>
          <p class="bs-welcome-text bs-welcome-text--light">نظام إدارة أعمال سريع وموثوق</p>
        </div>
      </div>
    </template>
  </FinancialReportShell>
</template>
