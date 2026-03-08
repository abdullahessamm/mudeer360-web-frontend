import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value !== null)

  async function fetchCsrfCookie() {
    await apiClient.get('/sanctum/csrf-cookie')
  }

  async function login(username: string, password: string) {
    loading.value = true
    error.value = null
    try {
      await fetchCsrfCookie()
      await apiClient.post('/login', { username, password })
      await fetchUser()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'فشل تسجيل الدخول'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchUser() {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get<{ success?: boolean; payload?: { user?: User } }>('/api/auth/user')
      const u = data?.payload?.user ?? (data as unknown as { user?: User })?.user
      user.value = u ?? null
      return u
    } catch (e: unknown) {
      user.value = null
      throw e
    } finally {
      loading.value = false
    }
  }

  function logout() {
    user.value = null
    error.value = null
  }

  function clearError() {
    error.value = null
  }

  async function updateProfile(data: { name: string; username: string }) {
    loading.value = true
    error.value = null
    try {
      const { data: res } = await apiClient.put<{ success?: boolean; payload?: { user?: User } }>('/api/auth/profile', data)
      const u = res?.payload?.user ?? (res as unknown as { user?: User })?.user
      if (u) user.value = u
      return u
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'فشل تحديث الملف الشخصي'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function changePassword(data: {
    current_password: string
    password: string
    password_confirmation: string
  }) {
    loading.value = true
    error.value = null
    try {
      await apiClient.put('/api/auth/password', data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'فشل تغيير كلمة المرور'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    fetchUser,
    logout,
    clearError,
    updateProfile,
    changePassword,
  }
})
