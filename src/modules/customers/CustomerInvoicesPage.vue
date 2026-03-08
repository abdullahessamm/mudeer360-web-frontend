<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showError } from '@/composables/useToast'
import { useCustomersStore } from '@/stores/customers'
import type { CustomerWithInvoices } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useCustomersStore()

const customer = ref<CustomerWithInvoices | null>(null)
const loading = ref(true)

const customerId = computed(() => Number(route.params.id))

const invoices = computed(() => customer.value?.invoices ?? [])

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
  router.push({ name: 'customers' })
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
  const id = customerId.value
  if (!id) {
    router.replace({ name: 'customers' })
    return
  }
  loading.value = true
  try {
    customer.value = await store.fetchById(id)
    if (!customer.value) {
      showError('العميل غير موجود')
      router.replace({ name: 'customers' })
    }
  } catch {
    showError('فشل تحميل بيانات العميل')
    router.replace({ name: 'customers' })
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
        label="العودة للعملاء"
        @click="goBack"
      />
    </div>
    <Card v-if="loading || customer">
      <template #title>
        <div class="flex align-items-center gap-2">
          <i class="pi pi-user-plus"></i>
          <span>{{ loading ? 'جاري التحميل...' : `فواتير البيع - ${customer?.name}` }}</span>
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
          <p class="text-color-secondary m-0">لا توجد فواتير بيع لهذا العميل</p>
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
