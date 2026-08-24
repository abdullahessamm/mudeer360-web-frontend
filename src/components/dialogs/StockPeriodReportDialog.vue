<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import { formatQty, formatIssuedAt } from '@/lib/format'
import { showError } from '@/composables/useToast'
import { useProductsStore } from '@/stores/products'
import { useProductCategoriesStore } from '@/stores/productCategories'
import { getErrorMessage } from '@/api/utils'
import type { StockPeriodReportItem, StockPeriodReportSummary } from '@/types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

const productsStore = useProductsStore()
const categoriesStore = useProductCategoriesStore()

const dateRange = ref<Date[] | null>(null)
const selectedCategoryId = ref<number | null>(null)
const searchQuery = ref('')
const lowStockOnly = ref(false)

const loading = ref(false)

const items = ref<StockPeriodReportItem[]>([])
const summary = ref<StockPeriodReportSummary>({
  total_products: 0,
  total_opening_quantity: 0,
  total_ending_quantity: 0,
})

const categoryOptions = computed(() => {
  const list = categoriesStore.allCategories.length
    ? categoriesStore.allCategories
    : categoriesStore.items
  return [{ label: '— كل الفئات —', value: null }, ...list.map((c) => ({ label: c.name, value: c.id }))]
})

const selectedCategoryLabel = computed(() => {
  if (!selectedCategoryId.value) return 'جميع الفئات'
  const match = categoryOptions.value.find((c) => c.value === selectedCategoryId.value)
  return match?.label ?? 'جميع الفئات'
})

const periodLabel = computed(() => {
  const range = dateRange.value
  if (!range?.[0] || !range?.[1]) return '—'
  return `من ${formatDateLocal(range[0])} إلى ${formatDateLocal(range[1])}`
})

function setPreset(preset: 'today' | 'this_month' | 'last_30_days' | 'this_year') {
  const today = new Date()
  if (preset === 'today') {
    dateRange.value = [new Date(), new Date()]
  } else if (preset === 'this_month') {
    const [start, end] = getCurrentMonthRange()
    dateRange.value = [start, end]
  } else if (preset === 'last_30_days') {
    const start = new Date()
    start.setDate(today.getDate() - 30)
    dateRange.value = [start, today]
  } else if (preset === 'this_year') {
    const start = new Date(today.getFullYear(), 0, 1)
    const end = new Date(today.getFullYear(), 11, 31)
    dateRange.value = [start, end]
  }
  loadReport()
}

async function loadReport() {
  const range = dateRange.value
  if (!range?.[0] || !range?.[1]) {
    showError('يرجى تحديد تاريخ البداية وتاريخ النهاية')
    return
  }

  loading.value = true
  try {
    const payload = await productsStore.fetchStockPeriodReport({
      date_from: formatDateLocal(range[0]),
      date_to: formatDateLocal(range[1]),
      product_category_id: selectedCategoryId.value,
      search: searchQuery.value,
      low_stock: lowStockOnly.value,
    })
    items.value = payload.items ?? []
    summary.value = payload.summary ?? {
      total_products: 0,
      total_opening_quantity: 0,
      total_ending_quantity: 0,
    }
  } catch (err) {
    showError(getErrorMessage(err, 'فشل تحميل تقرير حركة المخزون بالفترة'))
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (!dateRange.value) {
        const [start, end] = getCurrentMonthRange()
        dateRange.value = [start, end]
      }
      if (categoriesStore.allCategories.length === 0) {
        categoriesStore.fetchAllForSelect()
      }
      loadReport()
    }
  },
  { immediate: true },
)

function onClose() {
  emit('update:visible', false)
}

