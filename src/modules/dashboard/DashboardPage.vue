<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showError } from '@/composables/useToast'
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
    { title: 'إجمالي المنتجات', value: String(d?.products_count ?? 0), icon: 'pi pi-box' },
    { title: 'إجمالي الموردين', value: String(d?.suppliers_count ?? 0), icon: 'pi pi-users' },
    {
      title: 'فواتير البيع',
      value: String(d?.sales_invoices_count ?? 0),
      icon: 'pi pi-shopping-cart',
    },
    { title: 'فواتير الشراء', value: String(d?.purchase_invoices_count ?? 0), icon: 'pi pi-truck' },
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

const salesVsPurchasesOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
    },
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
  plugins: {
    legend: {
      position: 'top' as const,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
    },
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
  plugins: {
    legend: {
      position: 'bottom' as const,
    },
  },
}

const lowStockProducts = computed(() => dashboardStore.data?.low_stock_products ?? [])
const lowStockTotal = computed(() => dashboardStore.data?.low_stock_total ?? 0)
const lowStockOthersCount = computed(() =>
  Math.max(0, lowStockTotal.value - lowStockProducts.value.length),
)

onMounted(() => {
  dashboardStore.fetchDashboard()
})
</script>

<template>
  <div dir="rtl" class="dashboard-page">
    <div v-if="dashboardStore.loading" class="flex justify-content-center align-items-center py-8">
      <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
    </div>

    <template v-else>
      <!-- Summary cards -->
      <div class="dashboard-grid">
        <div v-for="stat in stats" :key="stat.title" class="stat-card">
          <div class="stat-card-inner">
            <div class="stat-icon-wrap">
              <i :class="['pi', stat.icon, 'stat-icon']"></i>
            </div>
            <div class="stat-content">
              <p class="stat-title">{{ stat.title }}</p>
              <p class="stat-value">{{ stat.value }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="dashboard-charts-grid mt-4">
        <Card class="chart-card">
          <template #title>المبيعات vs المشتريات (الشهر الحالي)</template>
          <template #content>
            <div v-if="salesVsPurchasesChart" class="chart-container">
              <Chart type="bar" :data="salesVsPurchasesChart" :options="salesVsPurchasesOptions" />
            </div>
            <p v-else class="text-color-secondary m-0">لا توجد بيانات</p>
          </template>
        </Card>
        <Card class="chart-card">
          <template #title>المبيعات والمشتريات (آخر 6 أشهر)</template>
          <template #content>
            <div v-if="monthlyChart?.datasets?.[0]?.data?.length" class="chart-container">
              <Chart type="line" :data="monthlyChart" :options="monthlyChartOptions" />
            </div>
            <p v-else class="text-color-secondary m-0">لا توجد بيانات</p>
          </template>
        </Card>
      </div>

      <div class="dashboard-charts-grid dashboard-charts-grid-3 mt-4">
        <Card class="chart-card chart-card-doughnut">
          <template #title>حالة فواتير البيع</template>
          <template #content>
            <div v-if="salesInvoiceStatusChart" class="chart-container chart-doughnut">
              <Chart
                type="doughnut"
                :data="salesInvoiceStatusChart"
                :options="invoiceStatusOptions"
              />
            </div>
            <p v-else class="text-color-secondary m-0">لا توجد بيانات</p>
          </template>
        </Card>
        <Card class="chart-card chart-card-doughnut">
          <template #title>حالة فواتير الشراء</template>
          <template #content>
            <div v-if="purchasesInvoiceStatusChart" class="chart-container chart-doughnut">
              <Chart
                type="doughnut"
                :data="purchasesInvoiceStatusChart"
                :options="invoiceStatusOptions"
              />
            </div>
            <p v-else class="text-color-secondary m-0">لا توجد بيانات</p>
          </template>
        </Card>
        <Card class="chart-card">
          <template #title>منتجات منخفضة المخزون</template>
          <template #content>
            <div v-if="lowStockProducts.length" class="low-stock-list">
              <div
                v-for="p in lowStockProducts"
                :key="p.id"
                class="low-stock-item flex justify-content-between align-items-center py-2 border-bottom-1 surface-border"
                @click="router.push('/products')"
              >
                <span class="font-medium">{{ p.name }}</span>
                <span class="text-color-secondary">
                  {{ p.quantity }} / {{ p.min_quantity }} {{ p.unit }}</span
                >
              </div>
              <div
                v-if="lowStockOthersCount"
                class="low-stock-others text-color-secondary text-sm py-2"
              >
                +{{ lowStockOthersCount }} أخرى
              </div>
              <Button
                label="عرض المنتجات"
                link
                size="small"
                class="mt-2"
                @click="router.push('/products')"
              />
            </div>
            <p v-else class="text-color-secondary m-0">لا توجد منتجات منخفضة المخزون</p>
          </template>
        </Card>
      </div>

      <!-- Info cards row -->
      <div class="dashboard-grid dashboard-grid-2 mt-4">
        <div class="info-card">
          <h3 class="info-card-title">مرحباً بك في مدير 360</h3>
          <p class="info-card-text">
            نظام إدارة الأعمال المتكامل. من إدارة المنتجات والمخزون إلى فواتير البيع والشراء، ستجد
            كل ما تحتاجه لإدارة عملك.
          </p>
        </div>
        <div class="info-card info-card-primary">
          <div class="info-card-brand">
            <span class="info-card-logo">م</span>
            <span class="info-card-brand-text">مدير 360</span>
          </div>
          <p class="info-card-text info-card-text-light">نظام إدارة أعمال سريع وموثوق</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard-page {
  width: 100%;
  min-width: 0;
}

.dashboard-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
}

