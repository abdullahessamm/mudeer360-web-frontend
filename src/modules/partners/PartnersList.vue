<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showError, showSuccess } from '@/composables/useToast'
import { formatDateLocal } from '@/lib/date'
import { usePartnersStore, type Partner } from '@/stores/partners'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'

const router = useRouter()
const store = usePartnersStore()
const accountsStore = useFinancialAccountsStore()

watch(
  () => store.error,
  (err) => {
    if (err) {
      showError(err)
      store.clearError()
    }
  },
)

const partnerDialog = ref(false)
const transactionDialog = ref(false)
const formName = ref('')
const formPhone = ref('')
const formNotes = ref('')

const txPartnerId = ref<number | null>(null)
const txFinancialAccountId = ref<number | null>(null)
const txType = ref<'withdraw' | 'deposit'>('withdraw')
const txAmount = ref<number | null>(null)
const txDate = ref<Date>(new Date())
const txNotes = ref('')

const partnerOptions = computed(() =>
  store.items.map((p) => ({ label: p.name, value: p.id })),
)

const accountOptions = computed(() =>
  accountsStore.items.map((a) => ({ label: a.name, value: a.id })),
)

function fmt(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function typeLabel(t: 'withdraw' | 'deposit') {
  return t === 'withdraw' ? 'مسحوبات شخصية' : 'إيداع للشريك'
}

function openAddPartner() {
  formName.value = ''
  formPhone.value = ''
  formNotes.value = ''
  partnerDialog.value = true
}

function openTransaction(partnerId?: number) {
  txPartnerId.value = partnerId ?? store.items[0]?.id ?? null
  txFinancialAccountId.value = accountsStore.items[0]?.id ?? null
  txType.value = 'withdraw'
  txAmount.value = null
  txDate.value = new Date()
  txNotes.value = ''
  transactionDialog.value = true
}

async function submitPartner() {
  if (!formName.value.trim()) {
    showError('أدخل اسم الشريك')
    return
  }
  try {
    await store.createPartner({
      name: formName.value.trim(),
      phone: formPhone.value.trim() || null,
      notes: formNotes.value.trim() || null,
    })
    showSuccess('تم إضافة الشريك')
    partnerDialog.value = false
  } catch {
    //
  }
}

async function submitTransaction() {
  if (txPartnerId.value == null) {
    showError('اختر الشريك')
    return
  }
  if (txFinancialAccountId.value == null) {
    showError('اختر الحساب المالي (الصندوق / البنك)')
    return
  }
  if (txAmount.value == null || txAmount.value <= 0) {
    showError('أدخل مبلغاً صحيحاً')
    return
  }
  try {
    await store.addTransaction({
      partner_id: txPartnerId.value,
      financial_account_id: txFinancialAccountId.value,
      type: txType.value,
      amount: txAmount.value,
      date: formatDateLocal(txDate.value),
      notes: txNotes.value.trim() || null,
    })
    showSuccess('تم تسجيل الحركة')
    transactionDialog.value = false
  } catch {
    //
  }
}

function goStatement(p: Partner) {
  router.push({ name: 'partner-statement', params: { id: String(p.id) } })
}

function goPrintStatement(p: Partner) {
  router.push({
    name: 'partner-statement',
    params: { id: String(p.id) },
    query: { print: '1' },
  })
}

onMounted(async () => {
  try {
    await accountsStore.fetchAll()
  } catch {
    //
  }
  store.fetchAll()
})
</script>

<template>
  <div dir="rtl" class="partners-page">
    <div class="flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
      <h2 class="m-0 text-xl font-semibold">جاري الشركاء</h2>
      <div class="flex gap-2">
        <Button label="حركة (سحب / إيداع)" icon="pi pi-exchange" outlined @click="openTransaction()" />
        <Button label="إضافة شريك" icon="pi pi-plus" @click="openAddPartner" />
      </div>
    </div>

    <Card>
      <template #content>
        <div
          v-if="store.loading && store.items.length === 0"
          class="flex justify-content-center py-8"
        >
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>
        <div
          v-else-if="store.items.length === 0"
          class="flex flex-column align-items-center py-8 gap-3"
        >
          <p class="text-color-secondary m-0">لا يوجد شركاء بعد</p>
          <Button label="إضافة شريك" icon="pi pi-plus" @click="openAddPartner" />
        </div>
        <DataTable
          v-else
          :value="store.items"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          class="p-datatable-sm"
        >
          <Column field="name" header="الاسم" />
          <Column field="phone" header="الهاتف">
            <template #body="{ data }">{{ data.phone ?? '—' }}</template>
          </Column>
          <Column field="computed_balance" header="رصيد الشريك">
            <template #body="{ data }">{{ fmt(data.computed_balance) }}</template>
          </Column>
          <Column header="" style="width: 300px">
            <template #body="{ data }">
              <div class="flex gap-2 flex-wrap">
                <Button
                  label="كشف حساب"
                  icon="pi pi-list"
                  size="small"
                  outlined
                  @click="goStatement(data)"
                />
                <Button
                  label="طباعة"
                  icon="pi pi-print"
                  size="small"
                  severity="secondary"
                  outlined
                  @click="goPrintStatement(data)"
                />
                <Button
                  label="حركة"
                  icon="pi pi-plus"
                  size="small"
                  severity="secondary"
                  outlined
                  @click="openTransaction(data.id)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog
      v-model:visible="partnerDialog"
      header="إضافة شريك"
      modal
      :style="{ width: '28rem' }"
      :dir="'rtl'"
    >
      <div class="flex flex-column gap-3">
        <div class="flex flex-column gap-1">
          <label class="text-sm">الاسم</label>
          <InputText v-model="formName" class="w-full" placeholder="اسم الشريك" />
        </div>
        <div class="flex flex-column gap-1">
          <label class="text-sm">الهاتف</label>
          <InputText v-model="formPhone" class="w-full" placeholder="اختياري" />
        </div>
        <div class="flex flex-column gap-1">
          <label class="text-sm">ملاحظات</label>
          <Textarea v-model="formNotes" rows="2" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="إلغاء" severity="secondary" text @click="partnerDialog = false" />
        <Button label="حفظ" icon="pi pi-check" @click="submitPartner" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="transactionDialog"
      header="تسجيل حركة — مسحوبات أو إيداع"
      modal
      :style="{ width: '28rem' }"
      :dir="'rtl'"
    >
      <div class="flex flex-column gap-3">
        <div class="flex flex-column gap-1">
          <label class="text-sm">الشريك</label>
          <Select
            v-model="txPartnerId"
            :options="partnerOptions"
            option-label="label"
            option-value="value"
            placeholder="اختر الشريك"
            class="w-full"
            filter
          />
        </div>
        <div class="flex flex-column gap-1">
          <label class="text-sm">الحساب المالي (صندوق / بنك)</label>
          <Select
            v-model="txFinancialAccountId"
            :options="accountOptions"
            option-label="label"
            option-value="value"
            placeholder="اختر الحساب"
            class="w-full"
            filter
            filter-placeholder="بحث…"
          />
        </div>
        <div class="flex flex-column gap-1">
          <label class="text-sm">النوع</label>
          <Select
            v-model="txType"
            :options="[
              { label: 'مسحوبات شخصية', value: 'withdraw' },
              { label: 'إيداع للشريك', value: 'deposit' },
            ]"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
        <div class="flex flex-column gap-1">
          <label class="text-sm">المبلغ</label>
          <InputNumber
            v-model="txAmount"
            mode="decimal"
            :min-fraction-digits="2"
            :max-fraction-digits="2"
            class="w-full"
            :input-class="'w-full'"
          />
        </div>
        <div class="flex flex-column gap-1">
          <label class="text-sm">التاريخ</label>
          <DatePicker v-model="txDate" date-format="yy-mm-dd" show-icon class="w-full" />
        </div>
        <div class="flex flex-column gap-1">
          <label class="text-sm">ملاحظات</label>
          <Textarea v-model="txNotes" rows="2" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="إلغاء" severity="secondary" text @click="transactionDialog = false" />
        <Button label="تسجيل" icon="pi pi-check" @click="submitTransaction" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.partners-page {
  max-width: 1100px;
}
</style>
