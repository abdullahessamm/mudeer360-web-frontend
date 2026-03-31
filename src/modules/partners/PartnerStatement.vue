<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showError } from '@/composables/useToast'
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

function fmt(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function typeLabel(t: string) {
  return t === 'withdraw' ? 'مسحوبات شخصية' : 'إيداع للشريك'
}

async function load() {
  if (!Number.isFinite(partnerId.value)) return
  statement.value = await store.getStatement(partnerId.value)
}

function goBack() {
  router.push({ name: 'partners' })
}

onMounted(() => {
  load()
})
</script>

<template>
  <div dir="rtl" class="statement-page">
    <div class="flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
      <div>
        <Button label="رجوع" icon="pi pi-arrow-right" text @click="goBack" />
        <h2 class="m-0 mt-2 text-xl font-semibold">كشف حساب الشريك</h2>
        <p v-if="statement" class="text-color-secondary m-0 mt-1">{{ statement.partner.name }}</p>
      </div>
      <Button
        label="تحديث"
        icon="pi pi-refresh"
        outlined
        :loading="store.loading"
        @click="load"
      />
    </div>

    <Card>
      <template #content>
        <div v-if="store.loading && !statement" class="flex justify-content-center py-8">
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>
        <template v-else-if="statement">
          <div class="summary-pill mb-4">
            <span class="label">رصيد الشريك (آخر حركة)</span>
            <span class="value">{{ fmt(lastBalance) }}</span>
          </div>
          <DataTable
            :value="statement.transactions"
            data-key="id"
            striped-rows
            responsive-layout="scroll"
            class="p-datatable-sm"
          >
            <Column field="date" header="التاريخ" />
            <Column field="type" header="النوع">
              <template #body="{ data }">
                <Tag
                  :value="typeLabel(data.type)"
                  :severity="data.type === 'deposit' ? 'success' : 'warn'"
                />
              </template>
            </Column>
            <Column field="amount" header="المبلغ">
              <template #body="{ data }">{{ fmt(data.amount) }}</template>
            </Column>
            <Column field="balance_after" header="الرصيد بعد الحركة">
              <template #body="{ data }">{{ fmt(data.balance_after) }}</template>
            </Column>
          </DataTable>
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
