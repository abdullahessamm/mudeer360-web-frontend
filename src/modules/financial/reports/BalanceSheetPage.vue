<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { showError } from '@/composables/useToast'
import { financialAccountTypeLabel } from '@/lib/financialAccountTypes'
import FinancialReportShell from '@/components/reports/FinancialReportShell.vue'
import { useFinancialReportsStore } from '@/stores/financialReports'
import { formatMoney } from '@/lib/format'

const store = useFinancialReportsStore()

const showCashDetails = ref(true)
const showIndebtedCustomersDetails = ref(true)
const showFixedDetails = ref(true)
const showStockDetails = ref(true)
const showCreditCustomersDetails = ref(true)
const showSupplierPayablesDetails = ref(true)

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

async function load() {
  await store.getBalanceSheet()
}

const sheet = computed(() => store.balanceSheet)

const financialAssetsTotal = computed(
  () =>
    sheet.value?.financial_assets_total ??
    sheet.value?.assets.reduce((s, r) => s + r.balance, 0) ??
    0,
)

const fixedAssetsByCategory = computed(() => sheet.value?.fixed_assets?.by_category ?? [])

const fixedAssetsTotal = computed(() => sheet.value?.fixed_assets?.total ?? 0)

const stock = computed(
  () =>
    sheet.value?.stock ?? {
      opening_value: 0,
      purchases: 0,
      sales_cost: 0,
      total: 0,
    },
)

const stockTotal = computed(() => stock.value.total)

const indebtedCustomers = computed(
  () =>
    sheet.value?.indebted_customers ?? {
      by_customer: [],
      total: 0,
    },
)

const indebtedCustomersTotal = computed(() => indebtedCustomers.value.total)

const indebtedCustomerCount = computed(() => indebtedCustomers.value.by_customer.length)

const creditCustomers = computed(
  () =>
    sheet.value?.credit_customers ?? {
      by_customer: [],
      total: 0,
    },
)

const creditCustomersTotal = computed(() => creditCustomers.value.total)

const creditCustomerCount = computed(() => creditCustomers.value.by_customer.length)

const supplierPayables = computed(
  () =>
    sheet.value?.supplier_payables ?? {
      by_supplier: [],
      total: 0,
    },
)

const supplierPayablesTotal = computed(() => supplierPayables.value.total)

const supplierPayablesCount = computed(() => supplierPayables.value.by_supplier.length)

const liabilityRows = computed(() => {
  const L = sheet.value?.liabilities
  if (!L) return []
  return [
    { key: 'payroll', label: 'رواتب معلّقة', hint: 'مستحقات رواتب لم تُسدَّد بعد', amount: L.payroll, icon: 'pi-users' },
    { key: 'partners', label: 'جاري الشركاء (سالب)', hint: 'مسحوبات أكثر من الإيداعات', amount: L.partners, icon: 'pi-briefcase' },
  ].filter((r) => Math.abs(r.amount) > 0.0001)
})

const hasLiabilityContent = computed(
  () =>
    liabilityRows.value.length > 0 ||
    creditCustomersTotal.value > 0.0001 ||
    supplierPayablesTotal.value > 0.0001,
)

const liabilitiesTotal = computed(() => sheet.value?.liabilities.total_liabilities ?? 0)

const equityTotal = computed(() => sheet.value?.equity ?? 0)

const liabilitiesPlusEquity = computed(() => liabilitiesTotal.value + equityTotal.value)

const isBalanced = computed(() => {
  const assets = sheet.value?.total_assets ?? 0
  return Math.abs(assets - liabilitiesPlusEquity.value) < 0.02
})

const cashAccountCount = computed(() => sheet.value?.assets.length ?? 0)

const fixedAssetCount = computed(() =>
  fixedAssetsByCategory.value.reduce((s, r) => s + r.count, 0),
)

onMounted(() => {
  load()
})
</script>

