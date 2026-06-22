<script lang="ts" setup>
import { DISPENSE_STATUS_LABELS, DISPENSE_STATUS_SEVERITY, getDispenseStats } from '@/lib/dispense';
import { formatMoney } from '@/lib/format';
import type { SaleInvoice } from '@/types'

defineProps<{
  invoices: SaleInvoice[]
  showCustomer?: boolean
}>()

defineEmits<{
  (e: 'view-invoice', invoice: SaleInvoice, forPayment?: boolean): void
  (e: 'edit-invoice', invoice: SaleInvoice): void
  (e: 'delete-invoice', invoice: SaleInvoice): void
}>()

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    cash: 'نقدي',
    credit: 'آجل',
  }
  return map[type] ?? type
}

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    paid: 'مدفوع',
    partial: 'مدفوع جزئياً',
    unpaid: 'غير مدفوع',
  }
  return map[status] ?? status
}
</script>

<template>
  <DataTable
    :value="invoices"
    data-key="id"
    striped-rows
    responsive-layout="scroll"
    class="p-datatable-sm"
  >
    <Column field="invoice_number" header="رقم الفاتورة" />
    <Column field="invoice_date" header="التاريخ" />
    <Column v-if="showCustomer" field="customer" header="العميل">
      <template #body="{ data }">{{ data.customer?.name ?? '—' }}</template>
    </Column>
    <Column field="type" header="النوع">
      <template #body="{ data }">{{ typeLabel(data.type) }}</template>
    </Column>
    <Column field="type" header="الإجمالي الفرعي">
      <template #body="{ data }">
        <Tag :value="formatMoney(data.subtotal_amount)" severity="info" />
      </template>
    </Column>
    <Column field="type" header="الخصم">
      <template #body="{ data }">
        <Tag :value="formatMoney(data.discount_amount)" severity="danger" />
      </template>
    </Column>
    <Column field="type" header="ضريبة">
      <template #body="{ data }">
        <Tag :value="formatMoney(data.tax_amount)" severity="info" />
      </template>
    </Column>
    <Column field="total_amount" header="الإجمالي">
      <template #body="{ data }">
        <Tag :value="formatMoney(data.total_amount)" severity="info" />
      </template>
    </Column>
    <Column field="paid_amount" header="المدفوع">
      <template #body="{ data }">
        <Tag :value="formatMoney(data.paid_amount)" severity="success" />
      </template>
    </Column>
    <Column header="المتبقي">
      <template #body="{ data }">
        <Tag
          :value="formatMoney(Math.max(0, data.total_amount - data.paid_amount))"
          :severity="data.total_amount - data.paid_amount > 0 ? 'warn' : 'secondary'"
        />
      </template>
    </Column>
    <Column field="status" header="الحالة">
      <template #body="{ data }">
        <Tag
          :value="statusLabel(data.status)"
          :severity="
            data.status === 'paid' ? 'success' : data.status === 'partial' ? 'warn' : 'danger'
          "
        />
      </template>
    </Column>
    <Column header="صرف">
      <template #body="{ data }">
        <div class="flex flex-column gap-1 align-items-start">
          <Tag
            :value="DISPENSE_STATUS_LABELS[getDispenseStats(data.items).status]"
            :severity="DISPENSE_STATUS_SEVERITY[getDispenseStats(data.items).status]"
          />
          <Tag
            :value="`تم صرف: ${formatMoney(getDispenseStats(data.items, data).dispensedAmount)}`"
            v-if="getDispenseStats(data.items).status === 'partial'"
          />
          <Tag
            :value="`متبقى الصرف: ${formatMoney(getDispenseStats(data.items, data).remainingAmount)}`"
            v-if="getDispenseStats(data.items).status === 'partial'"
          />
        </div>
      </template>
    </Column>
    <Column header="الإجراءات" style="width: 260px">
      <template #body="{ data }">
        <Button
          label="عرض"
          icon="pi pi-eye"
          text
          size="small"
          class="p-button-info"
          @click="$emit('view-invoice', data)"
        />
        <Button
          v-if="data.status === 'unpaid'"
          label="تعديل"
          icon="pi pi-pencil"
          text
          size="small"
          class="p-button-success"
          @click="$emit('edit-invoice', data)"
        />
        <Button
          v-if="data.status === 'unpaid'"
          label="حذف"
          icon="pi pi-trash"
          text
          size="small"
          class="p-button-danger"
          @click="$emit('delete-invoice', data)"
        />
      </template>
    </Column>
  </DataTable>
</template>
