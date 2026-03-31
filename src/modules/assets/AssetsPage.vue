<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { showError } from '@/composables/useToast'
import { useAssetsStore } from '@/stores/assets'
import { useAssetCategoriesStore } from '@/stores/assetCategories'
import { useDashboardStore } from '@/stores/dashboard'
import { formatDateOnly } from '@/lib/date'
import { assetStatusLabel, ASSET_STATUS_OPTIONS } from '@/lib/assetStatus'
import AssetForm from '@/components/forms/AssetForm.vue'
import type { Asset } from '@/types'

const route = useRoute()
const confirm = useConfirm()
const store = useAssetsStore()
const categoriesStore = useAssetCategoriesStore()
const dashboardStore = useDashboardStore()

watch(
  () => store.error,
  (err) => {
    if (err) {
      showError(err)
      store.clearError()
    }
  },
)

let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(
  () => dashboardStore.searchQuery,
  (q) => {
    if (route.name !== 'assets') return
    if (searchDebounce) clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      store.fetchPage(1, store.perPage, q, selectedCategoryId.value, selectedStatus.value)
      searchDebounce = null
    }, 300)
  },
)

const selectedCategoryId = ref<number | null>(null)
const selectedStatus = ref<string | null>(null)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formModel = ref<(Partial<Asset> & { auto_generate_code?: boolean }) | null>(null)

const categoryFilterOptions = computed(() => {
  const list = categoriesStore.allCategories.length
    ? categoriesStore.allCategories
    : categoriesStore.items
  return [{ label: '— الكل —', value: null }, ...list.map((c) => ({ label: c.name, value: c.id }))]
})

const formCategoryOptions = computed(() => {
  const list = categoriesStore.allCategories.length
    ? categoriesStore.allCategories
    : categoriesStore.items
  return list.map((c) => ({ label: c.name, value: c.id }))
})

const statusFilterOptions = computed(() => [
  { label: '— الكل —', value: null },
  ...ASSET_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
])

const formTitle = computed(() => (isEdit.value ? 'تعديل الأصل' : 'إضافة أصل'))

async function openCreate() {
  isEdit.value = false
  editingId.value = null
  formModel.value = {
    code: '',
    auto_generate_code: true,
    name: '',
    asset_category_id: null,
    purchase_price: 0,
    purchase_date: undefined,
    status: 'working',
    location: '',
    notes: '',
  }
  if (categoriesStore.allCategories.length === 0) {
    await categoriesStore.fetchAllForSelect()
  }
  dialogVisible.value = true
}

async function openEdit(row: Asset) {
  isEdit.value = true
  editingId.value = row.id
  formModel.value = {
    code: row.code,
    auto_generate_code: false,
    name: row.name,
    asset_category_id: row.asset_category_id ?? null,
    purchase_price: row.purchase_price,
    purchase_date: row.purchase_date,
    status: row.status,
    location: row.location ?? '',
    notes: row.notes ?? '',
  }
  if (categoriesStore.allCategories.length === 0) {
    await categoriesStore.fetchAllForSelect()
  }
  dialogVisible.value = true
}

async function onFormSubmit(payload: Partial<Asset> & { auto_generate_code?: boolean }) {
  try {
    if (isEdit.value && editingId.value !== null) {
      await store.update(editingId.value, payload)
    } else {
      await store.create(payload as Omit<Asset, 'id'>)
    }
    dialogVisible.value = false
    await store.fetchPage(
      store.currentPage,
      store.perPage,
      dashboardStore.searchQuery,
      selectedCategoryId.value,
      selectedStatus.value,
    )
  } catch {
    // error shown via toast
  }
}

function onFormCancel() {
  dialogVisible.value = false
}

function confirmDelete(row: Asset) {
  confirm.require({
    message: `هل أنت متأكد من حذف الأصل "${row.name}"؟`,
    header: 'تأكيد الحذف',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'إلغاء',
    acceptLabel: 'حذف',
    acceptClass: 'p-button-danger p-button-sm',
    rejectClass: 'p-button-text p-button-secondary p-button-sm',
    acceptIcon: 'pi pi-trash',

    accept: async () => {
      try {
        await store.remove(row.id)
        await store.fetchPage(
          store.currentPage,
          store.perPage,
          dashboardStore.searchQuery,
          selectedCategoryId.value,
          selectedStatus.value,
        )
      } catch {
        // error shown via toast
      }
    },
  })
}

function onFilterChange() {
  store.fetchPage(
    1,
    store.perPage,
    dashboardStore.searchQuery,
    selectedCategoryId.value,
    selectedStatus.value,
  )
}

