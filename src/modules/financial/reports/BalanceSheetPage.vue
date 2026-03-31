<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { showError } from '@/composables/useToast'
import { financialAccountTypeLabel } from '@/lib/financialAccountTypes'
import { useFinancialReportsStore } from '@/stores/financialReports'

const store = useFinancialReportsStore()

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

async function load() {
  await store.getBalanceSheet()
}

const liabilityRows = computed(() => {
  const L = store.balanceSheet?.liabilities
  if (!L) return []
  return [
    { key: 'suppliers', label: 'ذمم الموردين (فواتير غير مسددة / جزئية)', amount: L.suppliers },
    { key: 'payroll', label: 'رواتب معلّقة', amount: L.payroll },
    { key: 'customers', label: 'أرصدة عملاء دائنة (يُستحق للعميل)', amount: L.customers },
    {
      key: 'partners',
      label: 'جاري الشركاء (مسحوبات تفوق الإيداع — التزام)',
      amount: L.partners,
    },
  ]
})

onMounted(() => {
  load()
})
</script>

<template>
  <div dir="rtl" class="report-page">
    <Card class="mb-4">
      <template #title>قائمة المركز المالي</template>
      <template #content>
        <div class="flex justify-content-end mb-4">
          <Button label="تحديث" icon="pi pi-refresh" outlined @click="load" />
        </div>

        <div v-if="store.loading" class="flex justify-content-center py-8">
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>

        <template v-else-if="store.balanceSheet">
          <div class="summary-grid mb-4">
            <div class="summary-card summary-assets">
              <span class="summary-label">إجمالي الأصول</span>
              <span class="summary-value">{{ fmt(store.balanceSheet.total_assets) }}</span>
            </div>
            <div class="summary-card summary-liabilities">
              <span class="summary-label">إجمالي الالتزامات</span>
              <span class="summary-value">{{
                fmt(store.balanceSheet.liabilities.total_liabilities)
              }}</span>
            </div>
            <div class="summary-card summary-equity">
              <span class="summary-label">حقوق الملكية</span>
              <span class="summary-value">{{ fmt(store.balanceSheet.equity) }}</span>
            </div>
          </div>

          <h3 class="table-section-title">الأصول — الحسابات المالية</h3>
          <p class="section-hint text-muted">
            الرصيد = مجموع الإيرادات − مجموع المصروفات لكل حساب.
          </p>
          <DataTable
            :value="store.balanceSheet.assets"
            data-key="id"
            striped-rows
            responsive-layout="scroll"
            class="p-datatable-sm mb-4"
          >
            <Column field="name" header="اسم الحساب" />
            <Column field="type" header="النوع">
              <template #body="{ data }">{{ financialAccountTypeLabel(data.type) }}</template>
            </Column>
            <Column field="balance" header="الرصيد">
              <template #body="{ data }">{{ fmt(data.balance) }}</template>
            </Column>
          </DataTable>

          <h3 class="table-section-title">الالتزامات</h3>
          <p class="section-hint text-muted">
            ذمم الموردين؛ رواتب معلّقة؛ أرصدة عملاء دائنة؛ وجاري شركاء سالب (مسحوبات أكثر من
            إيداعات).
          </p>
          <DataTable
            :value="liabilityRows"
            data-key="key"
            striped-rows
            responsive-layout="scroll"
            class="p-datatable-sm mb-4"
          >
            <Column field="label" header="البند" />
            <Column field="amount" header="المبلغ">
              <template #body="{ data }">{{ fmt(data.amount) }}</template>
            </Column>
          </DataTable>

          <div class="equity-banner">
            <span class="equity-label">حقوق الملكية</span>
            <span
              class="equity-sub text-muted"
              v-if="(store.balanceSheet.partners_equity ?? 0) > 0"
            >
              يشمل حقوق شركاء (جاري موجب): {{ fmt(store.balanceSheet.partners_equity) }}
            </span>
            <span class="equity-value">{{ fmt(store.balanceSheet.equity) }}</span>
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

.summary-assets {
  border-right: 4px solid #22c55e;
}

.summary-liabilities {
  border-right: 4px solid #eab308;
}

.summary-equity {
  border-right: 4px solid #008cff;
}

.summary-label {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.summary-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.table-section-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0 0.35rem;
}

.section-hint {
  font-size: 0.85rem;
  margin: 0 0 0.75rem;
  color: var(--text-color-secondary);
}

.text-muted {
  color: var(--text-color-secondary);
}

.equity-banner {
  margin-top: 0.5rem;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%);
  border: 1px solid #b3dfff;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.equity-label {
  font-size: 0.9rem;
  color: #0066cc;
  font-weight: 600;
}

.equity-sub {
  font-size: 0.8rem;
  display: block;
  margin-bottom: 0.25rem;
}

.equity-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: #2d3748;
}
</style>
