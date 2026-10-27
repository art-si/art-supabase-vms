<template>
  <ArtDialog ref="dialogRef" size="md">
    <template #subtitle>{{
      editingCard
        ? '可更新卡面、人员和备注；余额仍由电卡流水计算。'
        : '绑定已审批车辆，初始余额会作为首笔期初流水留痕。'
    }}</template>
    <div
      class="mb-4 flex items-center gap-4 rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] p-3"
    >
      <ArtUploadImage
        :model-value="cardImageUrl"
        @update:model-value="handleImageChange"
        :resource-tenant-id="selectedVehicleTenantId"
        title="电卡图片"
        :size="88"
        :limit="1"
        :file-size="8 * 1024 * 1024"
        file-type="image/png,image/jpeg,image/webp"
        :upload-request="uploadCardImage"
        :show-resource-picker="false"
        :readonly="!selectedVehicleTenantId"
      />
      <div class="min-w-0">
        <strong class="block text-sm">电卡图片</strong>
        <p class="mt-1 text-xs text-[var(--el-text-color-secondary)]">{{
          editingCard
            ? '上传或更换卡面照片，仅同租户授权用户可查看。'
            : '先选车辆，再上传卡面照片；影像仅供同租户授权用户查看。'
        }}</p>
      </div>
    </div>
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
        <span v-if="editingCard" class="font-medium">{{ editingCard.plateNo }}</span>
        <ArtTableSingleSelect
          v-else
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
      <template #ownerEmployeeId>
        <ArtEmployeeSelect
          v-model="form.ownerEmployeeId"
          v-model:selected-data="selectedOwner"
          :tenant-id="selectedVehicleTenantId"
          :api-fn="fetchElectricCardEmployeeOptions"
          :display-fields="[]"
          :disabled="!selectedVehicleTenantId"
          missing-tenant-placeholder="请先选择绑定车辆"
          title="选择卡归属人"
          :placeholder="editingCard ? '选择卡归属人（选填）' : '留空则带入车辆主司机'"
        />
      </template>
      <template #openerEmployeeId>
        <ArtEmployeeSelect
          v-model="form.openerEmployeeId"
          v-model:selected-data="selectedOpener"
          :tenant-id="selectedVehicleTenantId"
          :api-fn="fetchElectricCardEmployeeOptions"
          :display-fields="[]"
          :disabled="!selectedVehicleTenantId"
          missing-tenant-placeholder="请先选择绑定车辆"
          title="选择开户人"
          placeholder="请选择开户人（选填）"
        />
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
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import {
    privateAttachmentPathFromSignedUrl,
    signPrivateAttachmentPaths,
    uploadPrivateAttachment
  } from '@/utils/supabase/private-attachment'
  import {
    createElectricCard,
    fetchElectricCardEmployeeOptions,
    updateElectricCard,
    type ElectricCard
  } from '@/api/electric-card'
  import { fetchApprovedVehicleSelectData } from '@vms/api'
  import VehicleDataSourceEmptyActions from '../../../components/vehicle-data-source-empty-actions.vue'

  defineOptions({ name: 'VmsElectricCardDialog' })

  interface ElectricCardForm {
    cardNo: string
    vehicleId: string
    issuer: string
    openingBalance: number
    ownerEmployeeId: string | undefined
    openerEmployeeId: string | undefined
    remark: string
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<void>>()
  const formRef = ref<FormExpose>()
  const form = reactive<ElectricCardForm>({
    cardNo: '',
    vehicleId: '',
    issuer: '',
    openingBalance: 0,
    ownerEmployeeId: undefined,
    openerEmployeeId: undefined,
    remark: ''
  })
  const editingCard = ref<ElectricCard | null>(null)
  const cardImageUrl = ref('')
  const imageChanged = ref(false)
  const vehicleSelectValue = ref<string>('')
  const vehicleSelection = ref<Api.Vms.ArchiveManage.VehicleArchive[]>([])
  const selectedVehicleTenantId = computed(
    () => editingCard.value?.tenantId || vehicleSelection.value[0]?.tenantId || ''
  )
  const selectedOwner = ref<EmployeeIntegrationItem[]>([])
  const selectedOpener = ref<EmployeeIntegrationItem[]>([])
  const uploadCardImage = (file: File) =>
    uploadPrivateAttachment(file, {
      bucket: 'vms-electric-card-private',
      tenantId: selectedVehicleTenantId.value,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      maxBytes: 8 * 1024 * 1024
    })
  const handleImageChange = (value: string | string[]): void => {
    cardImageUrl.value = Array.isArray(value) ? value[0] || '' : value
    imageChanged.value = true
  }
  const vehicleColumns: DataSelectColumn[] = [
    { prop: 'plateNo', label: '车牌号', minWidth: 140 },
    { prop: 'companyName', label: '所属公司', minWidth: 220 }
  ]
  const formItems = computed<FormItem[]>(() => [
    {
      label: '电卡号',
      key: 'cardNo',
      type: 'input',
      props: { maxlength: 64, placeholder: '请输入卡面号码', disabled: Boolean(editingCard.value) }
    },
    { label: '绑定车辆', key: 'vehicleId' },
    { label: '卡归属人', key: 'ownerEmployeeId' },
    { label: '开户人', key: 'openerEmployeeId' },
    { label: '发卡机构', key: 'issuer', type: 'input', props: { maxlength: 100 } },
    ...(!editingCard.value
      ? [
          {
            label: '期初余额',
            key: 'openingBalance',
            type: 'number',
            props: { min: 0, precision: 2, controls: false, class: '!w-full' },
            description: '已有余额请如实录入，系统会生成期初流水。'
          } satisfies FormItem
        ]
      : []),
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true }
    }
  ])
  const formRules: FormRules<ElectricCardForm> = {
    cardNo: [{ required: true, message: '请输入电卡号', trigger: 'blur' }],
    vehicleId: [{ required: true, message: '请选择已审批车辆', trigger: 'change' }],
    openingBalance: [
      { required: true, type: 'number', min: 0, message: '期初余额不能为负数', trigger: 'change' }
    ]
  }

  const handleVehicleChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const vehicle = rows[0] as Api.Vms.ArchiveManage.VehicleArchive | undefined
    if (vehicle?.id !== form.vehicleId) {
      form.ownerEmployeeId = undefined
      form.openerEmployeeId = undefined
      selectedOwner.value = []
      selectedOpener.value = []
      cardImageUrl.value = ''
    }
    form.vehicleId = vehicle?.id || ''
  }

  const handleConfirm = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const imagePath = imageChanged.value
        ? cardImageUrl.value
          ? privateAttachmentPathFromSignedUrl(cardImageUrl.value, 'vms-electric-card-private')
          : null
        : editingCard.value?.imagePath || null
      if (editingCard.value) {
        await updateElectricCard({
          id: editingCard.value.id,
          issuer: form.issuer.trim(),
          imagePath,
          ownerEmployeeId: form.ownerEmployeeId || null,
          openerEmployeeId: form.openerEmployeeId || null,
          remark: form.remark.trim()
        })
      } else {
        await createElectricCard({
          cardNo: form.cardNo.trim(),
          vehicleId: form.vehicleId,
          issuer: form.issuer.trim(),
          imagePath,
          ownerEmployeeId: form.ownerEmployeeId || null,
          openerEmployeeId: form.openerEmployeeId || null,
          openingBalance: form.openingBalance,
          remark: form.remark.trim()
        })
      }
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(
        error,
        editingCard.value
          ? '电卡资料更新失败，请检查后重试'
          : '电卡创建失败，请检查卡号和绑定车辆后重试'
      )
      return false
    }
  }

  const employeeReference = (
    id: string | null,
    name: string | null,
    tenantId: string
  ): EmployeeIntegrationItem[] =>
    id && name ? [{ id, tenantId, employeeNo: '', employeeName: name, employmentStatus: '' }] : []
  const handleOpen = async (card?: ElectricCard): Promise<void> => {
    editingCard.value = card || null
    Object.assign(form, {
      cardNo: card?.cardNo || '',
      vehicleId: card?.vehicleId || '',
      issuer: card?.issuer || '',
      openingBalance: 0,
      ownerEmployeeId: card?.ownerEmployeeId || undefined,
      openerEmployeeId: card?.openerEmployeeId || undefined,
      remark: card?.remark || ''
    })
    vehicleSelectValue.value = ''
    vehicleSelection.value = []
    selectedOwner.value = card
      ? employeeReference(card.ownerEmployeeId, card.ownerEmployeeName, card.tenantId)
      : []
    selectedOpener.value = card
      ? employeeReference(card.openerEmployeeId, card.openerEmployeeName, card.tenantId)
      : []
    cardImageUrl.value = ''
    imageChanged.value = false
    if (card?.imagePath) {
      try {
        cardImageUrl.value =
          (await signPrivateAttachmentPaths('vms-electric-card-private', [card.imagePath])).get(
            card.imagePath
          ) || ''
      } catch {
        notifyFriendlyError(null, '卡面照片预览失败，您仍可修改其他信息或重新上传照片')
      }
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(undefined, {
      title: card ? '编辑电卡资料' : '新增电卡',
      confirmText: card ? '保存修改' : '创建电卡',
      onConfirm: handleConfirm
    })
  }

  defineExpose({ handleOpen })
</script>
