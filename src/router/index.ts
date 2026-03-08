import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import DashboardLayout from '@/layouts/DashboardLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/modules/auth/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: DashboardLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/modules/dashboard/DashboardPage.vue'),
          meta: { title: 'لوحة التحكم', breadcrumb: 'لوحة التحكم' },
        },
        {
          path: 'products',
          name: 'products',
          component: () => import('@/modules/products/ProductsPage.vue'),
          meta: { title: 'المنتجات', breadcrumb: 'المنتجات' },
        },
        {
          path: 'product-categories',
          name: 'product-categories',
          component: () => import('@/modules/products/ProductCategoriesPage.vue'),
          meta: { title: 'فئات المنتجات', breadcrumb: 'فئات المنتجات' },
        },
        {
          path: 'suppliers',
          name: 'suppliers',
          component: () => import('@/modules/suppliers/SuppliersPage.vue'),
          meta: { title: 'الموردين', breadcrumb: 'الموردين' },
        },
        {
          path: 'suppliers/:id/invoices',
          name: 'supplier-invoices',
          component: () => import('@/modules/suppliers/SupplierInvoicesPage.vue'),
          meta: { title: 'فواتير المورد', breadcrumb: 'فواتير الشراء' },
        },
        {
          path: 'customers',
          name: 'customers',
          component: () => import('@/modules/customers/CustomersPage.vue'),
          meta: { title: 'العملاء', breadcrumb: 'العملاء' },
        },
        {
          path: 'customers/:id/invoices',
          name: 'customer-invoices',
          component: () => import('@/modules/customers/CustomerInvoicesPage.vue'),
          meta: { title: 'فواتير العميل', breadcrumb: 'فواتير البيع' },
        },
        {
          path: 'sales',
          name: 'sales',
          component: () => import('@/modules/sales/SalesPage.vue'),
          meta: { title: 'فواتير البيع', breadcrumb: 'فواتير البيع' },
        },
        {
          path: 'purchases',
          name: 'purchases',
          component: () => import('@/modules/purchases/PurchasesPage.vue'),
          meta: { title: 'فواتير الشراء', breadcrumb: 'فواتير الشراء' },
        },
        {
          path: 'financial-transactions',
          name: 'financial-transactions',
          component: () => import('@/modules/financial/FinancialTransactionsPage.vue'),
          meta: { title: 'المعاملات المالية', breadcrumb: 'المعاملات المالية' },
        },
        {
          path: 'employees',
          name: 'employees',
          component: () => import('@/modules/employees/EmployeesPage.vue'),
          meta: { title: 'الموظفين', breadcrumb: 'الموظفين' },
        },
        {
          path: 'employees/:id',
          name: 'employee-detail',
          component: () => import('@/modules/employees/EmployeeDetailPage.vue'),
          meta: { title: 'تفاصيل الموظف', breadcrumb: 'الموظفين' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/modules/settings/ProfileSettingsPage.vue'),
          meta: { title: 'الإعدادات', breadcrumb: 'الإعدادات' },
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    try {
      await authStore.fetchUser()
    } catch {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }
  if (to.name === 'login' && authStore.isAuthenticated) {
    const redirect = (to.query.redirect as string) ?? '/dashboard'
    return redirect
  }
})

export default router
