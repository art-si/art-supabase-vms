<template>
  <ArtDialog ref="dialogRef" size="md" :show-fullscreen-button="false">
    <template #subtitle>绑定已审批车辆，初始余额会作为首笔期初流水留痕。</template>
    <ArtForm
      ref="formRef"
      v-model="form"
      :items="formItems"
      :rules="formRules"
      :span="24"
      label-width="110px"
      :show-reset="false"
      :show-submit="false"
    >
      <template #vehicleId>
        <ArtTableSingleSelect
          v-model="vehicleSelectValue"
          v-model:selected-data="vehicleSelection"
          :api-fn="fetchApprovedVehicleSelectData"
          :columns="vehicleColumns"
          row-key="id"
          label-key="plateNo"
          description-key="companyName"
          title="选择已审批车辆"
          search-placeholder="输入车牌号或所属公司"
          empty-text="暂无可绑定车辆"
          empty-description="请先完成车辆档案审批后重试。"
          show-pagination
          @change="handleVehicleChange"
        >
          <template #empty><VehicleDataSourceEmptyActions source="vehicle" /></template>
        </ArtTableSingleSelect>
      </template>
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import type {
    DataSelectColumn,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { createFuelCard } from '@/api/fuel-card'
  import { fetchApprovedVehicleSelectData } from '@vms/api'
  import VehicleDataSourceEmptyActions from '../../../components/vehicle-data-source-empty-actions.vue'

  defineOptions({ name: 'VmsFuelCardDialog' })

  interface FuelCardForm {
    cardNo: string
    vehicleId: string
    issuer: string
    openingBalance: number
    remark: string
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<void>>()
  const formRef = ref<FormExpose>()
  const form = reactive<FuelCardForm>({
    cardNo: '',
    vehicleId: '',
    issuer: '',
    openingBalance: 0,
    remark: ''
  })
  const vehicleSelectValue = ref<string>('')
  const vehicleSelection = ref<Api.Vms.ArchiveManage.VehicleArchive[]>([])
  const vehicleColumns: DataSelectColumn[] = [
    { prop: 'plateNo', label: '车牌号', minWidth: 140 },
    { prop: 'companyName', label: '所属公司', minWidth: 220 }
  ]
  const formItems: FormItem[] = [
    {
      label: '油卡号',
      key: 'cardNo',
      type: 'input',
      props: { maxlength: 64, placeholder: '请输入卡面号码' }
    },
    { label: '绑定车辆', key: 'vehicleId' },
    { label: '发卡机构', key: 'issuer', type: 'input', props: { maxlength: 100 } },
    {
      label: '期初余额',
      key: 'openingBalance',
      type: 'number',
      props: { min: 0, precision: 2, controls: false, class: '!w-full' },
      description: '已有余额请如实录入，系统会生成期初流水。'
    },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true }
    }
  ]
  const formRules: FormRules<FuelCardForm> = {
    cardNo: [{ required: true, message: '请输入油卡号', trigger: 'blur' }],
    vehicleId: [{ required: true, message: '请选择已审批车辆', trigger: 'change' }],
    openingBalance: [
      { required: true, type: 'number', min: 0, message: '期初余额不能为负数', trigger: 'change' }
    ]
  }

  const handleVehicleChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const vehicle = rows[0] as Api.Vms.ArchiveManage.VehicleArchive | undefined
    form.vehicleId = vehicle?.id || ''
  }

  const handleConfirm = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await createFuelCard({
        cardNo: form.cardNo.trim(),
        vehicleId: form.vehicleId,
        issuer: form.issuer.trim(),
        openingBalance: form.openingBalance,
        remark: form.remark.trim()
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '油卡创建失败，请检查卡号和绑定车辆后重试')
      return false
    }
  }

  const handleOpen = async (): Promise<void> => {
    Object.assign(form, { cardNo: '', vehicleId: '', issuer: '', openingBalance: 0, remark: '' })
    vehicleSelectValue.value = ''
    vehicleSelection.value = []
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(undefined, {
      title: '新增油卡',
      confirmText: '创建油卡',
      onConfirm: handleConfirm
    })
  }

  defineExpose({ handleOpen })
</script>
