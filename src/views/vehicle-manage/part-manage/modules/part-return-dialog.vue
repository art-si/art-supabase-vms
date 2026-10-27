<template>
  <ArtDialog ref="dialogRef" width="640px">
    <template #subtitle>记录本次归还或报损；仅实际归还数量回流库存。</template>
    <ElAlert
      class="mb-4"
      type="info"
      :closable="false"
      show-icon
      :title="`${line?.partName || '配件'}：领用 ${line?.issuedQty ?? 0}，已处理 ${line?.settledQty ?? 0}，待处理 ${remainingQty}`"
    />
    <ArtForm
      ref="formRef"
      v-model="form.data"
      :items="form.items"
      :rules="form.rules"
      :span="12"
      label-width="110px"
      :show-reset="false"
      :show-submit="false"
    />
  </ArtDialog>
</template>

<script setup lang="ts">
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { returnVehiclePartIssueLine, type VehiclePartIssueLine } from '@vms/api'

  defineOptions({ name: 'VmsPartReturnDialog' })

  interface ReturnForm {
    status: 'returned' | 'lost' | 'damaged'
    returnedQty: number
    returnedAt: string
    remark: string
  }
  interface FormGroup {
    data: ReturnForm
    items: FormItem[]
    rules: FormRules<ReturnForm>
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const line = shallowRef<VehiclePartIssueLine | null>(null)
  const remainingQty = computed(() =>
    Math.max(0, (line.value?.issuedQty || 0) - (line.value?.settledQty || 0))
  )
  let idempotencyKey = crypto.randomUUID()
  const initialForm = (): ReturnForm => ({
    status: 'returned',
    returnedQty: 1,
    returnedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    remark: ''
  })
  const form = reactive<FormGroup>({
    data: initialForm(),
    items: [
      {
        label: '处理结果',
        key: 'status',
        type: 'radioGroup',
        span: 24,
        options: [
          { label: '已归还', value: 'returned' },
          { label: '丢失', value: 'lost' },
          { label: '损坏', value: 'damaged' }
        ]
      },
      {
        label: '本次处理数量',
        key: 'returnedQty',
        type: 'number',
        span: 12,
        props: { min: 1, precision: 0, controls: false, class: '!w-full' }
      },
      {
        label: '处理时间',
        key: 'returnedAt',
        type: 'date',
        span: 12,
        props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss', class: '!w-full' }
      },
      {
        label: '说明',
        key: 'remark',
        type: 'input',
        span: 24,
        props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true }
      }
    ],
    rules: {
      status: [{ required: true, message: '请选择处理结果', trigger: 'change' }],
      returnedQty: [{ required: true, type: 'number', min: 1, message: '请输入本次处理数量' }],
      returnedAt: [{ required: true, message: '请选择处理时间', trigger: 'change' }]
    }
  })
  const handleConfirm = async (): Promise<boolean> => {
    if (!(await validateArtFormForSubmit(formRef.value))) return false
    if (!line.value || form.data.returnedQty > remainingQty.value) {
      notifyFriendlyError(null, '本次处理数量不能超过待处理数量')
      return false
    }
    try {
      await returnVehiclePartIssueLine(line.value.id, {
        returnedQty: form.data.returnedQty,
        returnedAt: form.data.returnedAt,
        status: form.data.status,
        remark: form.data.remark,
        idempotencyKey
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '配件归还或报损失败，请核对数量后重试')
      return false
    }
  }
  const handleOpen = async (target: VehiclePartIssueLine): Promise<void> => {
    line.value = target
    Object.assign(form.data, initialForm())
    idempotencyKey = crypto.randomUUID()
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(undefined, {
      title: '归还 / 报损配件',
      confirmText: '确认处理',
      onConfirm: handleConfirm
    })
  }
  defineExpose({ handleOpen })
</script>
