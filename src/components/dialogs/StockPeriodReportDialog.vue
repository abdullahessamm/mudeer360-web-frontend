<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ColumnGroup from 'primevue/columngroup'
import Row from 'primevue/row'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import { formatQty, formatMoney, formatIssuedAt } from '@/lib/format'
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

const activePreset = ref<'today' | 'this_month' | 'last_30_days' | 'this_year' | 'custom'>('this_month')
const dateRange = ref<Date[] | null>(null)
const selectedCategoryId = ref<number | null>(null)
const searchQuery = ref('')
const lowStockOnly = ref(false)

const loading = ref(false)

const items = ref<StockPeriodReportItem[]>([])
const summary = ref<StockPeriodReportSummary>({
  total_products: 0,
  total_opening_quantity: 0,
  total_opening_value: 0,
  total_ending_quantity: 0,
  total_ending_value: 0,
})

const categoryOptions = computed(() => {
  const list = categoriesStore.allCategories.length
    ? categoriesStore.allCategories
    : categoriesStore.items
  return [{ label: 'جميع الفئات', value: null }, ...list.map((c) => ({ label: c.name, value: c.id }))]
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

const totalOpeningValue = computed(() => {
  if (summary.value.total_opening_value != null && summary.value.total_opening_value > 0) {
    return summary.value.total_opening_value
  }
  return items.value.reduce((acc, item) => {
    const val = item.opening_value ?? ((item.opening_quantity || 0) * (item.purchase_price || 0))
    return acc + Number(val || 0)
  }, 0)
})

const totalEndingValue = computed(() => {
  if (summary.value.total_ending_value != null && summary.value.total_ending_value > 0) {
    return summary.value.total_ending_value
  }
  return items.value.reduce((acc, item) => {
    const val = item.ending_value ?? ((item.ending_quantity || 0) * (item.purchase_price || 0))
    return acc + Number(val || 0)
  }, 0)
})

const netValueDifference = computed(() => {
  return totalEndingValue.value - totalOpeningValue.value
})

const netQuantityDifference = computed(() => {
  return (summary.value.total_ending_quantity || 0) - (summary.value.total_opening_quantity || 0)
})

function setPreset(preset: 'today' | 'this_month' | 'last_30_days' | 'this_year') {
  activePreset.value = preset
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
  loadReport(false)
}

function resetFilters() {
  const [start, end] = getCurrentMonthRange()
  dateRange.value = [start, end]
  activePreset.value = 'this_month'
  selectedCategoryId.value = null
  searchQuery.value = ''
  lowStockOnly.value = false
  loadReport(false)
}

async function loadReport(silent = false) {
  const range = dateRange.value
  if (!range?.[0] || !range?.[1]) {
    if (!silent) {
      showError('يرجى تحديد تاريخ البداية وتاريخ النهاية')
    }
    return
  }

  loading.value = true
  try {
    const payload = await productsStore.fetchStockPeriodReport({
      date_from: formatDateLocal(range[0]),
      date_to: formatDateLocal(range[1]),
      product_category_id: selectedCategoryId.value ? Number(selectedCategoryId.value) : undefined,
      search: searchQuery.value?.trim() ? searchQuery.value.trim() : undefined,
      low_stock: lowStockOnly.value ? true : undefined,
    })
    items.value = payload.items ?? []
    summary.value = payload.summary ?? {
      total_products: 0,
      total_opening_quantity: 0,
      total_opening_value: 0,
      total_ending_quantity: 0,
      total_ending_value: 0,
    }
  } catch (err) {
    if (!silent) {
      showError(getErrorMessage(err, 'فشل تحميل تقرير حركة المخزون بالفترة'))
    }
    items.value = []
  } finally {
    loading.value = false
  }
}

// Watch dateRange for automatic refresh when both dates are selected
watch(
  () => dateRange.value,
  (newRange) => {
    if (newRange && newRange[0] && newRange[1]) {
      loadReport(true)
    }
  },
  { deep: true },
)

// Watch category filter
watch(
  () => selectedCategoryId.value,
  () => {
    if (props.visible) {
      loadReport(true)
    }
  },
)

// Watch low stock checkbox
watch(
  () => lowStockOnly.value,
  () => {
    if (props.visible) {
      loadReport(true)
    }
  },
)

// Debounced watch on search query
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => searchQuery.value,
  () => {
    if (!props.visible) return
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      loadReport(true)
    }, 350)
  },
)

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (!dateRange.value) {
        const [start, end] = getCurrentMonthRange()
        dateRange.value = [start, end]
        activePreset.value = 'this_month'
      }
      if (categoriesStore.allCategories.length === 0) {
        categoriesStore.fetchAllForSelect()
      }
      loadReport(true)
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

  const printWindow = window.open('', '_blank', 'width=1150,height=850')
  if (!printWindow) {
    showError('يرجى السماح بالنوافذ المنبثقة للطباعة')
    return
  }

  const tableRowsHtml = items.value.map((item, idx) => {
    const openingValue = item.opening_value ?? ((item.opening_quantity || 0) * (item.purchase_price || 0))
    const endingValue = item.ending_value ?? ((item.ending_quantity || 0) * (item.purchase_price || 0))
    return `
    <tr>
      <td style="text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="font-family: monospace; font-size: 11px; font-weight: 600;">${item.product_code || '—'}</td>
      <td style="font-weight: 600; color: #0f172a;">${item.name}</td>
      <td style="color: #475569;">${item.category_name || '—'}</td>
      <td style="text-align: center; color: #64748b;">${item.unit || '—'}</td>
      <td style="text-align: left; font-family: monospace; font-weight: 500;">${formatMoney(item.purchase_price)}</td>
      <td style="text-align: center; font-weight: 600; color: #1e293b;">${formatQty(item.opening_quantity)}</td>
      <td style="text-align: left; font-weight: 700; color: #4338ca; background: #f5f7ff;">${formatMoney(openingValue)}</td>
      <td style="text-align: center; font-weight: 600; color: #1e293b;">${formatQty(item.ending_quantity)}</td>
      <td style="text-align: left; font-weight: 700; color: #0f766e; background: #f0fdfa;">${formatMoney(endingValue)}</td>
      <td style="text-align: center; font-weight: 600; color: #334155;">${formatQty(item.current_quantity)}</td>
    </tr>
  `
  }).join('')

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
      color: #0f172a;
      padding: 10px 14px;
      font-size: 11px;
      direction: rtl;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 17px;
      margin-bottom: 3px;
      color: #0369a1;
      font-weight: 800;
    }
    .header .subtitle {
      font-size: 11px;
      color: #64748b;
    }
    .meta-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 10.5px;
      line-height: 1.5;
      background: #f8fafc;
      text-align: left;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    .summary-card {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 6px;
      padding: 8px 12px;
    }
    .summary-card-title {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 2px;
    }
    .summary-card-val {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 10.5px;
    }
    thead th {
      background: #f1f5f9 !important;
      color: #1e293b;
      font-weight: 700;
      border: 1px solid #cbd5e1;
      padding: 6px 6px;
      text-align: right;
    }
    thead th.group-opening {
      background: #eef2ff !important;
      color: #3730a3;
      border-bottom: 2px solid #6366f1;
    }
    thead th.group-ending {
      background: #f0fdf4 !important;
      color: #065f46;
      border-bottom: 2px solid #10b981;
    }
    td {
      border: 1px solid #e2e8f0;
      padding: 5px 6px;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    tfoot td {
      background: #f1f5f9 !important;
      font-weight: 800;
      border-top: 2px solid #0f172a;
      padding: 7px 6px;
    }
    .footer {
      margin-top: 20px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>تقرير حركة وأرصدة المخزون حسب الفترة</h1>
      <div class="subtitle">نظام مدير 360 لإدارة الأعمال — كشف حركة الأرصدة والتقييم المالي</div>
    </div>
    <div class="meta-box">
      <div><strong>الفترة:</strong> ${periodLabel.value}</div>
      <div><strong>تاريخ الطباعة:</strong> ${formatIssuedAt(Date.now())}</div>
      <div><strong>الفئة:</strong> ${selectedCategoryLabel.value}</div>
      ${lowStockOnly.value ? '<div><strong>تصفية:</strong> الأصناف ذات الرصيد المنخفض فقط</div>' : ''}
    </div>
  </div>

  <div class="summary-cards">
    <div class="summary-card">
      <div class="summary-card-title">إجمالي الأصناف</div>
      <div class="summary-card-val">${summary.value.total_products} <span style="font-size: 11px; font-weight: normal; color: #64748b;">منتج</span></div>
    </div>
    <div class="summary-card">
      <div class="summary-card-title">بضاعة أول الفترة (افتتاحي)</div>
      <div class="summary-card-val" style="color: #4338ca;">${formatMoney(totalOpeningValue.value)}</div>
      <div style="font-size: 10px; color: #64748b;">الكمية: ${formatQty(summary.value.total_opening_quantity)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-title">بضاعة آخر الفترة (ختامي)</div>
      <div class="summary-card-val" style="color: #0f766e;">${formatMoney(totalEndingValue.value)}</div>
      <div style="font-size: 10px; color: #64748b;">الكمية: ${formatQty(summary.value.total_ending_quantity)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-title">صافي التغير المالي</div>
      <div class="summary-card-val" style="color: ${netValueDifference.value >= 0 ? '#15803d' : '#b91c1c'};">
        ${netValueDifference.value >= 0 ? '+' : ''}${formatMoney(netValueDifference.value)}
      </div>
      <div style="font-size: 10px; color: #64748b;">تغير الكمية: ${netQuantityDifference.value >= 0 ? '+' : ''}${formatQty(netQuantityDifference.value)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width: 32px; text-align: center;">#</th>
        <th rowspan="2" style="width: 95px;">كود المنتج</th>
        <th rowspan="2">اسم المنتج</th>
        <th rowspan="2" style="width: 85px;">الفئة</th>
        <th rowspan="2" style="width: 50px; text-align: center;">الوحدة</th>
        <th rowspan="2" style="width: 75px; text-align: left;">سعر الشراء</th>
        <th colspan="2" class="group-opening" style="text-align: center;">أول الفترة (الافتتاحي)</th>
        <th colspan="2" class="group-ending" style="text-align: center;">آخر الفترة (الختامي)</th>
        <th rowspan="2" style="width: 75px; text-align: center;">الرصيد الحالي</th>
      </tr>
      <tr>
        <th class="group-opening" style="width: 80px; text-align: center;">الكمية</th>
        <th class="group-opening" style="width: 90px; text-align: left;">القيمة</th>
        <th class="group-ending" style="width: 80px; text-align: center;">الكمية</th>
        <th class="group-ending" style="width: 90px; text-align: left;">القيمة</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="6" style="text-align: left; padding-left: 10px;">الإجمالي الكلي (${summary.value.total_products} منتج):</td>
        <td style="text-align: center;">${formatQty(summary.value.total_opening_quantity)}</td>
        <td style="text-align: left; color: #4338ca;">${formatMoney(totalOpeningValue.value)}</td>
        <td style="text-align: center;">${formatQty(summary.value.total_ending_quantity)}</td>
        <td style="text-align: left; color: #0f766e;">${formatMoney(totalEndingValue.value)}</td>
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
    :style="{ width: '96vw', maxWidth: '1420px' }"
    :content-style="{ maxHeight: '85vh', overflow: 'auto', padding: '1.25rem' }"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <div class="flex align-items-center justify-content-between w-full" dir="rtl">
        <div class="flex align-items-center gap-3">
          <div class="report-header-icon flex align-items-center justify-content-center">
            <i class="pi pi-chart-bar text-xl text-primary"></i>
          </div>
          <div>
            <div class="text-lg font-bold text-900">تقرير حركة وأرصدة المخزون حسب الفترة</div>
            <div class="text-xs text-color-secondary mt-1">
              مقارنة دقيقة بين رصيد وقيمة أول الفترة وآخر الفترة مع التقييم المالي للأصناف
            </div>
          </div>
        </div>
      </div>
    </template>

    <div class="stock-period-report-wrapper" dir="rtl">
      <!-- Modern Filters Card -->
      <div class="filter-glass-card mb-4">
        <!-- Quick Preset Segmented Pills -->
        <div class="flex flex-wrap align-items-center justify-content-between gap-2 pb-3 mb-3 border-bottom-1 surface-border">
          <div class="flex align-items-center gap-1 flex-wrap">
            <span class="text-xs font-semibold text-color-secondary ml-2 flex align-items-center gap-1">
              <i class="pi pi-calendar text-xs"></i>
              فترات سريعة:
            </span>
            <button
              type="button"
              class="preset-pill-btn"
              :class="{ active: activePreset === 'today' }"
              @click="setPreset('today')"
            >
              اليوم
            </button>
            <button
              type="button"
              class="preset-pill-btn"
              :class="{ active: activePreset === 'this_month' }"
              @click="setPreset('this_month')"
            >
              هذا الشهر
            </button>
            <button
              type="button"
              class="preset-pill-btn"
              :class="{ active: activePreset === 'last_30_days' }"
              @click="setPreset('last_30_days')"
            >
              آخر 30 يوم
            </button>
            <button
              type="button"
              class="preset-pill-btn"
              :class="{ active: activePreset === 'this_year' }"
              @click="setPreset('this_year')"
            >
              هذا العام
            </button>
          </div>

          <div class="flex align-items-center gap-2">
            <Button
              label="إعادة ضبط"
              icon="pi pi-replay"
              size="small"
              severity="secondary"
              text
              @click="resetFilters"
            />
            <Button
              label="طباعة"
              icon="pi pi-print"
              size="small"
              severity="secondary"
              outlined
              @click="handlePrint"
            />
          </div>
        </div>

        <!-- Filter Input Controls Row -->
        <div class="flex flex-wrap align-items-end gap-3">
          <div class="flex flex-column gap-1 flex-1 min-w-16rem">
            <label for="spr-date-range" class="text-xs font-semibold text-color-secondary">نطاق التواريخ</label>
            <DatePicker
              id="spr-date-range"
              v-model="dateRange"
              selection-mode="range"
              :manual-input="false"
              date-format="yy-mm-dd"
              placeholder="اختر تاريخ البداية والنهاية"
              show-icon
              icon-display="input"
              class="w-full"
              @date-select="activePreset = 'custom'"
            />
          </div>

          <div class="flex flex-column gap-1 flex-1 min-w-12rem">
            <label for="spr-category" class="text-xs font-semibold text-color-secondary">الفئة</label>
            <Select
              id="spr-category"
              v-model="selectedCategoryId"
              :options="categoryOptions"
              option-label="label"
              option-value="value"
              placeholder="جميع الفئات"
              class="w-full"
            />
          </div>

          <div class="flex flex-column gap-1 flex-1 min-w-14rem">
            <label for="spr-search" class="text-xs font-semibold text-color-secondary">بحث (اسم / كود)</label>
            <IconField icon-position="left" class="w-full">
              <InputIcon class="pi pi-search" />
              <InputText
                id="spr-search"
                v-model="searchQuery"
                placeholder="اسم المنتج أو الكود..."
                class="w-full"
                @keydown.enter="loadReport(false)"
              />
            </IconField>
          </div>

          <div class="flex align-items-center gap-2 pb-2">
            <Checkbox
              v-model="lowStockOnly"
              input-id="spr-low-stock"
              :binary="true"
            />
            <label for="spr-low-stock" class="cursor-pointer text-xs font-medium text-700 whitespace-nowrap">
              رصيد منخفض فقط
            </label>
          </div>

          <div class="flex align-items-center gap-2 pb-1 mr-auto">
            <Button
              label="تطبيق التصفية"
              icon="pi pi-filter"
              size="small"
              :loading="loading"
              @click="loadReport(false)"
            />
          </div>
        </div>
      </div>

      <!-- Modern Dashboard Summary Cards -->
      <div class="grid mb-4">
        <!-- Products Count -->
        <div class="col-12 sm:col-6 lg:col-3">
          <div class="modern-kpi-card card-blue">
            <div class="flex align-items-center justify-content-between mb-2">
              <span class="kpi-label">عدد الأصناف المدرجة</span>
              <div class="kpi-icon-wrap bg-blue-50 text-blue-600">
                <i class="pi pi-box"></i>
              </div>
            </div>
            <div class="kpi-main-val text-900">{{ summary.total_products }} <span class="text-xs font-normal text-color-secondary">صنف</span></div>
            <div class="kpi-sub-text">
              <i class="pi pi-filter text-xs"></i>
              {{ selectedCategoryLabel }}
            </div>
          </div>
        </div>

        <!-- Opening Period -->
        <div class="col-12 sm:col-6 lg:col-3">
          <div class="modern-kpi-card card-indigo">
            <div class="flex align-items-center justify-content-between mb-2">
              <span class="kpi-label">بضاعة أول الفترة (افتتاحي)</span>
              <div class="kpi-icon-wrap bg-indigo-50 text-indigo-600">
                <i class="pi pi-history"></i>
              </div>
            </div>
            <div class="kpi-main-val text-indigo-700">{{ formatMoney(totalOpeningValue) }}</div>
            <div class="kpi-sub-text text-indigo-900 font-medium">
              الكمية: <strong>{{ formatQty(summary.total_opening_quantity) }}</strong> وحدة
            </div>
          </div>
        </div>

        <!-- Ending Period -->
        <div class="col-12 sm:col-6 lg:col-3">
          <div class="modern-kpi-card card-emerald">
            <div class="flex align-items-center justify-content-between mb-2">
              <span class="kpi-label">بضاعة آخر الفترة (ختامي)</span>
              <div class="kpi-icon-wrap bg-teal-50 text-teal-600">
                <i class="pi pi-check-circle"></i>
              </div>
            </div>
            <div class="kpi-main-val text-teal-700">{{ formatMoney(totalEndingValue) }}</div>
            <div class="kpi-sub-text text-teal-900 font-medium">
              الكمية: <strong>{{ formatQty(summary.total_ending_quantity) }}</strong> وحدة
            </div>
          </div>
        </div>

        <!-- Net Movement / Difference -->
        <div class="col-12 sm:col-6 lg:col-3">
          <div class="modern-kpi-card card-purple">
            <div class="flex align-items-center justify-content-between mb-2">
              <span class="kpi-label">صافي التغير بالفترة</span>
              <div class="kpi-icon-wrap" :class="netValueDifference >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'">
                <i :class="netValueDifference >= 0 ? 'pi pi-arrow-up-right' : 'pi pi-arrow-down-right'"></i>
              </div>
            </div>
            <div class="kpi-main-val" :class="netValueDifference >= 0 ? 'text-green-700' : 'text-red-700'">
              {{ netValueDifference >= 0 ? '+' : '' }}{{ formatMoney(netValueDifference) }}
            </div>
            <div class="kpi-sub-text" :class="netQuantityDifference >= 0 ? 'text-green-800' : 'text-red-800'">
              فرق الكمية: <strong>{{ netQuantityDifference >= 0 ? '+' : '' }}{{ formatQty(netQuantityDifference) }}</strong> وحدة
            </div>
          </div>
        </div>
      </div>

      <!-- Modern Readable DataTable -->
      <div class="modern-table-container">
        <DataTable
          :value="items"
          data-key="id"
          responsive-layout="scroll"
          class="modern-stock-table p-datatable-sm"
          :loading="loading"
          paginator
          :rows="15"
          :rows-per-page-options="[15, 30, 50, 100]"
          paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
          current-page-report-template="عرض {first} إلى {last} من أصل {totalRecords} منتج"
        >
          <template #empty>
            <div class="p-5 text-center text-color-secondary">
              <div class="w-4rem h-4rem border-circle surface-100 flex align-items-center justify-content-center mx-auto mb-3">
                <i class="pi pi-search text-2xl text-400"></i>
              </div>
              <div class="text-base font-bold text-900 mb-1">لا توجد بيانات مطابقة</div>
              <p class="text-xs text-500 m-0">جرب تغيير الفترة الزمنية أو معايير البحث والتصفية</p>
            </div>
          </template>

          <!-- Grouped Header for Maximum Clarity and Readability -->
          <ColumnGroup type="header">
            <Row>
              <Column header="المنتج والبيانات الأساسية" :rowspan="2" style="min-width: 240px;" />
              <Column header="سعر الشراء" :rowspan="2" style="width: 110px; text-align: left;" />
              <Column header="أول الفترة (الافتتاحي)" :colspan="2" header-class="col-header-opening text-center" />
              <Column header="آخر الفترة (الختامي)" :colspan="2" header-class="col-header-ending text-center" />
              <Column header="الرصيد الحالي" :rowspan="2" style="width: 115px; text-align: center;" />
            </Row>
            <Row>
              <Column header="الكمية" header-class="col-header-sub-opening text-center" style="width: 110px;" />
              <Column header="القيمة" header-class="col-header-sub-opening text-left" style="width: 130px;" />
              <Column header="الكمية" header-class="col-header-sub-ending text-center" style="width: 110px;" />
              <Column header="القيمة" header-class="col-header-sub-ending text-left" style="width: 130px;" />
            </Row>
          </ColumnGroup>

          <!-- Product Details Cell (Name, Code, Category, Unit) -->
          <Column field="name">
            <template #body="{ data }">
              <div class="product-cell-wrapper py-1">
                <div class="flex align-items-center gap-2 mb-1">
                  <span class="product-title font-bold text-900">{{ data.name }}</span>
                  <span
                    v-if="data.min_quantity && data.current_quantity <= data.min_quantity"
                    class="low-stock-micro-tag"
                    title="الرصيد الحالي وصل للحد الأدنى أو أقل منه"
                  >
                    رصيد منخفض
                  </span>
                </div>
                <div class="product-meta-row flex align-items-center gap-2 flex-wrap">
                  <span v-if="data.product_code" class="code-pill font-mono">{{ data.product_code }}</span>
                  <span v-if="data.category_name" class="meta-item-text text-color-secondary">{{ data.category_name }}</span>
                  <span class="meta-item-unit">الوحدة: {{ data.unit ?? 'قطعة' }}</span>
                </div>
              </div>
            </template>
          </Column>

          <!-- Purchase Price -->
          <Column field="purchase_price" style="text-align: left;">
            <template #body="{ data }">
              <span class="font-mono text-sm font-semibold text-700">
                {{ formatMoney(data.purchase_price) }}
              </span>
            </template>
          </Column>

          <!-- Opening Quantity -->
          <Column field="opening_quantity" style="text-align: center;">
            <template #body="{ data }">
              <span class="font-mono font-semibold text-800 tabular-nums text-sm">
                {{ formatQty(data.opening_quantity) }}
              </span>
            </template>
          </Column>

          <!-- Opening Item Value (Quantity * Purchase Price) -->
          <Column style="text-align: left;">
            <template #body="{ data }">
              <span class="value-cell-badge opening-value font-mono tabular-nums">
                {{ formatMoney(data.opening_value ?? (data.opening_quantity * (data.purchase_price || 0))) }}
              </span>
            </template>
          </Column>

          <!-- Ending Quantity -->
          <Column field="ending_quantity" style="text-align: center;">
            <template #body="{ data }">
              <span
                class="font-mono font-semibold tabular-nums text-sm"
                :class="data.ending_quantity <= 0 ? 'text-red-600' : 'text-800'"
              >
                {{ formatQty(data.ending_quantity) }}
              </span>
            </template>
          </Column>

          <!-- Ending Item Value (Quantity * Purchase Price) -->
          <Column style="text-align: left;">
            <template #body="{ data }">
              <span
                class="value-cell-badge ending-value font-mono tabular-nums"
                :class="{ 'negative-ending': data.ending_quantity <= 0 }"
              >
                {{ formatMoney(data.ending_value ?? (data.ending_quantity * (data.purchase_price || 0))) }}
              </span>
            </template>
          </Column>

          <!-- Current Stock -->
          <Column field="current_quantity" style="text-align: center;">
            <template #body="{ data }">
              <div class="flex align-items-center justify-content-center gap-2">
                <span
                  class="stock-status-dot"
                  :class="data.current_quantity <= 0 ? 'dot-red' : (data.min_quantity && data.current_quantity <= data.min_quantity ? 'dot-amber' : 'dot-green')"
                ></span>
                <span class="font-mono text-sm font-bold text-700 tabular-nums">
                  {{ formatQty(data.current_quantity) }}
                </span>
              </div>
            </template>
          </Column>

          <!-- Table Footer Summary -->
          <ColumnGroup type="footer">
            <Row>
              <Column :colspan="2" footer="الإجمالي الكلي:" footer-style="text-align: left; font-weight: 800; padding: 10px 14px;" />
              <Column :footer="formatQty(summary.total_opening_quantity)" footer-style="text-align: center; font-weight: 800; font-family: monospace;" />
              <Column :footer="formatMoney(totalOpeningValue)" footer-style="text-align: left; font-weight: 800; font-family: monospace; color: #4338ca;" />
              <Column :footer="formatQty(summary.total_ending_quantity)" footer-style="text-align: center; font-weight: 800; font-family: monospace;" />
              <Column :footer="formatMoney(totalEndingValue)" footer-style="text-align: left; font-weight: 800; font-family: monospace; color: #0f766e;" />
              <Column footer="—" footer-style="text-align: center; color: #94a3b8;" />
            </Row>
          </ColumnGroup>
        </DataTable>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-content-between align-items-center w-full" dir="rtl">
        <div class="flex align-items-center gap-2 text-xs text-color-secondary">
          <i class="pi pi-calendar-times text-xs"></i>
          <span>الفترة المحددة: <strong>{{ periodLabel }}</strong></span>
        </div>
        <Button label="إغلاق" icon="pi pi-times" text severity="secondary" @click="onClose" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.stock-period-report-wrapper {
  font-family: inherit;
}

/* Header Icon */
.report-header-icon {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 10px;
  background: var(--p-primary-50, #f0f9ff);
  border: 1px solid var(--p-primary-100, #e0f2fe);
}

/* Filters Card */
.filter-glass-card {
  background: var(--surface-card, #ffffff);
  border: 1px solid var(--surface-border, #e2e8f0);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

/* Preset Segmented Pills */
.preset-pill-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-color-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-pill-btn:hover {
  background: var(--surface-100, #f1f5f9);
  color: var(--text-color, #0f172a);
}

.preset-pill-btn.active {
  background: var(--p-primary-50, #eff6ff);
  color: var(--p-primary-700, #1d4ed8);
  border-color: var(--p-primary-200, #bfdbfe);
  font-weight: 600;
}

/* Modern KPI Cards */
.modern-kpi-card {
  border-radius: 12px;
  padding: 1rem 1.15rem;
  background: var(--surface-card, #ffffff);
  border: 1px solid var(--surface-border, #e2e8f0);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.02);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  height: 100%;
}

.modern-kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.05);
}

.card-blue { border-top: 3px solid #3b82f6; }
.card-indigo { border-top: 3px solid #6366f1; }
.card-emerald { border-top: 3px solid #10b981; }
.card-purple { border-top: 3px solid #8b5cf6; }

.kpi-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-color-secondary, #64748b);
}

.kpi-icon-wrap {
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
}

.kpi-main-val {
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  margin-bottom: 0.25rem;
}

.kpi-sub-text {
  font-size: 0.72rem;
  color: var(--text-color-secondary, #64748b);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

/* Modern Table Container */
.modern-table-container {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--surface-border, #e2e8f0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  background: var(--surface-card, #ffffff);
}

/* Header Sections */
:deep(.col-header-opening) {
  background: #f5f7ff !important;
  color: #3730a3 !important;
  font-weight: 700 !important;
  border-bottom: 2px solid #818cf8 !important;
}

:deep(.col-header-sub-opening) {
  background: #f8faff !important;
  color: #4338ca !important;
  font-size: 0.78rem !important;
  font-weight: 600 !important;
}

:deep(.col-header-ending) {
  background: #f0fdf9 !important;
  color: #0f766e !important;
  font-weight: 700 !important;
  border-bottom: 2px solid #34d399 !important;
}

:deep(.col-header-sub-ending) {
  background: #f6fefc !important;
  color: #0f766e !important;
  font-size: 0.78rem !important;
  font-weight: 600 !important;
}

/* Product Info Cell */
.product-title {
  font-size: 0.88rem;
  line-height: 1.3;
}

.code-pill {
  font-size: 0.7rem;
  background: var(--surface-100, #f1f5f9);
  color: var(--text-color-secondary, #475569);
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--surface-200, #e2e8f0);
}

.meta-item-text {
  font-size: 0.73rem;
}

.meta-item-unit {
  font-size: 0.7rem;
  color: #64748b;
  background: #fafafa;
  padding: 1px 5px;
  border-radius: 3px;
}

.low-stock-micro-tag {
  font-size: 0.65rem;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid #fde68a;
}

/* Value Badges */
.value-cell-badge {
  display: inline-block;
  font-size: 0.83rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
}

.opening-value {
  color: #3730a3;
  background: #eef2ff;
}

.ending-value {
  color: #0f766e;
  background: #ecfdf5;
}

.ending-value.negative-ending {
  color: #b91c1c;
  background: #fef2f2;
}

/* Stock Status Dots */
.stock-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-green { background-color: #22c55e; }
.dot-amber { background-color: #f59e0b; }
.dot-red { background-color: #ef4444; }

/* Table Row Hover */
:deep(.p-datatable-tbody > tr:hover) {
  background-color: var(--surface-50, #f8fafc) !important;
}

/* Tabular numbers for perfect alignment */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
