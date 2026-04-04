<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showError, showSuccess } from '@/composables/useToast'
import html2pdf from 'html2pdf.js'
import { formatDateLocal } from '@/lib/date'
import { usePartnersStore, type PartnerStatementPayload } from '@/stores/partners'

const route = useRoute()
const router = useRouter()
const store = usePartnersStore()

const statement = ref<PartnerStatementPayload | null>(null)

const lastBalance = computed(() => {
  const txs = statement.value?.transactions
  if (!txs?.length) return 0
  const last = txs[txs.length - 1]
  return last?.balance_after ?? 0
})

watch(
  () => store.error,
  (err) => {
    if (err) {
      showError(err)
      store.clearError()
    }
  },
)

const partnerId = computed(() => Number(route.params.id))

/** فلترة الحركات — بدون اختيار يُعرض كامل السجل */
const dateRange = ref<Date[] | null>(null)

const statementPdfRoot = ref<HTMLElement | null>(null)
const pdfExporting = ref(false)

/** يُحدَّث عند «تحميل PDF» أو «طباعة» ليعكس وقت إصدار الوثيقة */
const issuedAtTimestamp = ref(Date.now())

const issuedAtLabel = computed(() =>
  new Date(issuedAtTimestamp.value).toLocaleString('ar-EG', {
    dateStyle: 'long',
    timeStyle: 'short',
  }),
)

function sanitizeFilename(name: string) {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'partner'
}

