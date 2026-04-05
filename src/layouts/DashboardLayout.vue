<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import SimpleBar from 'simplebar-vue'
import 'simplebar-vue/dist/simplebar.min.css'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import { apiClient } from '@/api/axios'

const router = useRouter()
const authStore = useAuthStore()
const dashboardStore = useDashboardStore()
const sidebarVisible = ref(false)
const isDesktop = ref(true)

const mainMenuTop = [{ label: 'لوحة التحكم', to: '/dashboard', icon: 'pi pi-home' }]

const mainMenuBottom = [
  { label: 'الموظفين', to: '/employees', icon: 'pi pi-id-card' },
  { label: 'الإعدادات', to: '/settings', icon: 'pi pi-cog' },
]

const stockMenuItems = [
  { label: 'فئات المنتجات', to: '/product-categories', icon: 'pi pi-tags' },
  { label: 'المنتجات', to: '/products', icon: 'pi pi-box' },
]

const assetsMenuItems = [
  { label: 'فئات الأصول', to: '/asset-categories', icon: 'pi pi-sitemap' },
  { label: 'الأصول', to: '/assets', icon: 'pi pi-building' },
]

const purchasingMenuItems = [
  { label: 'الموردين', to: '/suppliers', icon: 'pi pi-users' },
  { label: 'فواتير الشراء', to: '/purchases', icon: 'pi pi-truck' },
]

const salesMenuItems = [
  { label: 'العملاء', to: '/customers', icon: 'pi pi-user-plus' },
  { label: 'فواتير البيع', to: '/sales', icon: 'pi pi-shopping-cart' },
]

const accountsMenuItems = [{ label: 'جاري الشركاء', to: '/partners', icon: 'pi pi-briefcase' }]

const stockExpanded = ref(false)
const assetsExpanded = ref(false)
const purchasingExpanded = ref(false)
const salesExpanded = ref(false)
const accountsExpanded = ref(false)

const isStockSectionActive = computed(
  () =>
    router.currentRoute.value.path.startsWith('/product-categories') ||
    router.currentRoute.value.path.startsWith('/products'),
)

const isAssetsSectionActive = computed(
  () =>
    router.currentRoute.value.path.startsWith('/asset-categories') ||
    router.currentRoute.value.path.startsWith('/assets'),
)

const isPurchasingSectionActive = computed(
  () =>
    router.currentRoute.value.path.startsWith('/suppliers') ||
    router.currentRoute.value.path.startsWith('/purchases'),
)

const isSalesSectionActive = computed(
  () =>
    router.currentRoute.value.path.startsWith('/customers') ||
    router.currentRoute.value.path.startsWith('/sales'),
)

const isAccountsSectionActive = computed(() =>
  router.currentRoute.value.path.startsWith('/partners'),
)

function toggleStockGroup() {
  stockExpanded.value = !stockExpanded.value
}

function toggleAssetsGroup() {
  assetsExpanded.value = !assetsExpanded.value
}

function togglePurchasingGroup() {
  purchasingExpanded.value = !purchasingExpanded.value
}

function toggleSalesGroup() {
  salesExpanded.value = !salesExpanded.value
}

function toggleAccountsGroup() {
  accountsExpanded.value = !accountsExpanded.value
}

const financialMenuItems = [
  { label: 'إعدادات الحسابات', to: '/financial/accounts', icon: 'pi pi-building-columns' },
  { label: 'الإيرادات', to: '/financial/revenues', icon: 'pi pi-arrow-down-left' },
  { label: 'المصروفات', to: '/financial/expenses', icon: 'pi pi-arrow-up-right' },
  { label: 'سجل المعاملات', to: '/financial/transactions', icon: 'pi pi-list' },
]

const financialReportsMenuItems = [
  { label: 'قائمة الدخل', to: '/financial/reports/income', icon: 'pi pi-chart-bar' },
  {
    label: 'التدفقات النقدية',
    to: '/financial/reports/cashflow',
    icon: 'pi pi-arrow-right-arrow-left',
  },
  { label: 'قائمة المركز المالي', to: '/financial/reports/balance-sheet', icon: 'pi pi-table' },
]

const financialExpanded = ref(false)