<template>
  <FinancialReportShell
    title="قائمة المركز المالي"
    subtitle="ملخص ما تملكه المنشأة مقابل ما عليها وما يتبقى لأصحابها"
    icon="pi-chart-bar"
    :loading="store.loading"
  >
    <template #toolbar>
      <Button
        label="تحديث التقرير"
        icon="pi pi-refresh"
        :loading="store.loading"
        @click="load"
      />
    </template>

    <template v-if="sheet">
      <div class="bs-kpi-row">
        <div class="bs-kpi bs-kpi--assets">
          <div class="bs-kpi-icon"><i class="pi pi-wallet"></i></div>
          <div class="bs-kpi-body">
            <span class="bs-kpi-label">الأصول</span>
            <span class="bs-kpi-value">{{ fmt(sheet.total_assets) }}</span>
          </div>
        </div>
        <div class="bs-kpi bs-kpi--liab">
          <div class="bs-kpi-icon"><i class="pi pi-book"></i></div>
          <div class="bs-kpi-body">
            <span class="bs-kpi-label">الالتزامات</span>
            <span class="bs-kpi-value">{{ fmt(liabilitiesTotal) }}</span>
          </div>
        </div>
        <div class="bs-kpi bs-kpi--equity">
          <div class="bs-kpi-icon"><i class="pi pi-chart-line"></i></div>
          <div class="bs-kpi-body">
            <span class="bs-kpi-label">حقوق الملكية</span>
            <span class="bs-kpi-value">{{ fmt(equityTotal) }}</span>
          </div>
        </div>
      </div>

      <div class="bs-equation" :class="{ 'bs-equation--ok': isBalanced }">
        <div class="bs-equation-formula">
          <div class="bs-eq-part bs-eq-part--assets">
            <span class="bs-eq-label">الأصول</span>
            <span class="bs-eq-num">{{ fmt(sheet.total_assets) }}</span>
          </div>
          <span class="bs-eq-op">=</span>
          <div class="bs-eq-part bs-eq-part--liab">
            <span class="bs-eq-label">الالتزامات</span>
            <span class="bs-eq-num">{{ fmt(liabilitiesTotal) }}</span>
          </div>
          <span class="bs-eq-op">+</span>
          <div class="bs-eq-part bs-eq-part--equity">
            <span class="bs-eq-label">حقوق الملكية</span>
            <span class="bs-eq-num">{{ fmt(equityTotal) }}</span>
          </div>
        </div>
        <Tag
          v-if="isBalanced"
          value="المعادلة متوازنة"
          severity="success"
          rounded
          icon="pi pi-check-circle"
        />
        <Tag
          v-else
          value="راجع الأرقام"
          severity="warn"
          rounded
          icon="pi pi-exclamation-triangle"
        />
      </div>

      <div class="bs-columns">
        <section class="bs-panel bs-panel--assets">
          <header class="bs-panel-head">
            <div class="bs-panel-head-main">
              <span class="bs-panel-icon"><i class="pi pi-arrow-up-right"></i></span>
              <h2>الأصول</h2>
            </div>
            <span class="bs-panel-total">{{ fmt(sheet.total_assets) }}</span>
          </header>

          <div class="bs-section">
            <button
              type="button"
              class="bs-section-head"
              :aria-expanded="showCashDetails"
              @click="showCashDetails = !showCashDetails"
            >
              <span class="bs-section-icon bs-section-icon--cash"><i class="pi pi-money-bill"></i></span>
              <span class="bs-section-info">
                <span class="bs-section-title">نقدية وبنوك</span>
                <span class="bs-section-meta">{{ cashAccountCount }} حساب</span>
              </span>
              <span class="bs-section-amount">{{ fmt(financialAssetsTotal) }}</span>
              <i class="pi bs-section-chevron" :class="showCashDetails ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
            </button>
            <Transition name="bs-expand">
              <div v-show="showCashDetails" class="bs-section-body">
                <p v-if="!sheet.assets.length" class="bs-empty">
                  <i class="pi pi-inbox"></i>
                  لا توجد حسابات مالية
                </p>
                <div v-else class="bs-table-wrap">
                  <table class="bs-table">
                    <thead>
                      <tr>
                        <th>الحساب</th>
                        <th>النوع</th>
                        <th class="bs-td-num">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in sheet.assets" :key="row.id">
                        <td class="bs-td-strong">{{ row.name }}</td>
                        <td class="bs-td-muted">{{ financialAccountTypeLabel(row.type) }}</td>
                        <td class="bs-td-num">{{ fmt(row.balance) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Transition>
          </div>

          <div class="bs-section">
            <button
              type="button"
              class="bs-section-head"
              :aria-expanded="showIndebtedCustomersDetails"
              @click="showIndebtedCustomersDetails = !showIndebtedCustomersDetails"
            >
              <span class="bs-section-icon bs-section-icon--receivable"><i class="pi pi-users"></i></span>
              <span class="bs-section-info">
                <span class="bs-section-title">ذمم العملاء</span>
                <span class="bs-section-meta">{{ indebtedCustomerCount }} عميل</span>
              </span>
              <span class="bs-section-amount">{{ fmt(indebtedCustomersTotal) }}</span>
              <i class="pi bs-section-chevron" :class="showIndebtedCustomersDetails ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
            </button>
            <Transition name="bs-expand">
              <div v-show="showIndebtedCustomersDetails" class="bs-section-body">
                <p class="bs-stock-formula text-sm text-color-secondary m-0 mb-3">
                  رصيد سالب على العميل + المتبقي على فواتير البيع غير المسددة أو المسددة جزئياً
                </p>
                <p v-if="!indebtedCustomers.by_customer.length" class="bs-empty">
                  <i class="pi pi-inbox"></i>
                  لا توجد ذمم على العملاء
                </p>
                <div v-else class="bs-table-wrap">
                  <table class="bs-table">
                    <thead>
                      <tr>
                        <th>العميل</th>
                        <th class="bs-td-num">المبلغ المستحق</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in indebtedCustomers.by_customer" :key="row.id">
                        <td class="bs-td-strong">{{ row.name }}</td>
                        <td class="bs-td-num">{{ fmt(row.balance) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Transition>
          </div>

          <div class="bs-section">
            <button
              type="button"
              class="bs-section-head"
              :aria-expanded="showFixedDetails"
              @click="showFixedDetails = !showFixedDetails"
            >
              <span class="bs-section-icon bs-section-icon--fixed"><i class="pi pi-building"></i></span>
              <span class="bs-section-info">
                <span class="bs-section-title">أصول ثابتة</span>
                <span class="bs-section-meta">{{ fixedAssetCount }} أصل</span>
              </span>
              <span class="bs-section-amount">{{ fmt(fixedAssetsTotal) }}</span>
              <i class="pi bs-section-chevron" :class="showFixedDetails ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
            </button>
            <Transition name="bs-expand">
              <div v-show="showFixedDetails" class="bs-section-body">
                <p v-if="!fixedAssetsByCategory.length" class="bs-empty">
                  <i class="pi pi-inbox"></i>
                  لا توجد أصول ثابتة — أضفها من وحدة الأصول
                </p>
                <div v-else class="bs-table-wrap">
                  <table class="bs-table">
                    <thead>
                      <tr>
                        <th>فئة الأصل</th>
                        <th class="bs-td-count">العدد</th>
                        <th class="bs-td-num">القيمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in fixedAssetsByCategory" :key="row.key">
                        <td class="bs-td-strong">{{ row.category }}</td>
                        <td class="bs-td-count">
                          <span class="bs-badge">{{ row.count }}</span>
                        </td>
                        <td class="bs-td-num">{{ fmt(row.total) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Transition>
          </div>

          <div class="bs-section">
            <button
              type="button"
              class="bs-section-head"
              :aria-expanded="showStockDetails"
              @click="showStockDetails = !showStockDetails"
            >
              <span class="bs-section-icon bs-section-icon--stock"><i class="pi pi-box"></i></span>
              <span class="bs-section-info">
                <span class="bs-section-title">قيمة المخزون</span>
                <span class="bs-section-meta">بالتكلفة (شراء)</span>
              </span>
              <span class="bs-section-amount">{{ fmt(stockTotal) }}</span>
              <i class="pi bs-section-chevron" :class="showStockDetails ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
            </button>
            <Transition name="bs-expand">
              <div v-show="showStockDetails" class="bs-section-body">
                <p class="bs-stock-formula text-sm text-color-secondary m-0 mb-3">
                  قيمة المخزون = (الكمية الافتتاحية × سعر الشراء) + مشتريات مستلمة − مبيعات مصروفة (تكلفة)
                </p>
                <ul class="bs-stock-breakdown">
                  <li>
                    <span>رصيد افتتاحي (كمية × سعر شراء)</span>
                    <span class="bs-stock-amount">{{ fmt(stock.opening_value) }}</span>
                  </li>
                  <li>
                    <span>مشتريات مستلمة (أصناف تم استلامها فقط)</span>
                    <span class="bs-stock-amount">{{ fmt(stock.purchases) }}</span>
                  </li>
                  <li class="bs-stock-breakdown--deduct">
                    <span>مبيعات مصروفة (أصناف تم صرفها فقط — بالتكلفة)</span>
                    <span class="bs-stock-amount">− {{ fmt(stock.sales_cost) }}</span>
                  </li>
                  <li class="bs-stock-breakdown--total">
                    <span>قيمة المخزون</span>
                    <span class="bs-stock-amount">{{ fmt(stock.total) }}</span>
                  </li>
                </ul>
              </div>
            </Transition>
          </div>

          <footer class="bs-panel-foot bs-panel-foot--assets">
            <span>إجمالي الأصول</span>
            <span>{{ fmt(sheet.total_assets) }}</span>
          </footer>
        </section>

        <section class="bs-panel bs-panel--claims">
          <header class="bs-panel-head">
            <div class="bs-panel-head-main">
              <span class="bs-panel-icon"><i class="pi pi-arrow-down-left"></i></span>
              <h2>الالتزامات وحقوق الملكية</h2>
            </div>
            <span class="bs-panel-total">{{ fmt(liabilitiesPlusEquity) }}</span>
          </header>

          <div class="bs-section">
            <div class="bs-section-head bs-section-head--static">
              <span class="bs-section-icon bs-section-icon--liab"><i class="pi pi-file-edit"></i></span>
              <span class="bs-section-info">
                <span class="bs-section-title">الالتزامات</span>
              </span>
              <span class="bs-section-amount">{{ fmt(liabilitiesTotal) }}</span>
            </div>
            <div class="bs-section-body bs-section-body--flush">
              <p v-if="!hasLiabilityContent" class="bs-empty">
                <i class="pi pi-check-circle"></i>
                لا توجد التزامات مسجّلة
              </p>
              <template v-else>
                <ul v-if="liabilityRows.length" class="bs-liab-list">
                  <li v-for="row in liabilityRows" :key="row.key" class="bs-liab-item">
                    <span class="bs-liab-icon"><i class="pi" :class="row.icon"></i></span>
                    <div class="bs-liab-text">
                      <span class="bs-liab-label">{{ row.label }}</span>
                      <small>{{ row.hint }}</small>
                    </div>
                    <span class="bs-liab-amount">{{ fmt(row.amount) }}</span>
                  </li>
                </ul>

                <div class="bs-section bs-section--nested">
                  <button
                    type="button"
                    class="bs-section-head"
                    :aria-expanded="showSupplierPayablesDetails"
                    @click="showSupplierPayablesDetails = !showSupplierPayablesDetails"
                  >
                    <span class="bs-section-icon bs-section-icon--supplier"><i class="pi pi-truck"></i></span>
                    <span class="bs-section-info">
                      <span class="bs-section-title">ذمم الموردين</span>
                      <span class="bs-section-meta">{{ supplierPayablesCount }} مورد</span>
                    </span>
                    <span class="bs-section-amount">{{ fmt(supplierPayablesTotal) }}</span>
                    <i class="pi bs-section-chevron" :class="showSupplierPayablesDetails ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                  </button>
                  <Transition name="bs-expand">
                    <div v-show="showSupplierPayablesDetails" class="bs-section-body">
                      <p class="bs-stock-formula text-sm text-color-secondary m-0 mb-3">
                        المتبقي على فواتير الشراء غير المسددة أو المسددة جزئياً
                      </p>
                      <p v-if="!supplierPayables.by_supplier.length" class="bs-empty">
                        <i class="pi pi-inbox"></i>
                        لا توجد ذمم على الموردين
                      </p>
                      <div v-else class="bs-table-wrap">
                        <table class="bs-table">
                          <thead>
                            <tr>
                              <th>المورد</th>
                              <th class="bs-td-num">المبلغ</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="row in supplierPayables.by_supplier" :key="row.id">
                              <td class="bs-td-strong">{{ row.name }}</td>
                              <td class="bs-td-num">{{ fmt(row.balance) }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </Transition>
                </div>

                <div class="bs-section bs-section--nested">
                  <button
                    type="button"
                    class="bs-section-head"
                    :aria-expanded="showCreditCustomersDetails"
                    @click="showCreditCustomersDetails = !showCreditCustomersDetails"
                  >
                    <span class="bs-section-icon bs-section-icon--credit"><i class="pi pi-user"></i></span>
                    <span class="bs-section-info">
                      <span class="bs-section-title">أرصدة عملاء دائنة</span>
                      <span class="bs-section-meta">{{ creditCustomerCount }} عميل</span>
                    </span>
                    <span class="bs-section-amount">{{ fmt(creditCustomersTotal) }}</span>
                    <i class="pi bs-section-chevron" :class="showCreditCustomersDetails ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                  </button>
                  <Transition name="bs-expand">
                    <div v-show="showCreditCustomersDetails" class="bs-section-body">
                      <p class="bs-stock-formula text-sm text-color-secondary m-0 mb-3">
                        رصيد عميل موجب + قيمة أصناف فواتير البيع لم تُصرف بعد
                      </p>
                      <p v-if="!creditCustomers.by_customer.length" class="bs-empty">
                        <i class="pi pi-inbox"></i>
                        لا توجد أرصدة دائنة على العملاء
                      </p>
                      <div v-else class="bs-table-wrap">
                        <table class="bs-table">
                          <thead>
                            <tr>
                              <th>العميل</th>
                              <th class="bs-td-num">المبلغ</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="row in creditCustomers.by_customer" :key="row.id">
                              <td class="bs-td-strong">{{ row.name }}</td>
                              <td class="bs-td-num">{{ fmt(row.balance) }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </Transition>
                </div>

                <div class="bs-inline-total">
                  <span>مجموع الالتزامات</span>
                  <span>{{ fmt(liabilitiesTotal) }}</span>
                </div>
              </template>
            </div>
          </div>

          <div class="bs-section bs-section--equity">
            <div class="bs-section-head bs-section-head--static">
              <span class="bs-section-icon bs-section-icon--equity"><i class="pi pi-shield"></i></span>
              <span class="bs-section-info">
                <span class="bs-section-title">حقوق الملكية</span>
              </span>
              <span class="bs-section-amount">{{ fmt(equityTotal) }}</span>
            </div>
            <div class="bs-section-body">
              <p class="bs-equity-desc">
                صافي ما يعود للمنشأة بعد خصم الالتزامات من الأصول.
              </p>
              <p v-if="(sheet.partners_equity ?? 0) > 0" class="bs-equity-extra">
                <i class="pi pi-info-circle"></i>
                يشمل جاري شركاء موجب: <strong>{{ fmt(sheet.partners_equity) }}</strong>
              </p>
            </div>
          </div>

          <footer class="bs-panel-foot bs-panel-foot--claims">
            <span>الالتزامات + حقوق الملكية</span>
            <span>{{ fmt(liabilitiesPlusEquity) }}</span>
          </footer>
        </section>
      </div>
    </template>
  </FinancialReportShell>
</template>