/** PDF يُنشأ من الصفحة بدون نافذة طباعة المتصفح — لا يظهر تاريخ/وقت/رابط الهوامش */
async function downloadPdf() {
  if (!statement.value || !statementPdfRoot.value) return
  issuedAtTimestamp.value = Date.now()
  pdfExporting.value = true
  await nextTick()
  await nextTick()
  try {
    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `kashf-${sanitizeFilename(statement.value.partner.name)}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
    }
    await html2pdf().set(opt).from(statementPdfRoot.value).save()
    showSuccess('تم تحميل ملف PDF')
  } catch {
    showError('تعذّر إنشاء ملف PDF')
  } finally {
    pdfExporting.value = false
  }
}

function fmt(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function typeLabel(t: string) {
  return t === 'withdraw' ? 'مسحوبات شخصية' : 'إيداع للشريك'
}

function asLocalDate(d: Date | string): Date {
  if (d instanceof Date) return d
  const x = new Date(d)
  return Number.isNaN(x.getTime()) ? new Date() : x
}

/** يبني باراميترات الـ API من نطاق التاريخ (يُفضَّل تمرير القيمة الصادرة من DatePicker مباشرة لتفادي تعارض التوقيت مع v-model) */
function paramsFromRange(
  r: [Date | string, Date | string] | Date[] | null | undefined,
): { date_from?: string; date_to?: string } {
  if (r == null || !Array.isArray(r) || r.length < 2) return {}
  const a = r[0]
  const b = r[1]
  if (a == null || b == null) return {}
  return {
    date_from: formatDateLocal(asLocalDate(a)),
    date_to: formatDateLocal(asLocalDate(b)),
  }
}

function statementParams(): { date_from?: string; date_to?: string } {
  return paramsFromRange(dateRange.value ?? undefined)
}

/** نص الفترة للطباعة/PDF عند تفعيل فلتر التاريخ */
const printDateRangeLabel = computed(() => {
  const p = paramsFromRange(dateRange.value ?? undefined)
  if (!p.date_from || !p.date_to) return ''
  const from = new Date(`${p.date_from}T12:00:00`)
  const to = new Date(`${p.date_to}T12:00:00`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return ''
  const a = from.toLocaleDateString('ar-EG', { dateStyle: 'long' })
  const b = to.toLocaleDateString('ar-EG', { dateStyle: 'long' })
  return `من ${a} إلى ${b}`
})

/** القيمة من الحدث أحدث من ref أحياناً لأن v-model يُحدَّث في نفس الـ tick لاحقاً */
function onDateRangeChange(val: Date | Date[] | (Date | null)[] | null | undefined) {
  if (val == null) {
    loadWithParams({})
    return
  }
  if (Array.isArray(val)) {
    const p = paramsFromRange(val as [Date | string, Date | string])
    if (p.date_from && p.date_to) loadWithParams(p)
  }
}

async function loadWithParams(params: { date_from?: string; date_to?: string }) {
  if (!Number.isFinite(partnerId.value)) return
  statement.value = await store.getStatement(partnerId.value, params)
  if (route.query.print === '1' && statement.value) {
    issuedAtTimestamp.value = Date.now()
    await nextTick()
    window.print()
    await router.replace({
      name: 'partner-statement',
      params: { id: String(partnerId.value) },
      query: {},
    })
  }
}

async function load() {
  if (!Number.isFinite(partnerId.value)) return
  await loadWithParams(statementParams())
}

function goBack() {
  router.push({ name: 'partners' })
}

function printStatement() {
  issuedAtTimestamp.value = Date.now()
  nextTick(() => window.print())
}

onMounted(() => {
  load()
})
</script>

<template>
  <div
    ref="statementPdfRoot"
    dir="rtl"
    :class="['statement-page', { 'statement-page--pdf-export': pdfExporting }]"
  >
    <!-- رأس الوثيقة للطباعة فقط -->
    <header v-if="statement" class="print-only print-doc-header">
      <div class="print-doc-brand">وثيقة مالية</div>
      <h1 class="print-doc-title">كشف حساب — {{ statement.partner.name }}</h1>
      <p v-if="printDateRangeLabel" class="print-doc-range m-0">
        الفترة: {{ printDateRangeLabel }}
      </p>
      <p class="print-doc-meta m-0">تاريخ الإصدار: {{ issuedAtLabel }}</p>
      <div class="print-doc-rule" />
    </header>

    <div
      class="flex justify-content-between align-items-center mb-4 flex-wrap gap-2 no-print"
    >
      <div>
        <Button label="رجوع" icon="pi pi-arrow-right" text @click="goBack" />
        <h2 class="m-0 mt-2 text-xl font-semibold">كشف حساب الشريك</h2>
        <p v-if="statement" class="text-color-secondary m-0 mt-1">{{ statement.partner.name }}</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <Button
          label="تحميل PDF"
          icon="pi pi-download"
          :disabled="!statement"
          :loading="pdfExporting"
          @click="downloadPdf"
        />
        <Button
          label="طباعة"
          icon="pi pi-print"
          outlined
          :disabled="!statement || pdfExporting"
          @click="printStatement"
        />
        <Button
          label="تحديث"
          icon="pi pi-refresh"
          outlined
          :loading="store.loading"
          :disabled="pdfExporting"
          @click="load"
        />
      </div>
    </div>

    <div class="flex flex-wrap align-items-center gap-2 mb-4 no-print">
      <DatePicker
        v-model="dateRange"
        selection-mode="range"
        :manual-input="false"
        date-format="yy-mm-dd"
        placeholder="من تاريخ — إلى تاريخ"
        show-icon
        show-clear
        icon-display="input"
        class="statement-date-range"
        @update:model-value="onDateRangeChange"
      />
    </div>

    <Card class="statement-card">
      <template #content>
        <div v-if="store.loading && !statement" class="flex justify-content-center py-8">
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>
        <template v-else-if="statement">
          <div class="summary-pill mb-4 print-balance-box">
            <span class="label">رصيد الشريك (آخر حركة)</span>
            <span class="value">{{ fmt(lastBalance) }}</span>
          </div>
          <p class="print-only print-table-caption">تفاصيل الحركات</p>
          <DataTable
            :value="statement.transactions"
            data-key="id"
            striped-rows
            responsive-layout="scroll"
            class="p-datatable-sm statement-table"
          >
            <Column field="date" header="التاريخ" />
            <Column field="type" header="النوع">
              <template #body="{ data }">
                <span class="type-cell-print">{{ typeLabel(data.type) }}</span>
                <Tag
                  class="type-cell-screen"
                  :value="typeLabel(data.type)"
                  :severity="data.type === 'deposit' ? 'success' : 'warn'"
                />
              </template>
            </Column>
            <Column field="amount" header="المبلغ">
              <template #body="{ data }">
                <span class="amount-cell">{{ fmt(data.amount) }}</span>
              </template>
            </Column>
            <Column field="balance_after" header="الرصيد بعد الحركة">
              <template #body="{ data }">
                <span class="amount-cell">{{ fmt(data.balance_after) }}</span>
              </template>
            </Column>
          </DataTable>
          <footer v-if="statement.transactions.length" class="print-only print-doc-footer">
            <div class="print-doc-rule print-doc-rule--light" />
            <div class="print-footer-row">
              <span>الرصيد الختامي</span>
              <strong class="print-footer-balance">{{ fmt(lastBalance) }}</strong>
            </div>
          </footer>
          <p v-if="statement" class="print-only print-disclaimer">
            كشف حساب وفق البيانات المسجّلة وقت الطباعة — يُعتمد الرصيد الظاهر أعلاه.
          </p>
          <p
            v-if="statement.transactions.length === 0"
            class="text-color-secondary text-center py-4 m-0"
          >
            لا توجد حركات بعد
          </p>
        </template>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.statement-page {
  max-width: 900px;
}

.statement-date-range {
  width: 100%;
  max-width: 22rem;
}

.print-only {
  display: none;
}

.type-cell-print {
  display: none;
}

.type-cell-screen {
  vertical-align: middle;
}

.amount-cell {
  font-variant-numeric: tabular-nums;
}

/* مظهر مطابق للطباعة أثناء تصدير PDF (بدون هوامش المتصفح) */
.statement-page--pdf-export {
  max-width: none;
  color: #111;
}

.statement-page--pdf-export .no-print {
  display: none !important;
}

.statement-page--pdf-export .print-only {
  display: block !important;
}

.statement-page--pdf-export .type-cell-print {
  display: inline !important;
  font-size: 10pt;
}

.statement-page--pdf-export .type-cell-screen {
  display: none !important;
}

.statement-page--pdf-export :deep(.statement-card) {
  box-shadow: none !important;
  border: none !important;
  background: transparent !important;
}

.statement-page--pdf-export :deep(.statement-card .p-card-body) {
  padding: 0 !important;
}

.statement-page--pdf-export .print-balance-box {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid #333;
  border-radius: 4px;
  background: #f7f7f7 !important;
  margin-bottom: 1rem !important;
}

.statement-page--pdf-export .print-balance-box .label {
  font-size: 10pt;
  font-weight: 600;
  color: #222;
}

.statement-page--pdf-export .print-balance-box .value {
  font-size: 14pt;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.statement-page--pdf-export :deep(.statement-table.p-datatable) {
  font-size: 10pt;
}

.statement-page--pdf-export :deep(.statement-table .p-datatable-thead > tr > th) {
  background: #eaeaea !important;
  color: #111 !important;
  font-weight: 700;
  font-size: 9.5pt;
  padding: 0.5rem 0.6rem !important;
  border: 1px solid #bbb !important;
  border-bottom: 2px solid #333 !important;
}

.statement-page--pdf-export :deep(.statement-table .p-datatable-tbody > tr > td) {
  padding: 0.45rem 0.6rem !important;
  border: 1px solid #ccc !important;
  vertical-align: middle;
}

.statement-page--pdf-export :deep(.statement-table .p-datatable-tbody > tr:nth-child(even) > td) {
  background: #fafafa !important;
}

.statement-page--pdf-export :deep(.statement-table .p-datatable-table) {
  border-collapse: collapse !important;
  width: 100%;
}

.statement-page--pdf-export :deep(.statement-table .p-datatable-wrapper) {
  overflow: visible !important;
}

.statement-page--pdf-export .print-doc-range {
  font-size: 9.5pt;
  color: #333;
  margin: 0 0 0.35rem !important;
}

.statement-page--pdf-export .print-doc-meta {
  font-size: 9.5pt;
  color: #444;
  margin: 0 0 0.5rem !important;
}

@media print {
  @page {
    size: A4;
    margin: 14mm 16mm;
  }

  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  .type-cell-print {
    display: inline !important;
    font-size: 10pt;
  }

  .type-cell-screen {
    display: none !important;
  }

  .statement-page {
    max-width: none;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  :deep(.statement-card) {
    box-shadow: none !important;
    border: none !important;
    background: transparent !important;
  }

  :deep(.statement-card .p-card-body) {
    padding: 0 !important;
  }

  .print-doc-header {
    margin-bottom: 1rem;
    break-inside: avoid;
  }

  .print-doc-brand {
    font-size: 9pt;
    letter-spacing: 0.02em;
    color: #555;
    margin-bottom: 0.35rem;
  }

  .print-doc-title {
    font-size: 16pt;
    font-weight: 700;
    margin: 0 0 0.5rem;
    line-height: 1.35;
    color: #000;
  }

  .print-doc-range {
    font-size: 9.5pt;
    color: #333;
    margin: 0 0 0.35rem;
  }

  .print-doc-meta {
    font-size: 9.5pt;
    color: #444;
    margin: 0 0 0.5rem;
  }

  .print-doc-rule {
    height: 0;
    border: none;
    border-top: 2px solid #1a1a1a;
    margin: 0.75rem 0 1rem;
  }

  .print-doc-rule--light {
    border-top-color: #ccc;
    margin: 0.75rem 0;
  }

  .print-table-caption {
    font-size: 10pt;
    font-weight: 600;
    margin: 0 0 0.5rem;
    color: #222;
  }

  .summary-pill,
  .print-balance-box {
    break-inside: avoid;
  }

  .print-balance-box {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 0.85rem;
    border: 1px solid #333;
    border-radius: 4px;
    background: #f7f7f7 !important;
    margin-bottom: 1rem !important;
  }

  .print-balance-box .label {
    font-size: 10pt;
    font-weight: 600;
    color: #222;
  }

  .print-balance-box .value {
    font-size: 14pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  :deep(.statement-table.p-datatable) {
    font-size: 10pt;
  }

  :deep(.statement-table .p-datatable-thead > tr > th) {
    background: #eaeaea !important;
    color: #111 !important;
    font-weight: 700;
    font-size: 9.5pt;
    padding: 0.5rem 0.6rem !important;
    border: 1px solid #bbb !important;
    border-bottom: 2px solid #333 !important;
  }

  :deep(.statement-table .p-datatable-tbody > tr > td) {
    padding: 0.45rem 0.6rem !important;
    border: 1px solid #ccc !important;
    vertical-align: middle;
  }

  :deep(.statement-table .p-datatable-tbody > tr:nth-child(even) > td) {
    background: #fafafa !important;
  }

  :deep(.statement-table .p-datatable-table) {
    border-collapse: collapse !important;
    width: 100%;
  }

  :deep(.statement-table .p-datatable-wrapper) {
    overflow: visible !important;
  }

  :deep(.statement-table .p-column-title) {
    font-weight: 700;
  }

  .print-doc-footer {
    margin-top: 1.25rem;
    break-inside: avoid;
  }

  .print-footer-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 11pt;
    padding-top: 0.25rem;
  }

  .print-footer-balance {
    font-size: 13pt;
    font-variant-numeric: tabular-nums;
  }

  .print-disclaimer {
    margin-top: 1.25rem;
    padding-top: 0.65rem;
    border-top: 1px solid #ddd;
    font-size: 8pt;
    color: #666;
    text-align: center;
    line-height: 1.5;
    break-inside: avoid;
  }
}

.summary-pill {
  display: inline-flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  background: var(--surface-100);
  border: 1px solid var(--surface-border);
}

.summary-pill .label {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.summary-pill .value {
  font-size: 1.5rem;
  font-weight: 700;
}
</style>