function onPageChange(page: number) {
  store.fetchPage(
    page,
    store.perPage,
    dashboardStore.searchQuery,
    selectedCategoryId.value,
    selectedStatus.value,
  )
}

function formatPrice(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

onMounted(async () => {
  await categoriesStore.fetchAllForSelect()
  await store.fetchPage(
    1,
    store.perPage,
    dashboardStore.searchQuery,
    selectedCategoryId.value,
    selectedStatus.value,
  )
})
</script>

<template>
  <div dir="rtl">
    <div class="flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
      <div class="flex align-items-center gap-2 flex-wrap">
        <Select
          v-model="selectedCategoryId"
          :options="categoryFilterOptions"
          option-label="label"
          option-value="value"
          placeholder="تصفية بالفئة"
          class="w-12rem"
          @change="onFilterChange"
        />
        <Select
          v-model="selectedStatus"
          :options="statusFilterOptions"
          option-label="label"
          option-value="value"
          placeholder="تصفية بالحالة"
          class="w-12rem"
          @change="onFilterChange"
        />
      </div>
      <Button label="إضافة أصل" icon="pi pi-plus" @click="openCreate" />
    </div>
    <Card>
      <template #content>
        <div v-if="store.loading" class="flex justify-content-center align-items-center py-8">
          <i class="pi pi-spin pi-spinner text-4xl text-color-secondary"></i>
        </div>
        <div
          v-else-if="store.items.length === 0"
          class="flex flex-column align-items-center justify-content-center py-8 gap-3 empty-state"
        >
          <i class="pi pi-building text-6xl text-color-secondary"></i>
          <p class="text-color-secondary m-0">لا توجد أصول</p>
          <p class="text-sm text-color-secondary m-0">أضف أصلاً جديداً للبدء</p>
          <Button label="إضافة أصل" icon="pi pi-plus" @click="openCreate" />
        </div>
        <DataTable
          v-else
          :value="store.items"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          class="p-datatable-sm"
        >
          <Column field="code" header="الكود" />
          <Column field="name" header="الاسم" sortable />
          <Column field="category" header="الفئة">
            <template #body="{ data }">{{ data.category?.name ?? '—' }}</template>
          </Column>
          <Column field="purchase_price" header="سعر الشراء">
            <template #body="{ data }">{{ formatPrice(data.purchase_price) }}</template>
          </Column>
          <Column field="purchase_date" header="تاريخ الشراء">
            <template #body="{ data }">{{ formatDateOnly(data.purchase_date) || '—' }}</template>
          </Column>
          <Column field="status" header="الحالة">
            <template #body="{ data }">{{ assetStatusLabel(data.status) }}</template>
          </Column>
          <Column field="location" header="الموقع">
            <template #body="{ data }">{{ data.location?.trim() ? data.location : '—' }}</template>
          </Column>
          <Column header="الإجراءات" style="width: 200px">
            <template #body="{ data }">
              <Button
                label="تعديل"
                icon="pi pi-pencil"
                text
                size="small"
                class="p-button-success"
                @click="openEdit(data)"
              />
              <Button
                label="حذف"
                icon="pi pi-trash"
                text
                size="small"
                class="p-button-danger"
                @click="confirmDelete(data)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
      <template v-if="store.lastPage > 1" #footer>
        <div class="flex justify-content-between align-items-center">
          <span class="text-sm text-color-secondary">
            عرض {{ store.meta?.from ?? 0 }} - {{ store.meta?.to ?? 0 }} من {{ store.total }}
          </span>
          <div class="flex gap-1">
            <Button
              icon="pi pi-chevron-right"
              text
              size="small"
              :disabled="store.currentPage <= 1"
              @click="onPageChange(store.currentPage - 1)"
            />
            <span class="flex align-items-center px-2 text-sm">
              {{ store.currentPage }} / {{ store.lastPage }}
            </span>
            <Button
              icon="pi pi-chevron-left"
              text
              size="small"
              :disabled="store.currentPage >= store.lastPage"
              @click="onPageChange(store.currentPage + 1)"
            />
          </div>
        </div>
      </template>
    </Card>
    <Dialog
      v-model:visible="dialogVisible"
      :header="formTitle"
      :modal="true"
      :style="{ width: '100%', maxWidth: '600px', margin: '0 20px' }"
      @hide="dialogVisible = false"
    >
      <AssetForm
        v-if="dialogVisible"
        :model-value="formModel"
        :category-options="formCategoryOptions"
        :is-edit="isEdit"
        :loading="store.loading"
        @submit="onFormSubmit"
        @cancel="onFormCancel"
      />
    </Dialog>
  </div>
</template>
