<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showError } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import loginImage from '@/assets/images/login-rafiki.png'
import swiftcareLogo from '@/assets/images/swiftcare-logo.png'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

watch(
  () => authStore.error,
  (err) => {
    if (err) {
      showError(err)
      authStore.clearError()
    }
  },
)

const form = reactive({
  username: '',
  password: '',
  rememberMe: false,
})

const submitted = ref(false)

async function onSubmit() {
  submitted.value = true
  if (!form.username || !form.password) return
  try {
    await authStore.login(form.username, form.password)
    const redirect = (route.query.redirect as string) ?? '/dashboard'
    router.push(redirect)
  } catch {
    // error shown from store
  }
}
</script>

<template>
  <div class="login-page" dir="rtl">
    <div class="login-grid">
      <!-- Form section (right in RTL - start) -->
      <div class="login-form-section">
        <div class="form-container">
          <div class="brand-logo-inline">
            <span class="logo-icon">م</span>
            <span class="logo-text">مدير 360</span>
          </div>

          <div class="form-header">
            <h1 class="form-title">محمود رأفت لمواد البناء</h1>
            <p class="form-subtitle">سجّل الدخول إلى حسابك</p>
          </div>

          <form @submit.prevent="onSubmit" class="login-form">
            <div class="field mb-3">
              <InputText
                id="username"
                v-model="form.username"
                placeholder="اسم المستخدم"
                class="w-full login-input"
                :disabled="authStore.loading"
              />
            </div>

            <div class="field mb-3">
              <Password
                id="password"
                v-model="form.password"
                placeholder="كلمة المرور"
                :feedback="false"
                :toggle-mask="true"
                :disabled="authStore.loading"
                input-class="w-full login-input"
                fluid
              />
            </div>

            <Button
              type="submit"
              label="تسجيل الدخول"
              class="w-full login-button mb-3"
              :loading="authStore.loading"
            />
          </form>
          <div class="powered-by">
            <span>تصميم وتطوير شركة سويفت كير</span>
            <img :src="swiftcareLogo" alt="SwiftCare" class="powered-by-logo" />
          </div>
        </div>
      </div>

      <!-- Illustration section (left in RTL - end) -->
      <div class="login-illustration">
        <img :src="loginImage" alt="" class="illustration-img" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  background: #ffffff;
}

.login-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

@media (max-width: 991px) {
  .login-grid {
    grid-template-columns: 1fr;
  }

  .login-illustration {
    display: none !important;
  }
}

/* Form section */
.login-form-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: #ffffff;
}

.form-container {
  width: 100%;
  max-width: 380px;
}

.brand-logo-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2.5rem;
}

.logo-icon {
  width: 2.5rem;
  height: 2.5rem;
  background: #008cff;
  color: white;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: #008cff;
}

.form-header {
  margin-bottom: 2rem;
}

.form-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 0.5rem 0;
}

.form-subtitle {
  font-size: 0.95rem;
  color: #6b7280;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
}

.login-input,
:deep(.login-input) {
  border-radius: 0.5rem !important;
  padding: 0.75rem 1rem !important;
  border: 1px solid #e5e7eb !important;
}

.login-input:focus,
:deep(.login-input:focus) {
  border-color: #008cff !important;
  box-shadow: 0 0 0 2px rgba(0, 140, 255, 0.2) !important;
}

.login-button {
  background: #008cff !important;
  border-color: #008cff !important;
  border-radius: 0.5rem !important;
}

.login-button:hover {
  background: #0077e6 !important;
  border-color: #0077e6 !important;
}

.powered-by {
  margin-top: 3rem;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  direction: ltr;
  font-size: 0.8rem;
  color: #9ca3af;
}

.powered-by-logo {
  height: 50px;
  width: auto;
  object-fit: contain;
}

/* Illustration section - gradient matches image palette (#3699FF, #A1D4FF) */
.login-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(180deg, #e8f4ff 0%, #a1d4ff 35%, #3699ff 100%);
}

.illustration-img {
  width: 100%;
  height: 100%;
  max-width: 650px;
  max-height: 650px;
  object-fit: cover;
}
</style>
