<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showError } from '@/composables/useToast'
import { useSuppliersStore } from '@/stores/suppliers'
import type { SupplierWithInvoices } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useSuppliersStore()

const supplier = ref<SupplierWithInvoices | null>(null)
const loading = ref(true)

const supplierId = computed(() => Number(route.params.id))

const invoices = computed(() => supplier.value?.purchase_invoices ?? [])

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    paid: 'مدفوع',
    partial: 'مدفوع جزئياً',
    unpaid: 'غير مدفوع',
  }
  return map[status] ?? status
}

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    cash: 'نقدي',
    credit: 'آجل',
  }
  return map[type] ?? type
}

function goBack() {
  router.push({ name: 'suppliers' })
}

watch(
  () => store.error,
  (err) => {
    if (err) {
      showError(err)
      store.clearError()
    }
  },
)

onMounted(async () => {
  const id = supplierId.value
  if (!id) {
    router.replace({ name: 'suppliers' })
    return
  }
  loading.value = true
  try {
    supplier.value = await store.fetchById(id)
    if (!supplier.value) {
      showError('المورد غير موجود')
      router.replace({ name: 'suppliers' })
    }
  } catch {
    showError('فشل تحميل بيانات المورد')
    router.replace({ name: 'suppliers' })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div dir="rtl">
    <div class="flex justify-content-between align-items-center mb-4">
      <Button
        icon="pi pi-arrow-right"
        icon-pos="right"
        severity="secondary"
        rounded
        size="small"
        label="العودة للموردين"
        @click="goBack"
      />
    </div>
    <Card v-if="loading || supplier">
      <template #title>
        <div class="flex align-items-center gap-2">
          <i class="pi pi-users"></i>
          <span>{{ loading ? 'جاري التحميل...' : `فواتير الشراء - ${supplier?.name}` }}</span>
        </div>
      </template>
      <template #content>
        <div v-if="loading" class="flex justify-content-center align-items-center py-8">
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>
        <div
          v-else-if="invoices.length === 0"
          class="flex flex-column align-items-center justify-content-center py-8 gap-3"
        >
          <i class="pi pi-file text-6xl text-color-secondary"></i>
          <p class="text-color-secondary m-0">لا توجد فواتير شراء لهذا المورد</p>
        </div>
        <DataTable
          v-else
          :value="invoices"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          class="p-datatable-sm"
        >
          <Column field="invoice_number" header="رقم الفاتورة" />
          <Column field="invoice_date" header="التاريخ" />
          <Column field="type" header="النوع">
            <template #body="{ data }">{{ typeLabel(data.type) }}</template>
          </Column>
          <Column field="total_amount" header="الإجمالي">
            <template #body="{ data }">{{ data.total_amount }}</template>
          </Column>
          <Column field="paid_amount" header="المدفوع">
            <template #body="{ data }">{{ data.paid_amount }}</template>
          </Column>
          <Column field="status" header="الحالة">
            <template #body="{ data }">
              <span
                :class="{
                  'text-green-600': data.status === 'paid',
                  'text-orange-600': data.status === 'partial',
                  'text-red-600': data.status === 'unpaid',
                }"
              >
                {{ statusLabel(data.status) }}
              </span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