.dashboard-grid .stat-card {
  flex: 1 1 0;
  min-width: 0;
}

@media (max-width: 767px) {
  .dashboard-grid .stat-card {
    flex: 1 1 100%;
  }
}

.dashboard-charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}

.dashboard-charts-grid-3 {
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .dashboard-charts-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .dashboard-charts-grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }
}

.chart-card {
  min-height: 280px;
}

.chart-card-doughnut :deep(.p-card-content) {
  overflow: hidden;
}

.chart-container {
  height: 280px;
}

.chart-doughnut {
  height: 240px;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  justify-content: center;
}

.low-stock-list {
  min-height: 200px;
}

.low-stock-item {
  cursor: pointer;
}

.low-stock-item:hover {
  background: var(--p-surface-hover);
}

.dashboard-grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}

.dashboard-grid-2 .info-card {
  min-width: 0;
}

@media (min-width: 768px) {
  .dashboard-grid-2 {
    grid-template-columns: 2fr 1fr;
  }
}

/* Stat cards */
.stat-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
}

.stat-card-inner {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.stat-icon-wrap {
  width: 3rem;
  height: 3rem;
  min-width: 3rem;
  background: #e8f4ff;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon {
  font-size: 1.25rem;
  color: #008cff;
}

.stat-content {
  flex: 1;
}

.stat-title {
  font-size: 0.8rem;
  color: #718096;
  margin: 0 0 0.25rem 0;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #2d3748;
  margin: 0;
}

/* Info cards */
.info-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
}

.info-card-title {
  font-size: 1rem;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 0.5rem 0;
}

.info-card-text {
  font-size: 0.9rem;
  color: #718096;
  line-height: 1.5;
  margin: 0 0 0.75rem 0;
}

.info-card-primary {
  background: #008cff;
  border-color: #008cff;
}

.info-card-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.info-card-logo {
  width: 2rem;
  height: 2rem;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.125rem;
  font-weight: 700;
}

.info-card-brand-text {
  font-size: 1.125rem;
  font-weight: 700;
  color: white;
}

.info-card-text-light {
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}
</style>
