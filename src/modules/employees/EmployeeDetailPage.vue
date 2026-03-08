<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { formatDateLocal } from '@/lib/date'
import { showError, showSuccess } from '@/composables/useToast'
import { useEmployeesStore } from '@/stores/employees'
import { useEmployeeTransactionsStore } from '@/stores/employeeTransactions'
import { usePayrollsStore } from '@/stores/payrolls'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'
import EmployeeTransactionForm from '@/components/forms/EmployeeTransactionForm.vue'
import type { Employee, EmployeeTransaction, Payroll } from '@/types'

const monthLabels: Record<number, string> = {
  1: 'يناير',
  2: 'فبراير',
  3: 'مارس',
  4: 'أبريل',
  5: 'مايو',
  6: 'يونيو',
  7: 'يوليو',
  8: 'أغسطس',
  9: 'سبتمبر',
  10: 'أكتوبر',
  11: 'نوفمبر',
  12: 'ديسمبر',
}

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const employeesStore = useEmployeesStore()
const transactionsStore = useEmployeeTransactionsStore()
const payrollsStore = usePayrollsStore()
const accountsStore = useFinancialAccountsStore()

const employeeId = computed(() => Number(route.params.id))
const employee = computed(() => employeesStore.currentEmployee)

watch(
  () => [transactionsStore.error, payrollsStore.error].join(','),
  () => {
    if (transactionsStore.error) {
      showError(transactionsStore.error)
      transactionsStore.clearError()
    }
    if (payrollsStore.error) {
      showError(payrollsStore.error)
      payrollsStore.clearError()
    }
  },
)

const transactionDialogVisible = ref(false)
const transactionFormModel = ref<Partial<EmployeeTransaction> | null>(null)
const isTransactionEdit = ref(false)
const editingTransactionId = ref<number | null>(null)

const createPayrollDialogVisible = ref(false)
const createPayrollModel = ref({ employee_id: 0, month: 1, year: new Date().getFullYear() })

const payPayrollDialogVisible = ref(false)
const payPayrollModel = ref({
  financial_account_id: null as number | null,
  date: formatDateLocal(new Date()),
})
const payrollToPay = ref<Payroll | null>(null)

const payDateValue = computed({
  get: () =>
    payPayrollModel.value.date ? new Date(payPayrollModel.value.date + 'T12:00:00') : null,
  set: (v: Date | null) => {
    payPayrollModel.value = {
      ...payPayrollModel.value,
      date: v ? formatDateLocal(v) : formatDateLocal(new Date()),
    }
  },
})

const employeeOptions = computed(() =>
  employeesStore.allEmployees.map((e) => ({ label: e.name, value: e.id })),
)
const accountOptions = computed(() =>
  accountsStore.items.map((a) => ({ label: a.name, value: a.id })),
)

const typeLabel = (type: string) =>
  ({ bonus: 'مكافأة', deduction: 'خصم', loan: 'سلفة' })[type] ?? type
const statusLabel = (status: string) => ({ pending: 'معلق', paid: 'مدفوع' })[status] ?? status

async function loadData() {
  if (!employeeId.value) return
  await Promise.all([
    employeesStore.fetchById(employeeId.value),
    employeesStore.fetchAllForSelect(),
    accountsStore.fetchAll(),
  ])
  await transactionsStore.fetchPage(1, 15, { employee_id: employeeId.value })
  await payrollsStore.fetchPage(1, 15, { employee_id: employeeId.value })
}

function openAddTransaction() {
  isTransactionEdit.value = false
  editingTransactionId.value = null
  transactionFormModel.value = {
    employee_id: employeeId.value,
    type: 'bonus',
    amount: 0,
    date: formatDateLocal(new Date()),
    description: '',
  }
  transactionDialogVisible.value = true
}

function openEditTransaction(row: EmployeeTransaction) {
  isTransactionEdit.value = true
  editingTransactionId.value = row.id
  transactionFormModel.value = {
    employee_id: row.employee_id,
    type: row.type,
    amount: row.amount,
    date: row.date,
    description: row.description ?? '',
  }
  transactionDialogVisible.value = true
}

