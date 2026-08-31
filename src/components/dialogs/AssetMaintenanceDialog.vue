<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { showSuccess, showError } from '@/composables/useToast'
import { useAssetsStore } from '@/stores/assets'
import { formatDateLocal, formatDateOnly } from '@/lib/date'
import { formatNumber } from '@/lib/format'
import { assetStatusLabel, assetStatusSeverity } from '@/lib/assetStatus'
import type { Asset, AssetMaintenance } from '@/types'

const props = defineProps<{
  visible: boolean
  asset: Asset | null
  financialAccountOptions: { label: string; value: number }[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  updated: []
}>()

const confirm = useConfirm()
const store = useAssetsStore()

const loading = ref(false)
const saving = ref(false)
const maintenances = ref<AssetMaintenance[]>([])

const today = formatDateLocal(new Date())

// New / Edit maintenance form state
const isEditMode = ref(false)
const editingMaintenanceId = ref<number | null>(null)

const form = ref({
  cost: 0,
  maintenance_date: today,
  financial_account_id: null as number | null,
  description: '',
})

const datePickerValue = computed({
  get: () => (form.value.maintenance_date ? new Date(form.value.maintenance_date + 'T12:00:00') : null),
  set: (d: Date | null) => {
    form.value.maintenance_date = d ? formatDateLocal(d) : today
  },
})

const totalSpent = computed(() =>
  maintenances.value.reduce((sum, item) => sum + (Number(item.cost) || 0), 0),
)

async function loadMaintenances() {
  if (!props.asset?.id) return
  loading.value = true
  try {
    maintenances.value = await store.fetchMaintenances(props.asset.id)
  } catch {
    // handled by store
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.visible, props.asset],
  ([vis, ast]) => {
    if (vis && ast) {
      resetForm()
      loadMaintenances()
    }
  },
  { immediate: true },
)

function resetForm() {
  isEditMode.value = false
  editingMaintenanceId.value = null
  form.value = {
    cost: 0,
    maintenance_date: today,
    financial_account_id: props.financialAccountOptions[0]?.value ?? null,
    description: '',
  }
}

function startEdit(item: AssetMaintenance) {
  isEditMode.value = true
  editingMaintenanceId.value = item.id
  form.value = {
    cost: Number(item.cost) || 0,
    maintenance_date: item.maintenance_date ? formatDateOnly(item.maintenance_date) : today,
    financial_account_id: item.financial_account_id ?? null,
    description: item.description ?? '',
  }
}

async function saveMaintenance() {
  if (!props.asset?.id) return
  if (form.value.cost <= 0) {
    showError('يرجى إدخال تكلفة الصيانة بشكل صحيح (أكبر من 0)')
    return
  }
  if (!form.value.maintenance_date) {
    showError('يرجى تحديد تاريخ الصيانة')
    return
  }

  saving.value = true
  try {
    if (isEditMode.value && editingMaintenanceId.value !== null) {
      await store.updateMaintenance(editingMaintenanceId.value, {
        asset_id: props.asset.id,
        cost: form.value.cost,
        maintenance_date: form.value.maintenance_date,
        financial_account_id: form.value.financial_account_id,
        description: form.value.description.trim() || null,
      })
      showSuccess('تم تحديث عملية الصيانة بنجاح')
    } else {
      await store.createMaintenance({
        asset_id: props.asset.id,
        cost: form.value.cost,
        maintenance_date: form.value.maintenance_date,
        financial_account_id: form.value.financial_account_id,
        description: form.value.description.trim() || null,
      })
      showSuccess('تم تسجيل عملية الصيانة بنجاح')
    }

    resetForm()
    await loadMaintenances()
    emit('updated')
  } catch (e) {
    // handled by store
  } finally {
    saving.value = false
  }
}

function confirmDelete(item: AssetMaintenance) {
  confirm.require({
    message: `هل أنت متأكد من حذف عملية الصيانة بتكلفة ${formatNumber(item.cost)}؟`,
    header: 'تأكيد الحذف',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'إلغاء',
    acceptLabel: 'حذف',
    acceptClass: 'p-button-danger p-button-sm',
    rejectClass: 'p-button-text p-button-secondary p-button-sm',
    accept: async () => {
      try {
        await store.deleteMaintenance(item.id, props.asset?.id, item.cost)
        showSuccess('تم حذف عملية الصيانة بنجاح')
        if (editingMaintenanceId.value === item.id) {
          resetForm()
        }
        await loadMaintenances()
        emit('updated')
      } catch {
        // error
      }
    },
  })
}

function onClose() {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    :modal="true"
    :header="`سجل صيانة الأصل: ${props.asset?.name ?? ''}`"
    :style="{ width: '100%', maxWidth: '850px', margin: '0 20px' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div dir="rtl" class="flex flex-column gap-4">
      <!-- Asset Summary Banner -->
      <div
        v-if="props.asset"
        class="surface-ground border-round p-3 flex flex-wrap justify-content-between align-items-center gap-3 border-1 surface-border"
      >
        <div class="flex align-items-center gap-3">
          <div
            class="w-3rem h-3rem border-round surface-card flex align-items-center justify-content-center text-primary text-2xl font-bold shadow-1"
          >
            <i class="pi pi-wrench"></i>
          </div>
          <div>
            <div class="font-bold text-lg text-900">{{ props.asset.name }}</div>
            <div class="text-sm text-color-secondary flex align-items-center gap-2 mt-1">
              <span>كود: {{ props.asset.code }}</span>
              <span>•</span>
              <span>سعر الشراء: {{ formatNumber(props.asset.purchase_price) }}</span>
            </div>
          </div>
        </div>

        <div class="flex align-items-center gap-3">
          <Tag
            :value="assetStatusLabel(props.asset.status)"
            :severity="assetStatusSeverity(props.asset.status)"
            rounded
          />
          <div class="text-left">
            <span class="text-xs text-color-secondary block">إجمالي تكاليف الصيانة</span>
            <span class="text-xl font-bold text-primary">{{ formatNumber(totalSpent) }}</span>
          </div>
        </div>
      </div>

      <!-- Add / Edit Maintenance Form Card -->
      <div class="surface-card border-round p-3 border-1 surface-border shadow-1">
        <div class="flex align-items-center justify-content-between mb-3">
          <div class="font-semibold text-base flex align-items-center gap-2">
            <i class="pi" :class="isEditMode ? 'pi-pencil text-warning' : 'pi-plus-circle text-primary'"></i>
            <span>{{ isEditMode ? 'تعديل عملية صيانة' : 'إضافة عملية صيانة جديدة' }}</span>
          </div>
          <Button
            v-if="isEditMode"
            label="إلغاء التعديل"
            icon="pi pi-times"
            text
            size="small"
            class="p-button-secondary"
            @click="resetForm"
          />
        </div>

        <form @submit.prevent="saveMaintenance" class="grid formgrid p-fluid m-0">
          <div class="col-12 md:col-3 field mb-2">
            <label class="font-medium text-sm mb-1 block">تكلفة الصيانة <span class="text-red-500">*</span></label>
            <InputNumber
              v-model="form.cost"
              :min="0.01"
              :min-fraction-digits="0"
              :max-fraction-digits="2"
              placeholder="0.00"
              class="w-full"
            />
          </div>

          <div class="col-12 md:col-3 field mb-2">
            <label class="font-medium text-sm mb-1 block">تاريخ الصيانة <span class="text-red-500">*</span></label>
            <DatePicker
              v-model="datePickerValue"
              date-format="yy-mm-dd"
              show-icon
              icon-display="input"
              class="w-full"
            />
          </div>

          <div class="col-12 md:col-3 field mb-2">
            <label class="font-medium text-sm mb-1 block">خصم من الحساب المالي</label>
            <Select
              v-model="form.financial_account_id"
              :options="props.financialAccountOptions"
              option-label="label"
              option-value="value"
              placeholder="اختر الحساب (اختياري)"
              class="w-full"
              show-clear
            />
          </div>

          <div class="col-12 md:col-3 flex align-items-end mb-2">
            <Button
              type="submit"
              :label="isEditMode ? 'تحديث العملية' : 'إضافة الصيانة'"
              :icon="isEditMode ? 'pi pi-check' : 'pi pi-plus'"
              :loading="saving"
              class="w-full"
            />
          </div>

          <div class="col-12 field mb-0">
            <label class="font-medium text-sm mb-1 block">وصف / تفاصيل الصيانة</label>
            <InputText
              v-model="form.description"
              placeholder="مثال: تغيير زيت وفلاتر، صيانة دورية، إصلاح محرك..."
              class="w-full"
            />
          </div>
        </form>
      </div>

      <!-- Maintenances List DataTable -->
      <div class="surface-card border-round p-3 border-1 surface-border shadow-1">
        <div class="flex align-items-center justify-content-between mb-3">
          <div class="font-semibold text-base flex align-items-center gap-2">
            <i class="pi pi-history text-secondary"></i>
            <span>سجل العمليات السابقة ({{ maintenances.length }})</span>
          </div>
        </div>

        <div v-if="loading" class="flex justify-content-center align-items-center py-6">
          <i class="pi pi-spin pi-spinner text-3xl text-color-secondary"></i>
        </div>

        <div
          v-else-if="maintenances.length === 0"
          class="flex flex-column align-items-center justify-content-center py-6 gap-2 text-color-secondary"
        >
          <i class="pi pi-inbox text-4xl"></i>
          <p class="m-0 text-sm">لا توجد عمليات صيانة مسجلة لهذا الأصل حتى الآن</p>
        </div>

        <DataTable
          v-else
          :value="maintenances"
          data-key="id"
          responsive-layout="scroll"
          striped-rows
          class="p-datatable-sm"
        >
          <Column field="maintenance_date" header="التاريخ" style="width: 120px">
            <template #body="{ data }">
              {{ formatDateOnly(data.maintenance_date) }}
            </template>
          </Column>

          <Column field="cost" header="التكلفة" style="width: 120px">
            <template #body="{ data }">
              <span class="font-bold text-primary">{{ formatNumber(data.cost) }}</span>
            </template>
          </Column>

          <Column field="financial_account" header="الحساب المالي" style="width: 160px">
            <template #body="{ data }">
              <span v-if="data.financial_account" class="text-sm font-medium">
                <i class="pi pi-wallet text-xs text-color-secondary ml-1"></i>
                {{ data.financial_account.name }}
              </span>
              <span v-else class="text-color-secondary text-sm">—</span>
            </template>
          </Column>

          <Column field="description" header="البيان / الوصف">
            <template #body="{ data }">
              <span>{{ data.description?.trim() ? data.description : '—' }}</span>
            </template>
          </Column>

          <Column header="الإجراءات" style="width: 100px; text-align: center">
            <template #body="{ data }">
              <div class="flex justify-content-center gap-1">
                <Button
                  icon="pi pi-pencil"
                  text
                  rounded
                  size="small"
                  class="p-button-success"
                  v-tooltip.top="'تعديل'"
                  @click="startEdit(data)"
                />
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  size="small"
                  class="p-button-danger"
                  v-tooltip.top="'حذف'"
                  @click="confirmDelete(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>

      <div class="flex justify-content-end">
        <Button label="إغلاق" icon="pi pi-times" text @click="onClose" />
      </div>
    </div>
  </Dialog>
</template>
