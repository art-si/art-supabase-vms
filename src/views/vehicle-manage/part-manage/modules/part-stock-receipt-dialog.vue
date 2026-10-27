<template>
  <ArtDialog ref="dialogRef" width="720px">
    <template #subtitle>登记实物入库，库存数量由台账流水自动计算。</template>
    <ArtForm
      ref="formRef"
      v-model="form.data"
      :items="form.items"
      :rules="form.rules"
      :span="12"
      label-width="104px"
      :show-reset="false"
      :show-submit="false"
    >
      <template #partId>
        <ArtTableSingleSelect
          v-model="partSelectValue"
          v-model:selected-data="form.partSelection"
          :api-fn="fetchPartRows"
          :columns="partColumns"
          row-key="id"
          label-key="partName"
          description-key="partCode"
          title="选择配件"
          search-placeholder="输入配件名称或编码"
          empty-text="暂无可选配件"
          empty-description="请先在零部件资料中维护配件。"
          show-pagination
          @change="handlePartChange"
        />
      </template>
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="ts">
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import type {
    DataSelectColumn,
    DataSelectFetchParams,
    DataSelectKey,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { fetchPartsList, postVehiclePartStockReceipt } from '@vms/api'

  defineOptions({ name: 'VmsPartStockReceiptDialog' })

  interface ReceiptForm {
    partId: string
    partCode: string
    model: string
    brand: string
    quantity: number
    occurredAt: string
    remark: string
  }

  interface FormGroup {
    data: ReceiptForm
    partSelection: DataSelectRecord[]
    items: FormItem[]
    rules: FormRules<ReceiptForm>
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  let idempotencyKey = crypto.randomUUID()
  const initialForm = (): ReceiptForm => ({
    partId: '',
    partCode: '',
    model: '',
    brand: '',
    quantity: 1,
    occurredAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    remark: ''
  })
  const form = reactive<FormGroup>({
    data: initialForm(),
    partSelection: [],
    items: [
      { label: '配件名称', key: 'partId', span: 24 },
      { label: '物料编码', key: 'partCode', type: 'input', props: { disabled: true } },
      { label: '规格型号', key: 'model', type: 'input', props: { disabled: true } },
      { label: '品牌', key: 'brand', type: 'input', props: { disabled: true } },
      {
        label: '入库数量',
        key: 'quantity',
        type: 'number',
        props: { min: 1, precision: 0, controls: false, class: '!w-full' }
      },
      {
        label: '入库时间',
        key: 'occurredAt',
        type: 'date',
        span: 24,
        props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss', class: '!w-full' }
      },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true }
      }
    ],
    rules: {
      partId: [{ required: true, message: '请选择配件', trigger: 'change' }],
      quantity: [{ required: true, type: 'number', min: 1, message: '请输入大于 0 的入库数量' }],
      occurredAt: [{ required: true, message: '请选择入库时间', trigger: 'change' }]
    }
  })

  const partSelectValue = computed<DataSelectKey | undefined>({
    get: () => form.data.partId || undefined,
    set: (value) => {
      form.data.partId = value ? String(value) : ''
    }
  })
  const partColumns: DataSelectColumn[] = [
    { prop: 'partName', label: '配件名称', minWidth: 170 },
    { prop: 'partCode', label: '物料编码', minWidth: 140 },
    { prop: 'model', label: '规格型号', minWidth: 120 },
    { prop: 'brand', label: '品牌', minWidth: 100 }
  ]
  const fetchPartRows = async (params: DataSelectFetchParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
    const result = await fetchPartsList({ partName: params.keyword, status: '1', from, to })
    return { data: result.data ?? [], total: result.total ?? 0 }
  }
  const handlePartChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const part = rows[0] as Api.Vms.BasicInfo.Parts | undefined
    Object.assign(form.data, {
      partId: part?.id || '',
      partCode: part?.partCode || '',
      model: part?.model || '',
      brand: part?.brand || ''
    })
  }
  const handleConfirm = async (): Promise<boolean> => {
    if (!(await validateArtFormForSubmit(formRef.value))) return false
    try {
      await postVehiclePartStockReceipt({
        partId: form.data.partId,
        quantity: form.data.quantity,
        occurredAt: form.data.occurredAt,
        remark: form.data.remark,
        idempotencyKey
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '配件入库失败，请检查数量和时间后重试')
      return false
    }
  }
  const handleOpen = async (): Promise<void> => {
    Object.assign(form.data, initialForm())
    form.partSelection = []
    idempotencyKey = crypto.randomUUID()
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(undefined, {
      title: '配件入库',
      confirmText: '确认入库',
      onConfirm: handleConfirm
    })
  }
  defineExpose({ handleOpen })
</script>