async function onTransactionSubmit(payload: {
  employee_id: number
  type: 'bonus' | 'deduction' | 'loan'
  amount: number
  date: string
  description?: string
  financial_account_id?: number
}) {
  try {
    if (isTransactionEdit.value && editingTransactionId.value !== null) {
      await transactionsStore.update(editingTransactionId.value, payload)
      showSuccess('تم تحديث المعاملة بنجاح')
    } else {
      await transactionsStore.create(payload)
      showSuccess('تم إضافة المعاملة بنجاح')
    }
    transactionDialogVisible.value = false
    await transactionsStore.fetchPage(1, transactionsStore.perPage, {
      employee_id: employeeId.value,
    })
    await employeesStore.fetchById(employeeId.value)
  } catch {
    // error shown via toast
  }
}

function confirmDeleteTransaction(row: EmployeeTransaction) {
  confirm.require({
    message: `هل أنت متأكد من حذف هذه المعاملة؟`,
    header: 'تأكيد الحذف',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'إلغاء',
    acceptLabel: 'حذف',
    acceptClass: 'p-button-danger p-button-sm',
    rejectClass: 'p-button-text p-button-secondary p-button-sm',
    acceptIcon: 'pi pi-trash',
    accept: async () => {
      try {
        await transactionsStore.remove(row.id)
        showSuccess('تم حذف المعاملة بنجاح')
        await transactionsStore.fetchPage(1, transactionsStore.perPage, {
          employee_id: employeeId.value,
        })
        await employeesStore.fetchById(employeeId.value)
      } catch {
        // error shown via toast
      }
    },
  })
}

function openCreatePayroll() {
  createPayrollModel.value = {
    employee_id: employeeId.value,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  }
  createPayrollDialogVisible.value = true
}

async function onCreatePayrollSubmit() {
  const { employee_id, month, year } = createPayrollModel.value
  if (!employee_id || !month || !year) return
  try {
    await payrollsStore.create({ employee_id, month, year })
    showSuccess('تم إنشاء كشف الراتب بنجاح')
    createPayrollDialogVisible.value = false
    await payrollsStore.fetchPage(1, payrollsStore.perPage, { employee_id: employeeId.value })
  } catch {
    // error shown via toast
  }
}

function openPayPayroll(row: Payroll) {
  if (row.status !== 'pending') return
  payrollToPay.value = row
  payPayrollModel.value = {
    financial_account_id: accountOptions.value[0]?.value ?? null,
    date: formatDateLocal(new Date()),
  }
  payPayrollDialogVisible.value = true
}

async function onPayPayrollSubmit() {
  if (!payrollToPay.value || !payPayrollModel.value.financial_account_id) return
  try {
    await payrollsStore.pay(payrollToPay.value.id, {
      financial_account_id: payPayrollModel.value.financial_account_id,
      date: payPayrollModel.value.date,
    })
    showSuccess('تم صرف الراتب بنجاح')
    payPayrollDialogVisible.value = false
    payrollToPay.value = null
    await payrollsStore.fetchPage(1, payrollsStore.perPage, { employee_id: employeeId.value })
  } catch {
    // error shown via toast
  }
}

function confirmDeletePayroll(row: Payroll) {
  if (row.status === 'paid') {
    showError('لا يمكن حذف كشف الراتب عندما تكون الحالة مدفوعة')
    return
  }
  confirm.require({
    message: `هل أنت متأكد من حذف كشف الراتب لـ ${monthLabels[row.month]} ${row.year}؟`,
    header: 'تأكيد الحذف',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'إلغاء',
    acceptLabel: 'حذف',
    acceptClass: 'p-button-danger p-button-sm',
    rejectClass: 'p-button-text p-button-secondary p-button-sm',
    acceptIcon: 'pi pi-trash',
    accept: async () => {
      try {
        await payrollsStore.remove(row.id)
        showSuccess('تم حذف كشف الراتب بنجاح')
        await payrollsStore.fetchPage(1, payrollsStore.perPage, { employee_id: employeeId.value })
      } catch {
        // error shown via toast
      }
    },
  })
}

