<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { showError, showSuccess } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

watch(
  () => authStore.error,
  (err) => {
    if (err) {
      showError(err)
      authStore.clearError()
    }
  }
)

const profileForm = reactive({
  name: '',
  username: '',
})

const passwordForm = reactive({
  current_password: '',
  password: '',
  password_confirmation: '',
})

const profileLoading = ref(false)
const passwordLoading = ref(false)

function syncProfileForm() {
  if (authStore.user) {
    profileForm.name = authStore.user.name
    profileForm.username = authStore.user.username
  }
}

onMounted(syncProfileForm)

watch(() => authStore.user, syncProfileForm, { immediate: true })

async function saveProfile() {
  if (!profileForm.name.trim() || !profileForm.username.trim()) return
  profileLoading.value = true
  try {
    await authStore.updateProfile({
      name: profileForm.name.trim(),
      username: profileForm.username.trim(),
    })
    showSuccess('تم تحديث الملف الشخصي بنجاح')
  } catch {
    // error shown via toast
  } finally {
    profileLoading.value = false
  }
}

async function savePassword() {
  if (
    !passwordForm.current_password ||
    !passwordForm.password ||
    passwordForm.password !== passwordForm.password_confirmation
  ) {
    showError('يرجى ملء جميع الحقول وتأكيد كلمة المرور الجديدة')
    return
  }
  if (passwordForm.password.length < 8) {
    showError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
    return
  }
  passwordLoading.value = true
  try {
    await authStore.changePassword({
      current_password: passwordForm.current_password,
      password: passwordForm.password,
      password_confirmation: passwordForm.password_confirmation,
    })
    showSuccess('تم تغيير كلمة المرور بنجاح')
    passwordForm.current_password = ''
    passwordForm.password = ''
    passwordForm.password_confirmation = ''
  } catch {
    // error shown via toast
  } finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <div dir="rtl" class="profile-settings">
    <div class="settings-grid">
      <Card class="settings-card">
        <template #title>الملف الشخصي</template>
        <template #content>
          <div class="field">
            <label for="profile-name">الاسم</label>
            <InputText
              id="profile-name"
              v-model="profileForm.name"
              class="w-full mt-1"
              placeholder="أدخل اسمك"
            />
          </div>
          <div class="field mt-3">
            <label for="profile-username">اسم المستخدم</label>
            <InputText
              id="profile-username"
              v-model="profileForm.username"
              class="w-full mt-1"
              placeholder="أدخل اسم المستخدم"
            />
          </div>
          <Button
            label="حفظ التغييرات"
            icon="pi pi-check"
            :loading="profileLoading"
            :disabled="!profileForm.name.trim() || !profileForm.username.trim()"
            class="mt-3"
            @click="saveProfile"
          />
        </template>
      </Card>

      <Card class="settings-card">
        <template #title>تغيير كلمة المرور</template>
        <template #content>
          <div class="flex flex-column gap-3">
            <div class="field">
              <label for="current-password">كلمة المرور الحالية</label>
              <Password
                id="current-password"
                v-model="passwordForm.current_password"
                :feedback="false"
                :toggle-mask="true"
                input-class="w-full"
                class="w-full mt-1"
                placeholder="أدخل كلمة المرور الحالية"
              />
            </div>
            <div class="field">
              <label for="new-password">كلمة المرور الجديدة</label>
              <Password
                id="new-password"
                v-model="passwordForm.password"
                :toggle-mask="true"
                input-class="w-full"
                class="w-full mt-1"
                placeholder="أدخل كلمة المرور الجديدة"
              />
            </div>
            <div class="field">
              <label for="confirm-password">تأكيد كلمة المرور</label>
              <Password
                id="confirm-password"
                v-model="passwordForm.password_confirmation"
                :feedback="false"
                :toggle-mask="true"
                input-class="w-full"
                class="w-full mt-1"
                placeholder="أعد إدخال كلمة المرور الجديدة"
              />
            </div>
          </div>
          <Button
            label="تغيير كلمة المرور"
            icon="pi pi-key"
            :loading="passwordLoading"
            class="mt-3"
            @click="savePassword"
          />
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.profile-settings {
  width: 100%;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .settings-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.settings-card {
  max-width: 480px;
}
</style>