watch(
  () => router.currentRoute.value.path,
  (p) => {
    if (p.startsWith('/product-categories') || p.startsWith('/products')) stockExpanded.value = true
    if (p.startsWith('/asset-categories') || p.startsWith('/assets')) assetsExpanded.value = true
    if (p.startsWith('/suppliers') || p.startsWith('/purchases')) purchasingExpanded.value = true
    if (p.startsWith('/customers') || p.startsWith('/sales')) salesExpanded.value = true
    if (p.startsWith('/partners')) accountsExpanded.value = true
    if (p.startsWith('/financial')) financialExpanded.value = true
  },
  { immediate: true },
)

const isFinancialSectionActive = computed(() =>
  router.currentRoute.value.path.startsWith('/financial'),
)

function toggleFinancialGroup() {
  financialExpanded.value = !financialExpanded.value
}

const userDisplayName = computed(
  () => authStore.user?.name ?? authStore.user?.username ?? 'المستخدم',
)

const pageTitle = computed(() => (router.currentRoute.value.meta?.title as string) ?? 'لوحة التحكم')

const breadcrumb = computed(
  () => (router.currentRoute.value.meta?.breadcrumb as string) ?? 'لوحة التحكم',
)

function isActiveRoute(to: string) {
  if (to === '/dashboard') return router.currentRoute.value.path === '/dashboard'
  return router.currentRoute.value.path.startsWith(to)
}

const isSettingsActive = computed(() => router.currentRoute.value.name === 'settings')

function updateDesktop() {
  isDesktop.value = window.innerWidth >= 992
  if (isDesktop.value) sidebarVisible.value = false
}

function openSidebar() {
  sidebarVisible.value = true
}

function closeSidebar() {
  sidebarVisible.value = false
}

async function logout() {
  try {
    await apiClient.post('/logout')
  } finally {
    authStore.logout()
    router.push('/login')
  }
}

onMounted(() => {
  updateDesktop()
  window.addEventListener('resize', updateDesktop)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateDesktop)
})
</script>

