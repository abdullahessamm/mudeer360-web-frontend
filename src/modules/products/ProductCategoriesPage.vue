<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { showError } from '@/composables/useToast'
import { useProductCategoriesStore } from '@/stores/productCategories'
import { useDashboardStore } from '@/stores/dashboard'
import ProductCategoryForm from '@/components/forms/ProductCategoryForm.vue'
import type { ProductCategory } from '@/types'

const route = useRoute()
const confirm = useConfirm()
const store = useProductCategoriesStore()
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

// Debounced search: refetch when topbar search changes (only on product-categories page)
let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(
  () => dashboardStore.searchQuery,
  (q) => {
    if (route.name !== 'product-categories') return
    if (searchDebounce) clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      store.fetchPage(1, store.perPage, q)
      searchDebounce = null
    }, 300)
  },
)

const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formModel = ref<Partial<ProductCategory> | null>(null)

const formTitle = computed(() => (isEdit.value ? 'تعديل الفئة' : 'إضافة فئة'))

function openCreate() {
  isEdit.value = false
  editingId.value = null
  formModel.value = { name: '' }
  dialogVisible.value = true
}

function openEdit(row: ProductCategory) {
  isEdit.value = true
  editingId.value = row.id
  formModel.value = { name: row.name }
  dialogVisible.value = true
}

async function onFormSubmit(payload: { name: string }) {
  try {
    if (isEdit.value && editingId.value !== null) {
      await store.update(editingId.value, payload)
    } else {
      await store.create(payload)
    }
    dialogVisible.value = false
    await store.fetchPage(store.currentPage, store.perPage, dashboardStore.searchQuery)
  } catch {
    // error shown via toast
  }
}

function onFormCancel() {
  dialogVisible.value = false
}

function confirmDelete(row: ProductCategory) {
  confirm.require({
    message: `هل أنت متأكد من حذف الفئة "${row.name}"؟`,
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
        await store.fetchPage(store.currentPage, store.perPage, dashboardStore.searchQuery)
      } catch {
        // error shown via toast
      }
    },
  })
}

function onPageChange(page: number) {
  store.fetchPage(page, store.perPage, dashboardStore.searchQuery)
}

onMounted(async () => {
  await store.fetchPage(1, store.perPage, dashboardStore.searchQuery)
  await store.fetchAllForSelect()
})
</script>

<template>
  <div dir="rtl">
    <div class="flex justify-content-end mb-4">
      <Button label="إضافة فئة" icon="pi pi-plus" @click="openCreate" />
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
          <i class="pi pi-tags text-6xl text-color-secondary"></i>
          <p class="text-color-secondary m-0">لا توجد فئات منتجات</p>
          <p class="text-sm text-color-secondary m-0">أضف فئة جديدة للبدء</p>
          <Button label="إضافة فئة" icon="pi pi-plus" @click="openCreate" />
        </div>
        <DataTable
          v-else
          :value="store.items"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          class="p-datatable-sm"
        >
          <Column field="name" header="الاسم" sortable />
          <Column header="الإجراءات" style="width: 180px">
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
      :style="{ width: '360px' }"
      @hide="dialogVisible = false"
    >
      <ProductCategoryForm
        v-if="dialogVisible"
        :model-value="formModel"
        @submit="onFormSubmit"
        @cancel="onFormCancel"
      />
    </Dialog>
  </div>
</template>
