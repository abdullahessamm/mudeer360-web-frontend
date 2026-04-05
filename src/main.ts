import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { ar } from 'primelocale/js/ar.js'
import { definePreset } from '@primeuix/themes'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import '@/assets/css/main.css'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Divider from 'primevue/divider'
import Dropdown from 'primevue/dropdown'
import FloatLabel from 'primevue/floatlabel'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import Toast from 'primevue/toast'
import ToastService from 'primevue/toastservice'
import ConfirmDialog from 'primevue/confirmdialog'
import ConfirmationService from 'primevue/confirmationservice'
import AutoComplete from 'primevue/autocomplete'
import Chart from 'primevue/chart'
import Select from 'primevue/select'
import Sidebar from 'primevue/sidebar'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import App from './App.vue'
import router from './router'

const UTechBluePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e6f4ff',
      100: '#b3dfff',
      200: '#80caff',
      300: '#4db5ff',
      400: '#1aa0ff',
      500: '#008cff',
      600: '#0077e6',
      700: '#0066cc',
      800: '#0052a3',
      900: '#003d7a',
      950: '#002952',
    },
  },
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ToastService)
app.use(ConfirmationService)
app.use(PrimeVue, {
  locale: { ...ar, dateFormat: 'yy-mm-dd' },
  theme: {
    preset: UTechBluePreset,
    options: {
      darkModeSelector: false,
    },
  },
})

app.component('Button', Button)
app.component('Card', Card)
app.component('Checkbox', Checkbox)
app.component('Column', Column)
app.component('DataTable', DataTable)
app.component('DatePicker', DatePicker)
app.component('Dialog', Dialog)
app.component('Divider', Divider)
app.component('Dropdown', Dropdown)
app.component('FloatLabel', FloatLabel)
app.component('IconField', IconField)
app.component('InputIcon', InputIcon)
app.component('InputNumber', InputNumber)
app.component('InputText', InputText)
app.component('Message', Message)
app.component('Password', Password)
app.component('Toast', Toast)
app.component('AutoComplete', AutoComplete)
app.component('Chart', Chart)
app.component('ConfirmDialog', ConfirmDialog)
app.component('Select', Select)
app.component('Sidebar', Sidebar)
app.component('Tab', Tab)
app.component('TabList', TabList)
app.component('TabPanel', TabPanel)
app.component('TabPanels', TabPanels)
app.component('Tabs', Tabs)
app.component('Tag', Tag)
app.component('Textarea', Textarea)

app.mount('#app')