<template>
  <div class="dashboard-layout" dir="rtl">
    <!-- Fixed sidebar - visible on desktop -->
    <aside class="sidebar sidebar-desktop">
      <div class="sidebar-brand">
        <div class="sidebar-logo">
          <span class="logo-letter">م</span>
        </div>
        <div class="flex flex-column">
          <span class="text-md font-bold p-0 m-0">مدير 360</span>
          <span class="text-sm text-gray-500 p-0">محمود رأفت لمواد البناء</span>
        </div>
      </div>

      <SimpleBar class="sidebar-scroll" data-simplebar-direction="rtl">
        <div class="sidebar-section">
          <span class="sidebar-section-title">القائمة الرئيسية</span>
          <nav class="sidebar-nav">
            <button
              v-for="item in mainMenuTop"
              :key="item.to"
              type="button"
              :class="['sidebar-item', { 'sidebar-item-active': isActiveRoute(item.to) }]"
              @click="router.push(item.to)"
            >
              <i :class="['pi', item.icon, 'sidebar-icon']"></i>
              <span>{{ item.label }}</span>
            </button>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isAssetsSectionActive }"
                @click="toggleAssetsGroup"
              >
                <i class="pi pi-building sidebar-icon"></i>
                <span class="flex-1 text-right">الأصول</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    assetsExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': assetsExpanded }"
                :inert="!assetsExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in assetsMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="router.push(item.to)"
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isStockSectionActive }"
                @click="toggleStockGroup"
              >
                <i class="pi pi-box sidebar-icon"></i>
                <span class="flex-1 text-right">المخزون</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    stockExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': stockExpanded }"
                :inert="!stockExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in stockMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="router.push(item.to)"
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isPurchasingSectionActive }"
                @click="togglePurchasingGroup"
              >
                <i class="pi pi-shopping-bag sidebar-icon"></i>
                <span class="flex-1 text-right">المشتريات</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    purchasingExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': purchasingExpanded }"
                :inert="!purchasingExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in purchasingMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="router.push(item.to)"
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isSalesSectionActive }"
                @click="toggleSalesGroup"
              >
                <i class="pi pi-chart-line sidebar-icon"></i>
                <span class="flex-1 text-right">المبيعات</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    salesExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': salesExpanded }"
                :inert="!salesExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in salesMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="router.push(item.to)"
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isAccountsSectionActive }"
                @click="toggleAccountsGroup"
              >
                <i class="pi pi-book sidebar-icon"></i>
                <span class="flex-1 text-right">الحسابات</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    accountsExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': accountsExpanded }"
                :inert="!accountsExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in accountsMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="router.push(item.to)"
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isFinancialSectionActive }"
                @click="toggleFinancialGroup"
              >
                <i class="pi pi-wallet sidebar-icon"></i>
                <span class="flex-1 text-right">المالية</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    financialExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': financialExpanded }"
                :inert="!financialExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in financialMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="router.push(item.to)"
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                    <span class="sidebar-subsection-label">التقارير المالية</span>
                    <button
                      v-for="item in financialReportsMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="router.push(item.to)"
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              v-for="item in mainMenuBottom"
              :key="item.to"
              type="button"
              :class="['sidebar-item', { 'sidebar-item-active': isActiveRoute(item.to) }]"
              @click="router.push(item.to)"
            >
              <i :class="['pi', item.icon, 'sidebar-icon']"></i>
              <span>{{ item.label }}</span>
            </button>
          </nav>
        </div>
      </SimpleBar>
    </aside>

    <!-- Mobile sidebar overlay -->
    <Transition name="sidebar-overlay">
      <div
        v-if="sidebarVisible && !isDesktop"
        class="sidebar-overlay"
        aria-hidden="true"
        @click="closeSidebar"
      />
    </Transition>

    <!-- Mobile sidebar drawer -->
    <aside
      :class="['sidebar', 'sidebar-mobile', { 'sidebar-mobile-open': sidebarVisible }]"
      role="dialog"
      aria-modal="true"
      :aria-hidden="!sidebarVisible"
    >
      <div class="sidebar-brand sidebar-brand-mobile">
        <div class="flex align-items-center gap-2 flex-1">
          <div class="sidebar-logo">
            <span class="logo-letter">م</span>
          </div>
          <div class="flex flex-column">
            <span class="text-md font-bold p-0 m-0">مدير 360</span>
            <span class="text-sm text-gray-500 p-0">محمود رأفت لمواد البناء</span>
          </div>
        </div>
        <button type="button" class="sidebar-close" aria-label="إغلاق" @click="closeSidebar">
          <i class="pi pi-times"></i>
        </button>
      </div>
      <SimpleBar class="sidebar-scroll" data-simplebar-direction="rtl">
        <div class="sidebar-section">
          <span class="sidebar-section-title">القائمة الرئيسية</span>
          <nav class="sidebar-nav">
            <button
              v-for="item in mainMenuTop"
              :key="item.to"
              type="button"
              :class="['sidebar-item', { 'sidebar-item-active': isActiveRoute(item.to) }]"
              @click="
                () => {
                  router.push(item.to)
                  closeSidebar()
                }
              "
            >
              <i :class="['pi', item.icon, 'sidebar-icon']"></i>
              <span>{{ item.label }}</span>
            </button>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isStockSectionActive }"
                @click="toggleStockGroup"
              >
                <i class="pi pi-box sidebar-icon"></i>
                <span class="flex-1 text-right">المخزون</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    stockExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': stockExpanded }"
                :inert="!stockExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in stockMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="
                        () => {
                          router.push(item.to)
                          closeSidebar()
                        }
                      "
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isAssetsSectionActive }"
                @click="toggleAssetsGroup"
              >
                <i class="pi pi-building sidebar-icon"></i>
                <span class="flex-1 text-right">الأصول</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    assetsExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': assetsExpanded }"
                :inert="!assetsExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in assetsMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="
                        () => {
                          router.push(item.to)
                          closeSidebar()
                        }
                      "
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isPurchasingSectionActive }"
                @click="togglePurchasingGroup"
              >
                <i class="pi pi-shopping-bag sidebar-icon"></i>
                <span class="flex-1 text-right">المشتريات</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    purchasingExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': purchasingExpanded }"
                :inert="!purchasingExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in purchasingMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="
                        () => {
                          router.push(item.to)
                          closeSidebar()
                        }
                      "
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isSalesSectionActive }"
                @click="toggleSalesGroup"
              >
                <i class="pi pi-chart-line sidebar-icon"></i>
                <span class="flex-1 text-right">المبيعات</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    salesExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': salesExpanded }"
                :inert="!salesExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in salesMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="
                        () => {
                          router.push(item.to)
                          closeSidebar()
                        }
                      "
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isAccountsSectionActive }"
                @click="toggleAccountsGroup"
              >
                <i class="pi pi-book sidebar-icon"></i>
                <span class="flex-1 text-right">الحسابات</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    accountsExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': accountsExpanded }"
                :inert="!accountsExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in accountsMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="
                        () => {
                          router.push(item.to)
                          closeSidebar()
                        }
                      "
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-group">
              <button
                type="button"
                class="sidebar-group-header"
                :class="{ 'sidebar-item-active': isFinancialSectionActive }"
                @click="toggleFinancialGroup"
              >
                <i class="pi pi-wallet sidebar-icon"></i>
                <span class="flex-1 text-right">المالية</span>
                <i
                  :class="[
                    'pi sidebar-chevron',
                    financialExpanded ? 'pi-chevron-up' : 'pi-chevron-down',
                  ]"
                ></i>
              </button>
              <div
                class="sidebar-subnav-collapse"
                :class="{ 'sidebar-subnav-collapse--open': financialExpanded }"
                :inert="!financialExpanded"
              >
                <div class="sidebar-subnav-collapse__inner">
                  <div class="sidebar-subnav">
                    <button
                      v-for="item in financialMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="
                        () => {
                          router.push(item.to)
                          closeSidebar()
                        }
                      "
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                    <span class="sidebar-subsection-label">التقارير المالية</span>
                    <button
                      v-for="item in financialReportsMenuItems"
                      :key="item.to"
                      type="button"
                      :class="[
                        'sidebar-item',
                        'sidebar-subitem',
                        { 'sidebar-item-active': isActiveRoute(item.to) },
                      ]"
                      @click="
                        () => {
                          router.push(item.to)
                          closeSidebar()
                        }
                      "
                    >
                      <i :class="['pi', item.icon, 'sidebar-icon']"></i>
                      <span>{{ item.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              v-for="item in mainMenuBottom"
              :key="item.to"
              type="button"
              :class="['sidebar-item', { 'sidebar-item-active': isActiveRoute(item.to) }]"
              @click="
                () => {
                  router.push(item.to)
                  closeSidebar()
                }
              "
            >
              <i :class="['pi', item.icon, 'sidebar-icon']"></i>
              <span>{{ item.label }}</span>
            </button>
          </nav>
        </div>
      </SimpleBar>
    </aside>

    <!-- Mobile menu button -->
    <button
      v-if="!isDesktop"
      type="button"
      class="mobile-menu-btn"
      aria-label="فتح القائمة"
      @click="openSidebar"
    >
      <i class="pi pi-bars"></i>
    </button>

    <!-- Main content -->
    <div class="main-content">
      <header class="main-header">
        <div class="header-right">
          <div class="breadcrumb">
            <span class="breadcrumb-path">الصفحات</span>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-current">{{ breadcrumb }}</span>
          </div>
          <h1 class="page-title">{{ pageTitle }}</h1>
        </div>
        <div class="header-left">
          <div class="header-search">
            <i class="pi pi-search header-search-icon"></i>
            <InputText
              :model-value="dashboardStore.searchQuery"
              placeholder="ابحث هنا..."
              class="header-search-input"
              @update:model-value="dashboardStore.setSearchQuery"
            />
          </div>
          <button
            type="button"
            :class="['header-icon-btn', { 'header-icon-btn-active': isSettingsActive }]"
            aria-label="الإعدادات"
            @click="router.push({ name: 'settings' })"
          >
            <i class="pi pi-cog"></i>
          </button>
          <div class="header-user">
            <span class="header-user-name">{{ userDisplayName }}</span>
            <Button
              label="تسجيل الخروج"
              icon="pi pi-sign-out"
              icon-pos="right"
              severity="secondary"
              size="small"
              @click="logout"
            />
          </div>
        </div>
      </header>
      <main class="main-body">
        <router-view v-slot="{ Component, route }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </Transition>
        </router-view>
      </main>
      <footer class="main-footer">
        <span class="footer-text"
          >© {{ new Date().getFullYear() }} مدير 360 - نظام إدارة الأعمال · Powered by
          SwiftCare</span
        >
      </footer>
    </div>
  </div>
</template>

<style scoped>
.dashboard-layout {
  display: flex;
  min-height: 100vh;
  background: #f0f2f5;
}

/* Sidebar */
.sidebar {
  flex-direction: column;
  background: transparent;
}

.sidebar-desktop {
  display: none;
  position: fixed;
  top: 0;
  right: 0;
  width: 17rem;
  height: 100vh;
  z-index: 40;
}

@media (min-width: 992px) {
  .sidebar-desktop {
    display: flex;
  }
}

.sidebar-brand {
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sidebar-brand-mobile {
  justify-content: space-between;
}

.sidebar-logo {
  width: 2.25rem;
  height: 2.25rem;
  background: #008cff;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-letter {
  color: white;
  font-size: 1.25rem;
  font-weight: 700;
}

.sidebar-brand-text {
  font-size: 1rem;
  font-weight: 700;
  color: #2d3748;
}

.sidebar-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
}

/* Vertical track on the inner (left) edge of the sidebar, next to main content */
.sidebar-scroll :deep(.simplebar-track.simplebar-vertical) {
  right: auto !important;
  left: 0;
}

.sidebar-section {
  padding: 1rem 0.75rem;
}

.sidebar-section-title {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  color: #a0aec0;
  letter-spacing: 0.05em;
  padding: 0 1rem 0.5rem;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 0.75rem;
  background: transparent;
  color: #4a5568;
  font-size: 0.9rem;
  text-align: right;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

/* hover: المظهر السابق للعنصر النشط (بطاقة بيضاء خفيفة) */
.sidebar-item:hover:not(.sidebar-item-active) {
  background: white;
  color: #2d3748;
  font-weight: 600;
  box-shadow: none;
  transform: none;
}

/* active: المظهر السابق للـ hover (شريط لوني + تمييز) */
.sidebar-item-active {
  background: rgba(0, 140, 255, 0.09);
  color: #1a202c;
  font-weight: 600;
  box-shadow: inset 3px 0 0 0 #008cff;
  transform: translateX(-2px);
}

.sidebar-item-active:hover {
  background: #f0f9ff;
}

.sidebar-icon {
  font-size: 1.125rem;
  color: #718096;
  transition:
    color 0.2s ease,
    transform 0.2s ease;
}

.sidebar-item:hover:not(.sidebar-item-active) .sidebar-icon {
  color: #008cff;
  transform: none;
}

.sidebar-item-active .sidebar-icon {
  color: #008cff;
  transform: scale(1.06);
}

.sidebar-item-active:hover .sidebar-icon {
  color: #0077e6;
}

.sidebar-group {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sidebar-group-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 0.75rem;
  background: transparent;
  color: #4a5568;
  font-size: 0.9rem;
  text-align: right;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.sidebar-group-header:hover:not(.sidebar-item-active) {
  background: white;
  color: #2d3748;
  font-weight: 600;
  box-shadow: none;
  transform: none;
}

.sidebar-group-header:hover:not(.sidebar-item-active) .sidebar-icon {
  color: #008cff;
  transform: none;
}

.sidebar-group-header.sidebar-item-active {
  background: rgba(0, 140, 255, 0.09);
  color: #1a202c;
  font-weight: 600;
  box-shadow: inset 3px 0 0 0 #008cff;
  transform: translateX(-2px);
}

.sidebar-group-header.sidebar-item-active:hover {
  background: #f0f9ff;
}

.sidebar-group-header.sidebar-item-active .sidebar-icon {
  color: #008cff;
  transform: scale(1.06);
}

.sidebar-group-header.sidebar-item-active:hover .sidebar-icon {
  color: #0077e6;
}

.sidebar-chevron {
  font-size: 0.75rem;
  color: #a0aec0;
  flex-shrink: 0;
}

.sidebar-subnav-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-subnav-collapse--open {
  grid-template-rows: 1fr;
}

.sidebar-subnav-collapse__inner {
  min-height: 0;
  overflow: hidden;
}

.sidebar-subnav {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin-right: 0.35rem;
  padding-right: 0.5rem;
  border-right: 2px solid #e2e8f0;
}

.sidebar-subitem {
  font-size: 0.85rem;
  padding: 0.5rem 0.75rem 0.5rem 1rem !important;
  border-radius: 0.5rem;
}

.sidebar-subitem .sidebar-icon {
  font-size: 1rem;
}

/* روابط فرعية نشطة — زوايا دائرية؛ لون أساسي + خلفية شفافة */
.sidebar-item.sidebar-subitem.sidebar-item-active {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  color: var(--p-primary-color);
  font-weight: 600;
  box-shadow: none;
  transform: none;
  border: none;
}

.sidebar-item.sidebar-subitem.sidebar-item-active:hover {
  background: color-mix(in srgb, var(--p-primary-color) 16%, transparent);
}

.sidebar-item.sidebar-subitem.sidebar-item-active .sidebar-icon {
  color: var(--p-primary-color);
  transform: scale(1.04);
}

.sidebar-item.sidebar-subitem.sidebar-item-active:hover .sidebar-icon {
  color: var(--p-primary-hover-color);
}

.sidebar-subsection-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  color: #a0aec0;
  padding: 0.5rem 0.75rem 0.25rem;
  margin-top: 0.25rem;
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-item,
  .sidebar-group-header,
  .sidebar-icon {
    transition: none;
  }

  .sidebar-subnav-collapse {
    transition: none;
  }

  .sidebar-item-active,
  .sidebar-item-active:hover,
  .sidebar-group-header.sidebar-item-active,
  .sidebar-group-header.sidebar-item-active:hover {
    transform: none;
  }

  .sidebar-item-active .sidebar-icon,
  .sidebar-item-active:hover .sidebar-icon,
  .sidebar-group-header.sidebar-item-active .sidebar-icon,
  .sidebar-group-header.sidebar-item-active:hover .sidebar-icon,
  .sidebar-item.sidebar-subitem.sidebar-item-active .sidebar-icon,
  .sidebar-item.sidebar-subitem.sidebar-item-active:hover .sidebar-icon {
    transform: none;
  }
}

/* Mobile sidebar */
.sidebar-mobile {
  display: flex;
  position: fixed;
  top: 0;
  right: 0;
  width: 17rem;
  height: 100vh;
  z-index: 50;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  background: white;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
}

@media (min-width: 992px) {
  .sidebar-mobile {
    display: none;
  }
}

.sidebar-mobile-open {
  transform: translateX(0);
}

.sidebar-close {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 0.5rem;
  color: #4a5568;
  cursor: pointer;
}

.sidebar-close:hover {
  background: #edf2f7;
}

/* Overlay */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 45;
}

@media (min-width: 992px) {
  .sidebar-overlay {
    display: none;
  }
}

.sidebar-overlay-enter-active,
.sidebar-overlay-leave-active {
  transition: opacity 0.3s ease;
}

.sidebar-overlay-enter-from,
.sidebar-overlay-leave-to {
  opacity: 0;
}

/* Mobile menu button */
.mobile-menu-btn {
  display: flex;
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 3rem;
  height: 3rem;
  align-items: center;
  justify-content: center;
  background: #008cff;
  color: white;
  border: none;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0, 140, 255, 0.4);
  cursor: pointer;
  z-index: 30;
  font-size: 1.25rem;
}

.mobile-menu-btn:hover {
  background: #0077e6;
}

@media (min-width: 992px) {
  .mobile-menu-btn {
    display: none;
  }
}

/* Main content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-right: 0;
  transition: margin 0.2s;
}

@media (min-width: 992px) {
  .main-content {
    margin-right: 17rem;
  }
}

/* Header */
.main-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1.25rem 1.5rem;
  background: transparent;
}

