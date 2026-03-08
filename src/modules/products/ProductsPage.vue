<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { showError } from '@/composables/useToast'
import { useProductsStore } from '@/stores/products'
import { useProductCategoriesStore } from '@/stores/productCategories'
import { useDashboardStore } from '@/stores/dashboard'
import ProductForm from '@/components/forms/ProductForm.vue'
import type { Product } from '@/types'

const route = useRoute()
const confirm = useConfirm()
const store = useProductsStore()
const categoriesStore = useProductCategoriesStore()
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

// Debounced search: refetch when topbar search changes (only on products page)
let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(
  () => dashboardStore.searchQuery,
  (q) => {
    if (route.name !== 'products') return
    if (searchDebounce) clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      store.fetchPage(1, store.perPage, q, selectedCategoryId.value, lowStockOnly.value)
      searchDebounce = null
    }, 300)
  },
)

const selectedCategoryId = ref<number | null>(null)
const lowStockOnly = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formModel = ref<Partial<Product> | null>(null)

const categoryOptions = computed(() => {
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

const formTitle = computed(() => (isEdit.value ? 'تعديل المنتج' : 'إضافة منتج'))

async function openCreate() {
  isEdit.value = false
  editingId.value = null
  formModel.value = {
    name: '',
    product_category_id: null,
    unit: 'قطعة',
    purchase_price: 0,
    sale_price: 0,
    quantity: 0,
    min_quantity: 0,
    description: '',
  }
  if (categoriesStore.allCategories.length === 0) {
    await categoriesStore.fetchAllForSelect()
  }
  dialogVisible.value = true
}

async function openEdit(row: Product) {
  isEdit.value = true
  editingId.value = row.id
  formModel.value = {
    name: row.name,
    product_category_id: row.product_category_id ?? null,
    unit: row.unit ?? 'قطعة',
    purchase_price: row.purchase_price,
    sale_price: row.sale_price,
    quantity: row.quantity,
    min_quantity: row.min_quantity,
    description: row.description ?? '',
  }
  if (categoriesStore.allCategories.length === 0) {
    await categoriesStore.fetchAllForSelect()
  }
  dialogVisible.value = true
}

async function onFormSubmit(payload: Partial<Product>) {
  try {
    if (isEdit.value && editingId.value !== null) {
      await store.update(editingId.value, payload)
    } else {
      await store.create(payload as Omit<Product, 'id'>)
    }
    dialogVisible.value = false
    await store.fetchPage(
      store.currentPage,
      store.perPage,
      dashboardStore.searchQuery,
      selectedCategoryId.value,
      lowStockOnly.value,
    )
  } catch {
    // error shown via toast
  }
}

function onFormCancel() {
  dialogVisible.value = false
}

function confirmDelete(row: Product) {
  confirm.require({
    message: `هل أنت متأكد من حذف المنتج "${row.name}"؟`,
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
          lowStockOnly.value,
        )
      } catch {
        // error shown via toast
      }
    },
  })
}

function isLowStock(product: Product) {
  return (product.min_quantity ?? 0) >= (product.quantity ?? 0)
}

function getRowClass(data: Product) {
  return isLowStock(data) ? 'product-row-low-stock' : ''
}

function onFilterChange() {
  store.fetchPage(1, store.perPage, dashboardStore.searchQuery, selectedCategoryId.value, lowStockOnly.value)
}

function onPageChange(page: number) {
  store.fetchPage(page, store.perPage, dashboardStore.searchQuery, selectedCategoryId.value, lowStockOnly.value)
}

onMounted(async () => {
  await categoriesStore.fetchAllForSelect()
  await store.fetchPage(1, store.perPage, dashboardStore.searchQuery, selectedCategoryId.value, lowStockOnly.value)
})
</script>

<template>
  <div dir="rtl">
    <div class="flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
      <div class="flex align-items-center gap-2 flex-wrap">
        <Select
          v-model="selectedCategoryId"
          :options="categoryOptions"
          option-label="label"
          option-value="value"
          placeholder="تصفية بالفئة"
          class="w-12rem"
          @change="onFilterChange"
        />
        <div class="flex align-items-center gap-2">
          <Checkbox v-model="lowStockOnly" input-id="low-stock" :binary="true" @change="onFilterChange" />
          <label for="low-stock" class="cursor-pointer text-sm">رصيد منخفض (الحد الأدنى ≥ الكمية)</label>
        </div>
      </div>
      <Button label="إضافة منتج" icon="pi pi-plus" @click="openCreate" />
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
          <i class="pi pi-box text-6xl text-color-secondary"></i>
          <p class="text-color-secondary m-0">لا يوجد منتجات</p>
          <p class="text-sm text-color-secondary m-0">أضف منتجاً جديداً للبدء</p>
          <Button label="إضافة منتج" icon="pi pi-plus" @click="openCreate" />
        </div>
        <DataTable
          v-else
          :value="store.items"
          data-key="id"
          striped-rows
          responsive-layout="scroll"
          class="p-datatable-sm"
          :row-class="getRowClass"
        >
          <Column field="name" header="الاسم" sortable />
          <Column field="category" header="الفئة">
            <template #body="{ data }">{{ data.category?.name ?? '—' }}</template>
          </Column>
          <Column field="unit" header="الوحدة">
            <template #body="{ data }">{{ data.unit ?? '—' }}</template>
          </Column>
          <Column field="purchase_price" header="سعر الشراء">
            <template #body="{ data }">{{ data.purchase_price }}</template>
          </Column>
          <Column field="sale_price" header="سعر البيع">
            <template #body="{ data }">{{ data.sale_price }}</template>
          </Column>
          <Column field="quantity" header="الكمية" />
          <Column field="min_quantity" header="الحد الأدنى" />
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
      :style="{ width: '100%', maxWidth: '600px', margin: '0 20px' }"
      @hide="dialogVisible = false"
    >
      <ProductForm
        v-if="dialogVisible"
        :model-value="formModel"
        :category-options="formCategoryOptions"
        :loading="store.loading"
        @submit="onFormSubmit"
        @cancel="onFormCancel"
      />
    </Dialog>
  </div>
</template>
