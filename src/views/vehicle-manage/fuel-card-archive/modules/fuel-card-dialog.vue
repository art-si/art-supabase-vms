<template>
  <ArtDialog ref="dialogRef" size="md">
    <template #subtitle>{{
      editingCard
        ? '可更新卡面、油品、人员和备注；余额仍由流水计算。'
        : '绑定已审批车辆，初始余额会作为首笔期初流水留痕。'
    }}</template>

    <ArtForm
      ref="formRef"
      :model-value="cardForm"
      :items="formItems"
      :rules="formRules"
      :span="12"
      :gutter="20"
      label-width="110px"
    >
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { vehicleDriverColumns } from '@/components/business/vehicle-driver-select/columns'
  import { toRef, toRefs } from 'vue'
  import { h } from 'vue'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import type { DataSelectRecord } from '@/components/core/forms/art-data-select/types'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'

  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import {
    privateAttachmentPathFromSignedUrl,
    signPrivateAttachmentPaths,
    uploadPrivateAttachment
  } from '@/utils/supabase/private-attachment'
  import {
    createFuelCard,
    fetchFuelCardEmployeeOptions,
    fetchFuelCardOwnerSuggestion,
    updateFuelCard,
    type FuelCard,
    type FuelCardFuelType
  } from '@/api/fuel-card'
  import { fetchApprovedVehicleSelectData } from '@vms/api'
  import VehicleDataSourceEmptyActions from '../../../components/vehicle-data-source-empty-actions.vue'

  defineOptions({ name: 'VmsFuelCardDialog' })

  interface FuelCardForm {
    cardNo: string
    vehicleId: string
    issuer: string
    openingBalance: number
    fuelType: FuelCardFuelType
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
  const form = reactive<FuelCardForm>({
    cardNo: '',
    vehicleId: '',
    issuer: '',
    openingBalance: 0,
    fuelType: 'diesel_0',
    ownerEmployeeId: undefined,
    openerEmployeeId: undefined,
    remark: ''
  })
  const fuelTypeOptions = useDictionaryOptions('fuelCardFuelType')
  const editingCard = ref<FuelCard | null>(null)
  const cardImageUrl = ref('')
  const imageChanged = ref(false)
  const vehicleSelectValue = ref<string>('')
  const cardForm = computed(() =>
    reactive({
      ...toRefs(form),
      vehicleId: editingCard.value ? toRef(form, 'vehicleId') : vehicleSelectValue,
      cardImageUrl
    })
  )
  const vehicleSelection = ref<Api.Vms.ArchiveManage.VehicleArchive[]>([])
  const selectedVehicleTenantId = computed(
    () => editingCard.value?.tenantId || vehicleSelection.value[0]?.tenantId || ''
  )
  const cardNumber = useDocumentNumberRule('vms.fuel_card', selectedVehicleTenantId)
  const selectedOwner = ref<EmployeeIntegrationItem[]>([])
  const selectedOpener = ref<EmployeeIntegrationItem[]>([])
  let ownerSuggestionRequest = 0
  let ownerTouched = false
  const uploadCardImage = (file: File) =>
    uploadPrivateAttachment(file, {
      bucket: 'vms-fuel-card-private',
      tenantId: selectedVehicleTenantId.value,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      maxBytes: 8 * 1024 * 1024
    })
  const handleImageChange = (value: string | string[]): void => {
    cardImageUrl.value = Array.isArray(value) ? value[0] || '' : value
    imageChanged.value = true
  }
  const vehicleColumns = vehicleDriverColumns('vehicle')
  const formItems = computed<FormItem[]>(() => [
    {
      key: 'cardImageUrl',
      label: '油卡图片',
      type: 'uploadImage',
      span: 24,
      description: editingCard.value
        ? '上传或更换卡面照片，仅同租户授权用户可查看。'
        : '先选车辆，再上传卡面照片；影像仅供同租户授权用户查看。',
      props: {
        resourceTenantId: selectedVehicleTenantId.value,
        title: '油卡图片',
        size: 88,
        limit: 1,
        fileSize: 8 * 1024 * 1024,
        fileType: 'image/png,image/jpeg,image/webp',
        uploadRequest: uploadCardImage,
        showResourcePicker: false,
        readonly: !selectedVehicleTenantId.value,
        'onUpdate:modelValue': handleImageChange
      }
    },
    {
      label: '油卡号',
      key: 'cardNo',
      type: 'input',
      description: cardNumber.description.value,
      props: {
        maxlength: 64,
        ...cardNumber.inputProps(Boolean(editingCard.value), '请输入油卡号', true)
      }
    },
    {
      label: '绑定车辆',
      key: 'vehicleId',
      type: editingCard.value ? 'text' : 'dataSelect',
      span: 24,
      props: editingCard.value
        ? { formatter: () => editingCard.value?.plateNo || '—' }
        : {
            mode: 'table',
            multiple: false,
            modelValue: vehicleSelectValue.value,
            'onUpdate:modelValue': (value: typeof vehicleSelectValue.value) => {
              vehicleSelectValue.value = value
            },
            selectedData: vehicleSelection.value,
            'onUpdate:selectedData': (rows: typeof vehicleSelection.value) => {
              vehicleSelection.value = rows
            },
            apiFn: (params: Parameters<typeof fetchApprovedVehicleSelectData>[0]) =>
              fetchApprovedVehicleSelectData({ ...params, isNewEnergy: false }),
            columns: vehicleColumns,
            rowKey: 'id',
            labelKey: 'plateNo',
            descriptionKey: 'companyName',
            title: '选择已审批燃油车',
            searchPlaceholder: '输入车牌号或所属公司',
            emptyText: '暂无可绑定燃油车',
            emptyDescription: '请先完成燃油车档案审批后重试。',
            showPagination: true,
            showSelectedPanel: false,
            onChange: handleVehicleChange
          },
      slots: { empty: () => h(VehicleDataSourceEmptyActions, { source: 'vehicle' }) }
    },
    {
      label: '所属油品',
      key: 'fuelType',
      type: 'select',
      props: { options: fuelTypeOptions, placeholder: '请选择油品' }
    },
    {
      label: '卡归属人',
      key: 'ownerEmployeeId',
      type: 'employeeSelect',
      props: {
        selectedData: selectedOwner.value,
        'onUpdate:selectedData': (rows: EmployeeIntegrationItem[]) => {
          selectedOwner.value = rows
        },
        tenantId: selectedVehicleTenantId.value,
        apiFn: fetchFuelCardEmployeeOptions,
        displayFields: [],
        disabled: !selectedVehicleTenantId.value,
        missingTenantPlaceholder: '请先选择绑定车辆',
        title: '选择卡归属人',
        placeholder: editingCard.value ? '选择卡归属人（选填）' : '留空则带入车辆主司机',
        onChange: handleOwnerChange
      }
    },
    {
      label: '开户人',
      key: 'openerEmployeeId',
      type: 'employeeSelect',
      props: {
        selectedData: selectedOpener.value,
        'onUpdate:selectedData': (rows: EmployeeIntegrationItem[]) => {
          selectedOpener.value = rows
        },
        tenantId: selectedVehicleTenantId.value,
        apiFn: fetchFuelCardEmployeeOptions,
        displayFields: [],
        disabled: !selectedVehicleTenantId.value,
        missingTenantPlaceholder: '请先选择绑定车辆',
        title: '选择开户人',
        placeholder: '请选择开户人（选填）'
      }
    },
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
      span: 24,
      props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true }
    }
  ])
  const formRules: FormRules<FuelCardForm> = {
    cardNo: [
      {
        validator: (_rule, value: string, callback) => {
          if (editingCard.value || cardNumber.automatic.value || value?.trim()) callback()
          else callback(new Error('请输入油卡号'))
        },
        trigger: 'blur'
      }
    ],
    vehicleId: [{ required: true, message: '请选择已审批车辆', trigger: 'change' }],
    fuelType: [{ required: true, message: '请选择所属油品', trigger: 'change' }],
    openingBalance: [
      { required: true, type: 'number', min: 0, message: '期初余额不能为负数', trigger: 'change' }
    ]
  }

  const handleOwnerChange = (): void => {
    ownerTouched = true
  }
  const populateOwnerFromVehicle = async (vehicleId: string, request: number): Promise<void> => {
    try {
      const suggestion = await fetchFuelCardOwnerSuggestion(vehicleId)
      if (request !== ownerSuggestionRequest || form.vehicleId !== vehicleId || ownerTouched) return
      if (!suggestion || suggestion.tenantId !== selectedVehicleTenantId.value) return
      form.ownerEmployeeId = suggestion.employeeId
      selectedOwner.value = [
        {
          id: suggestion.employeeId,
          tenantId: suggestion.tenantId,
          employeeNo: '',
          employeeName: suggestion.employeeName,
          employmentStatus: ''
        }
      ]
    } catch (error) {
      if (request === ownerSuggestionRequest && form.vehicleId === vehicleId && !ownerTouched) {
        notifyFriendlyError(error, '主司机花名册带入失败，请手动选择卡归属人')
      }
    }
  }
  const handleVehicleChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const vehicle = rows[0] as Api.Vms.ArchiveManage.VehicleArchive | undefined
    if (vehicle?.id !== form.vehicleId) {
      const request = ++ownerSuggestionRequest
      ownerTouched = false
      form.ownerEmployeeId = undefined
      form.openerEmployeeId = undefined
      selectedOwner.value = []
      selectedOpener.value = []
      cardImageUrl.value = ''
      form.vehicleId = vehicle?.id || ''
      if (vehicle?.id) void populateOwnerFromVehicle(vehicle.id, request)
      return
    }
    form.vehicleId = vehicle?.id || ''
  }

  const handleConfirm = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const imagePath = imageChanged.value
        ? cardImageUrl.value
          ? privateAttachmentPathFromSignedUrl(cardImageUrl.value, 'vms-fuel-card-private')
          : null
        : editingCard.value?.imagePath || null
      if (editingCard.value) {
        await updateFuelCard({
          id: editingCard.value.id,
          issuer: form.issuer.trim(),
          imagePath,
          fuelType: form.fuelType,
          ownerEmployeeId: form.ownerEmployeeId || null,
          openerEmployeeId: form.openerEmployeeId || null,
          remark: form.remark.trim()
        })
      } else {
        await createFuelCard({
          cardNo: form.cardNo.trim(),
          vehicleId: form.vehicleId,
          issuer: form.issuer.trim(),
          imagePath,
          fuelType: form.fuelType,
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
          ? '油卡资料更新失败，请检查后重试'
          : '油卡创建失败，请检查卡号和绑定车辆后重试'
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
  const handleOpen = async (card?: FuelCard): Promise<void> => {
    ++ownerSuggestionRequest
    ownerTouched = false
    editingCard.value = card || null
    Object.assign(form, {
      cardNo: card?.cardNo || '',
      vehicleId: card?.vehicleId || '',
      issuer: card?.issuer || '',
      openingBalance: 0,
      fuelType: card?.fuelType || 'diesel_0',
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
          (await signPrivateAttachmentPaths('vms-fuel-card-private', [card.imagePath])).get(
            card.imagePath
          ) || ''
      } catch {
        notifyFriendlyError(null, '卡面照片预览失败，您仍可修改其他信息或重新上传照片')
      }
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(undefined, {
      title: card ? '编辑油卡资料' : '新增油卡',
      confirmText: card ? '保存修改' : '创建油卡',
      onOpen: () => cardNumber.loadRule(),
      onConfirm: handleConfirm
    })
  }

  defineExpose({ handleOpen })
</script>