function handlePrint() {
  if (items.value.length === 0) {
    showError('لا توجد بيانات للطباعة')
    return
  }

  const printWindow = window.open('', '_blank', 'width=1100,height=800')
  if (!printWindow) {
    showError('يرجى السماح بالنوافذ المنبثقة للطباعة')
    return
  }

  const tableRowsHtml = items.value.map((item, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td style="font-family: monospace; font-size: 12px;">${item.product_code || '—'}</td>
      <td style="font-weight: bold;">${item.name}</td>
      <td>${item.category_name || '—'}</td>
      <td>${item.unit || '—'}</td>
      <td style="text-align: center; font-weight: 600;">${formatQty(item.opening_quantity)}</td>
      <td style="text-align: center; font-weight: 600;">${formatQty(item.ending_quantity)}</td>
      <td style="text-align: center; color: #555;">${formatQty(item.current_quantity)}</td>
    </tr>
  `).join('')

  const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير حركة وأرصدة المخزون بالفترة</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, Arial;
      background: #ffffff;
      color: #111111;
      padding: 8px 12px;
      font-size: 11.5px;
      direction: rtl;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #222;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 17px;
      margin-bottom: 3px;
      color: #111;
    }
    .header .subtitle {
      font-size: 11px;
      color: #555;
    }
    .meta-box {
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 10.5px;
      line-height: 1.5;
      background: #fdfdfd;
      text-align: left;
    }
    .summary-strip {
      display: flex;
      gap: 24px;
      background: #f4f6f8;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 6px 12px;
      margin-bottom: 12px;
      font-size: 11.5px;
    }
    .summary-item {
      display: flex;
      gap: 6px;
    }
    .summary-item strong {
      color: #0b5ed7;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 11px;
    }
    th {
      background: #eaedf1 !important;
      color: #111;
      font-weight: bold;
      border: 1px solid #b5bec8;
      padding: 6px 7px;
      text-align: right;
    }
    td {
      border: 1px solid #d0d7de;
      padding: 5px 7px;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #f9fafb;
    }
    tfoot td {
      background: #eaedf1 !important;
      font-weight: bold;
      border-top: 2px solid #333;
      padding: 6px 7px;
    }
    .footer {
      margin-top: 20px;
      padding-top: 6px;
      border-top: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>تقرير حركة وأرصدة المخزون حسب الفترة</h1>
      <div class="subtitle">نظام مدير 360 لإدارة الأعمال</div>
    </div>
    <div class="meta-box">
      <div><strong>الفترة:</strong> ${periodLabel.value}</div>
      <div><strong>تاريخ الطباعة:</strong> ${formatIssuedAt(Date.now())}</div>
      <div><strong>الفئة:</strong> ${selectedCategoryLabel.value}</div>
      ${lowStockOnly.value ? '<div><strong>الحالة:</strong> المنتجات ذات الرصيد المنخفض فقط</div>' : ''}
    </div>
  </div>

  <div class="summary-strip">
    <div class="summary-item">
      <span>عدد المنتجات:</span>
      <strong>${summary.value.total_products}</strong>
    </div>
    <div class="summary-item">
      <span>إجمالي رصيد أول الفترة:</span>
      <strong>${formatQty(summary.value.total_opening_quantity)}</strong>
    </div>
    <div class="summary-item">
      <span>إجمالي رصيد آخر الفترة:</span>
      <strong>${formatQty(summary.value.total_ending_quantity)}</strong>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 35px; text-align: center;">#</th>
        <th style="width: 120px;">كود المنتج</th>
        <th>اسم المنتج</th>
        <th>الفئة</th>
        <th style="width: 70px;">الوحدة</th>
        <th style="width: 120px; text-align: center;">رصيد أول الفترة</th>
        <th style="width: 120px; text-align: center;">رصيد آخر الفترة</th>
        <th style="width: 110px; text-align: center;">الرصيد الحالي</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align: left; padding-left: 10px;">الإجمالي الكلي:</td>
        <td style="text-align: center;">${formatQty(summary.value.total_opening_quantity)}</td>
        <td style="text-align: center;">${formatQty(summary.value.total_ending_quantity)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div>تم إنشاء هذا التقرير آلياً عبر نظام <strong>مدير 360</strong></div>
    <div>صفحة 1 من 1</div>
  </div>

  <script>
    window.onload = function() {
      window.focus();
      window.print();
    };
  <\/script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(printHtml)
  printWindow.document.close()
}
</script>

<template>
  <Dialog
    :visible="visible"
    :modal="true"
    :header="'تقرير المخزون حسب الفترة (رصيد أول وآخر الفترة)'"
    :style="{ width: '95vw', maxWidth: '1200px' }"
    :content-style="{ maxHeight: '82vh', overflow: 'auto' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="stock-period-report-wrapper" dir="rtl">
      <!-- Screen Filters Bar -->
      <div class="report-filters-bar flex flex-column gap-3 mb-4 p-3 border-round surface-card border-1 surface-border">
        <div class="flex flex-wrap align-items-center gap-3">
          <div class="flex flex-column gap-1">
            <label for="spr-date-range" class="text-xs font-semibold text-color-secondary">الفترة الزمنية</label>
            <DatePicker
              id="spr-date-range"
              v-model="dateRange"
              selection-mode="range"
              :manual-input="false"
              date-format="yy-mm-dd"
              placeholder="من — إلى"
              show-icon
              icon-display="input"
              class="w-18rem"
            />
          </div>

          <div class="flex flex-column gap-1">
            <label for="spr-category" class="text-xs font-semibold text-color-secondary">الفئة</label>
            <Select
              id="spr-category"
              v-model="selectedCategoryId"
              :options="categoryOptions"
              option-label="label"
              option-value="value"
              placeholder="تصفية بالفئة"
              class="w-14rem"
            />
          </div>

          <div class="flex flex-column gap-1">
            <label for="spr-search" class="text-xs font-semibold text-color-secondary">بحث (اسم / كود)</label>
            <IconField icon-position="left" class="w-14rem">
              <InputIcon class="pi pi-search" />
              <InputText
                id="spr-search"
                v-model="searchQuery"
                placeholder="اسم المنتج أو الكود..."
                class="w-full"
                @keydown.enter="loadReport"
              />
            </IconField>
          </div>

          <div class="flex align-items-center gap-2 mt-auto pb-2">
            <Checkbox
              v-model="lowStockOnly"
              input-id="spr-low-stock"
              :binary="true"
            />
            <label for="spr-low-stock" class="cursor-pointer text-xs font-medium">رصيد منخفض فقط</label>
          </div>

          <div class="flex align-items-center gap-2 mt-auto pb-1 mr-auto">
            <Button
              label="تطبيق التصفية"
              icon="pi pi-filter"
              :loading="loading"
              @click="loadReport"
            />
            <Button
              label="طباعة"
              icon="pi pi-print"
              severity="secondary"
              outlined
              @click="handlePrint"
            />
          </div>
        </div>

        <!-- Quick Presets -->
        <div class="flex align-items-center gap-2 flex-wrap pt-1 border-top-1 surface-border">
          <span class="text-xs text-color-secondary">فترات سريعة:</span>
          <Button label="اليوم" size="small" text @click="setPreset('today')" />
          <Button label="هذا الشهر" size="small" text @click="setPreset('this_month')" />
          <Button label="آخر 30 يوم" size="small" text @click="setPreset('last_30_days')" />
          <Button label="هذا العام" size="small" text @click="setPreset('this_year')" />
        </div>
      </div>

      <!-- Screen KPI Summary Cards -->
      <div class="grid mb-4">
        <div class="col-12 md:col-4">
          <div class="kpi-card p-3 border-round border-1 surface-border surface-card flex align-items-center gap-3">
            <div class="kpi-icon bg-blue-100 text-blue-700 border-circle flex align-items-center justify-content-center w-3rem h-3rem">
              <i class="pi pi-box text-xl"></i>
            </div>
            <div>
              <div class="text-xs text-color-secondary font-medium">عدد المنتجات</div>
              <div class="text-2xl font-bold text-900">{{ summary.total_products }}</div>
            </div>
          </div>
        </div>

        <div class="col-12 md:col-4">
          <div class="kpi-card p-3 border-round border-1 surface-border surface-card flex align-items-center gap-3">
            <div class="kpi-icon bg-amber-100 text-amber-700 border-circle flex align-items-center justify-content-center w-3rem h-3rem">
              <i class="pi pi-clock text-xl"></i>
            </div>
            <div>
              <div class="text-xs text-color-secondary font-medium">إجمالي رصيد أول الفترة</div>
              <div class="text-2xl font-bold text-amber-700">{{ formatQty(summary.total_opening_quantity) }}</div>
            </div>
          </div>
        </div>

        <div class="col-12 md:col-4">
          <div class="kpi-card p-3 border-round border-1 surface-border surface-card flex align-items-center gap-3">
            <div class="kpi-icon bg-green-100 text-green-700 border-circle flex align-items-center justify-content-center w-3rem h-3rem">
              <i class="pi pi-check-circle text-xl"></i>
            </div>
            <div>
              <div class="text-xs text-color-secondary font-medium">إجمالي رصيد آخر الفترة</div>
              <div class="text-2xl font-bold text-green-700">{{ formatQty(summary.total_ending_quantity) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Screen DataTable with pagination -->
      <div class="screen-table-wrap">
        <DataTable
          :value="items"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          class="p-datatable-sm shadow-1 border-round"
          :loading="loading"
          paginator
          :rows="15"
          :rows-per-page-options="[15, 30, 50, 100]"
        >
          <template #empty>
            <div class="p-4 text-center text-color-secondary">
              <i class="pi pi-inbox text-4xl mb-2"></i>
              <p class="m-0">لا توجد منتجات مطابقة للفترة المحددة</p>
            </div>
          </template>

          <Column field="product_code" header="كود المنتج" style="width: 140px">
            <template #body="{ data }">
              <span class="font-mono text-sm">{{ data.product_code ?? '—' }}</span>
            </template>
          </Column>

          <Column field="name" header="اسم المنتج">
            <template #body="{ data }">
              <div class="font-bold">{{ data.name }}</div>
            </template>
          </Column>

          <Column field="category_name" header="الفئة">
            <template #body="{ data }">
              <span class="text-sm text-color-secondary">{{ data.category_name ?? '—' }}</span>
            </template>
          </Column>

          <Column field="unit" header="الوحدة" style="width: 100px">
            <template #body="{ data }">
              <span>{{ data.unit ?? '—' }}</span>
            </template>
          </Column>

          <Column field="opening_quantity" header="الكمية الافتتاحية (أول الفترة)" style="width: 180px; text-align: center">
            <template #body="{ data }">
              <span class="font-semibold text-blue-700 bg-blue-50 px-2 py-1 border-round">
                {{ formatQty(data.opening_quantity) }}
              </span>
            </template>
          </Column>

          <Column field="ending_quantity" header="الكمية الختامية (آخر الفترة)" style="width: 180px; text-align: center">
            <template #body="{ data }">
              <span
                class="font-semibold px-2 py-1 border-round"
                :class="data.ending_quantity <= 0 ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50'"
              >
                {{ formatQty(data.ending_quantity) }}
              </span>
            </template>
          </Column>

          <Column field="current_quantity" header="الرصيد الفعلي الحالي" style="width: 150px; text-align: center">
            <template #body="{ data }">
              <span class="text-color-secondary">{{ formatQty(data.current_quantity) }}</span>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-content-between align-items-center w-full">
        <span class="text-xs text-color-secondary">
          الفترة: {{ periodLabel }}
        </span>
        <Button label="إغلاق" icon="pi pi-times" text severity="secondary" @click="onClose" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.stock-period-report-wrapper {
  font-family: inherit;
}

.kpi-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
</style>