.header-right {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #718096;
}

.breadcrumb-sep {
  color: #a0aec0;
  font-size: 0.8rem;
}

.breadcrumb-current {
  color: #008cff;
  font-weight: 600;
}

.page-title {
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.header-search {
  position: relative;
}

.header-search-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #a0aec0;
  font-size: 0.9rem;
}

.header-search-input {
  width: 10rem;
  min-width: 8rem;
  padding: 0.5rem 2rem 0.5rem 0.75rem !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 0.5rem !important;
  font-size: 0.875rem !important;
}

@media (max-width: 576px) {
  .header-search {
    display: none;
  }
}

.header-search-input::placeholder {
  color: #a0aec0;
}

.header-icon-btn {
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 0.5rem;
  color: #4a5568;
  cursor: pointer;
}

.header-icon-btn:hover {
  background: #f7fafc;
  color: #2d3748;
}

.header-icon-btn-active {
  background: white;
  color: #008cff;
}

.header-icon-btn-active:hover {
  background: #f7fafc;
  color: #008cff;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-user-name {
  font-size: 0.875rem;
  color: #4a5568;
}

/* Main body */
.main-body {
  flex: 1;
  padding: 1.5rem;
  overflow: auto;
}

/* Footer */
.main-footer {
  padding: 1rem 1.5rem;
  background: transparent;
}

.footer-text {
  font-size: 0.8rem;
  color: #718096;
}

@media print {
  aside.sidebar,
  .sidebar-overlay,
  .mobile-menu-btn,
  .main-header,
  .main-footer {
    display: none !important;
  }

  .dashboard-layout {
    background: #fff !important;
    min-height: auto !important;
  }

  .main-content {
    margin-right: 0 !important;
  }

  .main-body {
    padding: 0 !important;
    overflow: visible !important;
  }
}
</style>