function onTransactionPageChange(page: number) {
  transactionsStore.fetchPage(page, transactionsStore.perPage, { employee_id: employeeId.value })
}

function onPayrollPageChange(page: number) {
  payrollsStore.fetchPage(page, payrollsStore.perPage, { employee_id: employeeId.value })
}

onMounted(loadData)
</script>

<template>
  <div dir="rtl" class="employee-detail-page">
    <div v-if="employeesStore.loading && !employee" class="flex justify-content-center py-8">
      <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
    </div>
    <div v-else-if="!employee" class="flex justify-content-center py-8">
      <Message severity="warn">الموظف غير موجود</Message>
    </div>

    <template v-else-if="employee">
      <div class="flex justify-content-between align-items-center mb-4">
        <Button label="رجوع" icon="pi pi-arrow-right" text @click="router.push('/employees')" />
        <div class="employee-header">
          <h2 class="m-0">{{ employee.name }}</h2>
          <p class="text-color-secondary m-0 mt-1">
            {{ employee.position ?? '—' }} · الراتب:
            {{ employee.salary.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
          </p>
        </div>
      </div>

      <!-- Transactions -->
      <Card class="mb-4">
        <template #title>
          <div class="flex justify-content-between align-items-center flex-wrap gap-2">
            <span>المعاملات</span>
            <Button
              label="إضافة معاملة"
              icon="pi pi-plus"
              size="small"
              @click="openAddTransaction"
            />
          </div>
        </template>
        <template #content>
          <div v-if="transactionsStore.loading" class="flex justify-content-center py-4">
            <i class="pi pi-spin pi-spinner text-2xl text-color-secondary"></i>
          </div>
          <DataTable
            v-else-if="transactionsStore.items.length"
            :value="transactionsStore.items"
            data-key="id"
            striped-rows
            responsive-layout="scroll"
            class="p-datatable-sm"
          >
            <Column field="date" header="التاريخ" style="width: 120px" />
            <Column field="type" header="النوع" style="width: 100px">
              <template #body="{ data }">
                <Tag
                  :value="typeLabel(data.type)"
                  :severity="
                    data.type === 'bonus' ? 'success' : data.type === 'deduction' ? 'warn' : 'info'
                  "
                />
              </template>
            </Column>
            <Column field="amount" header="المبلغ">
              <template #body="{ data }">
                {{ data.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
              </template>
            </Column>
            <Column field="description" header="الوصف">
              <template #body="{ data }">{{ data.description ?? '—' }}</template>
            </Column>
            <Column header="الإجراءات" style="width: 140px">
              <template #body="{ data }">
                <Button
                  icon="pi pi-pencil"
                  text
                  size="small"
                  class="p-button-success"
                  @click="openEditTransaction(data)"
                />
                <Button
                  icon="pi pi-trash"
                  text
                  size="small"
                  class="p-button-danger"
                  @click="confirmDeleteTransaction(data)"
                />
              </template>
            </Column>
          </DataTable>
          <p v-else class="text-color-secondary m-0 py-4">لا توجد معاملات</p>
        </template>
        <template v-if="transactionsStore.lastPage > 1" #footer>
          <div class="flex justify-content-between align-items-center">
            <span class="text-sm text-color-secondary">
              عرض {{ transactionsStore.meta?.from ?? 0 }} - {{ transactionsStore.meta?.to ?? 0 }} من
              {{ transactionsStore.total }}
            </span>
            <div class="flex gap-1">
              <Button
                icon="pi pi-chevron-right"
                text
                size="small"
                :disabled="transactionsStore.currentPage <= 1"
                @click="onTransactionPageChange(transactionsStore.currentPage - 1)"
              />
              <span class="flex align-items-center px-2 text-sm">
                {{ transactionsStore.currentPage }} / {{ transactionsStore.lastPage }}
              </span>
              <Button
                icon="pi pi-chevron-left"
                text
                size="small"
                :disabled="transactionsStore.currentPage >= transactionsStore.lastPage"
                @click="onTransactionPageChange(transactionsStore.currentPage + 1)"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Payrolls -->
      <Card>
        <template #title>
          <div class="flex justify-content-between align-items-center flex-wrap gap-2">
            <span>كشوف الرواتب</span>
            <Button
              label="إنشاء كشف راتب"
              icon="pi pi-plus"
              size="small"
              @click="openCreatePayroll"
            />
          </div>
        </template>
        <template #content>
          <div v-if="payrollsStore.loading" class="flex justify-content-center py-4">
            <i class="pi pi-spin pi-spinner text-2xl text-color-secondary"></i>
          </div>
          <DataTable
            v-else-if="payrollsStore.items.length"
            :value="payrollsStore.items"
            data-key="id"
            striped-rows
            responsive-layout="scroll"
            class="p-datatable-sm"
          >
            <Column header="الشهر/السنة" style="width: 140px">
              <template #body="{ data }">{{ monthLabels[data.month] }} {{ data.year }}</template>
            </Column>
            <Column field="total_bonus" header="إجمالي المكافآت">
              <template #body="{ data }">
                {{ data.total_bonus.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
              </template>
            </Column>
            <Column field="total_deductions" header="إجمالي الخصومات">
              <template #body="{ data }">
                {{ data.total_deductions.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
              </template>
            </Column>
            <Column field="total_loans" header="إجمالي السلف">
              <template #body="{ data }">
                {{ data.total_loans.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
              </template>
            </Column>
            <Column field="net_salary" header="صافي الراتب">
              <template #body="{ data }">
                {{ data.net_salary.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) }}
              </template>
            </Column>
            <Column field="status" header="الحالة" style="width: 100px">
              <template #body="{ data }">
                <Tag
                  :value="statusLabel(data.status)"
                  :severity="data.status === 'paid' ? 'success' : 'warn'"
                />
              </template>
            </Column>
            <Column header="الإجراءات" style="width: 180px">
              <template #body="{ data }">
                <Button
                  v-if="data.status === 'pending'"
                  label="صرف الراتب"
                  icon="pi pi-wallet"
                  text
                  size="small"
                  class="p-button-success"
                  @click="openPayPayroll(data)"
                />
                <Button
                  v-if="data.status === 'pending'"
                  icon="pi pi-trash"
                  text
                  size="small"
                  class="p-button-danger"
                  @click="confirmDeletePayroll(data)"
                />
                <span v-if="data.status === 'paid'" class="text-sm text-color-secondary">—</span>
              </template>
            </Column>
          </DataTable>
          <p v-else class="text-color-secondary m-0 py-4">لا توجد كشوف رواتب</p>
        </template>
        <template v-if="payrollsStore.lastPage > 1" #footer>
          <div class="flex justify-content-between align-items-center">
            <span class="text-sm text-color-secondary">
              عرض {{ payrollsStore.meta?.from ?? 0 }} - {{ payrollsStore.meta?.to ?? 0 }} من
              {{ payrollsStore.total }}
            </span>
            <div class="flex gap-1">
              <Button
                icon="pi pi-chevron-right"
                text
                size="small"
                :disabled="payrollsStore.currentPage <= 1"
                @click="onPayrollPageChange(payrollsStore.currentPage - 1)"
              />
              <span class="flex align-items-center px-2 text-sm">
                {{ payrollsStore.currentPage }} / {{ payrollsStore.lastPage }}
              </span>
              <Button
                icon="pi pi-chevron-left"
                text
                size="small"
                :disabled="payrollsStore.currentPage >= payrollsStore.lastPage"
                @click="onPayrollPageChange(payrollsStore.currentPage + 1)"
              />
            </div>
          </div>
        </template>
      </Card>
    </template>

    <!-- Transaction Dialog -->
    <Dialog
      v-model:visible="transactionDialogVisible"
      :header="isTransactionEdit ? 'تعديل المعاملة' : 'إضافة معاملة'"
      :modal="true"
      :style="{ width: '420px' }"
      @hide="transactionDialogVisible = false"
    >
      <EmployeeTransactionForm
        v-if="transactionDialogVisible"
        :model-value="transactionFormModel"
        :employee-options="employeeOptions"
        :account-options="accountOptions"
        :fixed-employee-id="employeeId"
        :loading="transactionsStore.loading"
        @submit="onTransactionSubmit"
        @cancel="transactionDialogVisible = false"
      />
    </Dialog>

    <!-- Create Payroll Dialog -->
    <Dialog
      v-model:visible="createPayrollDialogVisible"
      header="إنشاء كشف راتب"
      :modal="true"
      :style="{ width: '380px' }"
      @hide="createPayrollDialogVisible = false"
    >
      <form
        v-if="createPayrollDialogVisible"
        @submit.prevent="onCreatePayrollSubmit"
        class="flex flex-column gap-3"
      >
        <div class="field">
          <label>الموظف</label>
          <InputText :model-value="employee?.name" class="w-full" disabled />
        </div>
        <div class="field">
          <label for="payroll-month">الشهر <span class="text-red-500">*</span></label>
          <InputNumber
            id="payroll-month"
            v-model="createPayrollModel.month"
            :min="1"
            :max="12"
            class="w-full mt-1"
            placeholder="1-12"
          />
        </div>
        <div class="field">
          <label for="payroll-year">السنة <span class="text-red-500">*</span></label>
          <InputNumber
            id="payroll-year"
            v-model="createPayrollModel.year"
            :min="2000"
            :max="2100"
            class="w-full mt-1"
            placeholder="2026"
          />
        </div>
        <div class="flex justify-content-end gap-2 mt-2">
          <Button type="button" label="إلغاء" text @click="createPayrollDialogVisible = false" />
          <Button type="submit" label="إنشاء" icon="pi pi-check" :loading="payrollsStore.loading" />
        </div>
      </form>
    </Dialog>

    <!-- Pay Payroll Dialog -->
    <Dialog
      v-model:visible="payPayrollDialogVisible"
      header="صرف الراتب"
      :modal="true"
      :style="{ width: '400px' }"
      @hide="payPayrollDialogVisible = false"
    >
      <form
        v-if="payPayrollDialogVisible && payrollToPay"
        @submit.prevent="onPayPayrollSubmit"
        class="flex flex-column gap-3"
      >
        <div class="field">
          <label>صافي الراتب</label>
          <InputText
            :model-value="
              payrollToPay.net_salary.toLocaleString('ar-EG', { minimumFractionDigits: 2 })
            "
            class="w-full"
            disabled
          />
        </div>
        <div class="field">
          <label for="pay-account">الحساب المالي <span class="text-red-500">*</span></label>
          <Select
            id="pay-account"
            v-model="payPayrollModel.financial_account_id"
            :options="accountOptions"
            option-label="label"
            option-value="value"
            placeholder="اختر الحساب"
            class="w-full mt-1"
          />
        </div>
        <div class="field">
          <label for="pay-date">التاريخ <span class="text-red-500">*</span></label>
          <DatePicker
            id="pay-date"
            v-model="payDateValue"
            date-format="yy-mm-dd"
            show-icon
            icon-display="input"
            class="w-full mt-1"
          />
        </div>
        <div class="flex justify-content-end gap-2 mt-2">
          <Button type="button" label="إلغاء" text @click="payPayrollDialogVisible = false" />
          <Button
            type="submit"
            label="صرف"
            icon="pi pi-check"
            :loading="payrollsStore.loading"
            :disabled="!payPayrollModel.financial_account_id"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>
