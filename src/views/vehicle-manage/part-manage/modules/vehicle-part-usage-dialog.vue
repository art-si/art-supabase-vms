<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <template #subtitle
      >登记零部件装车、质保、使用基线和 RFID 信息，持续跟踪部件寿命状态。</template
    >

    <ElAlert
      v-if="form.data.lifecycleLimitsMasked"
      class="vehicle-part-usage-form__permission-alert"
      title="寿命、质保与里程数据已按当前字段权限脱敏"
      type="info"
      :closable="false"
      show-icon
    />

    <ArtForm
      ref="formRef"
      v-model:active-tab="activeTab"
      v-model="form.data"
      :items="formItems"
      :rules="form.rules"
      :span="8"
      :gutter="20"
      label-width="120px"
      root-class="vehicle-part-usage-form"
    >
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { h } from 'vue'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { cloneDeep } from 'lodash-es'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import VehicleDataSourceEmptyActions from '../../../components/vehicle-data-source-empty-actions.vue'
  import type {
    DataSelectColumn,
    DataSelectFetchParams,
    DataSelectKey,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import {
    addVehiclePartUsage,
    editVehiclePartUsage,
    fetchApprovedVehicleSelectData,
    fetchPartsList
  } from '@vms/api'
  import { useUserStore } from '@/store/modules/user'
  import { canEditField, canViewField } from '@/utils/field-permission'
  import {
    EDITABLE_VEHICLE_PART_USAGE_ACCESS,
    sanitizeVehiclePartUsagePayload
  } from './vehicle-part-usage-model'

  defineOptions({ name: 'VehiclePartUsageDialog' })

  type Usage = Api.Vms.VehicleManage.VehiclePartUsage
  type Vehicle = Api.Vms.ArchiveManage.VehicleArchive
  type Part = Api.Vms.BasicInfo.Parts

  interface FormGroup {
    data: Usage
    vehicleSelection: DataSelectRecord[]
    partSelection: DataSelectRecord[]
    rules: FormRules<Usage>
  }

  interface Emits {
    (e: 'success', type: 'add' | 'edit'): void
  }

  const emit = defineEmits<Emits>()
  const { getDictMap } = storeToRefs(useUserStore())
  const activeTab = ref('partInfoSection')
  const dialogRef = ref<ArtDialogExpose<Usage | undefined>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const currentFieldAccess = computed(() =>
    form.data.id ? (form.data.fieldAccess ?? {}) : EDITABLE_VEHICLE_PART_USAGE_ACCESS
  )

  const createInitialForm = (): Usage => ({
    id: undefined,
    vehicleId: null,
    plateNo: '',
    companyName: '',
    partId: null,
    partType: 'original',
    partName: '',
    partCode: '',
    categoryId: null,
    categoryName: '',
    brand: '',
    model: '',
    unit: '',
    qualityCategory: '',
    manufacturer: '',
    supplierId: null,
    supplierName: '',
    supplierContact: '',
    isConsumable: false,
    rfidEnabled: false,
    rfidTag: '',
    enableMode: 'vehicle',
    enableDate: null,
    warrantyMode: 'vehicle',
    warrantyMileage: null,
    warrantyDuration: null,
    serviceMileageEnabled: true,
    serviceMileage: null,
    serviceYearsEnabled: false,
    serviceYears: null,
    usedMileage: 0,
    status: 'normal',
    scrapReason: '',
    remark: ''
  })

  const form = reactive<FormGroup>({
    data: createInitialForm(),
    vehicleSelection: [],
    partSelection: [],
    rules: {
      vehicleId: [{ required: true, message: '请选择车辆', trigger: 'change' }],
      partType: [{ required: true, message: '请选择零部件类型', trigger: 'change' }],
      partId: [{ required: true, message: '请选择零部件', trigger: 'change' }],
      rfidTag: [{ validator: validateRfidTag, trigger: 'blur' }],
      enableDate: [{ validator: validateEnableDate, trigger: 'change' }],
      warrantyMileage: [{ validator: validateWarranty, trigger: 'change' }],
      serviceMileage: [{ validator: validateServiceLife, trigger: 'change' }],
      serviceYears: [{ validator: validateServiceLife, trigger: 'change' }],
      serviceMileageEnabled: [
        {
          validator: (_rule: unknown, _value: unknown, callback: (error?: Error) => void) => {
            if (!form.data.serviceMileageEnabled && !form.data.serviceYearsEnabled)
              validateServiceLife(_rule, 0, callback)
            else callback()
          },
          trigger: 'change'
        }
      ],
      status: [{ validator: validateStatus, trigger: 'change' }]
    }
  })

  function handleServiceLimitChange() {
    if (form.data.serviceMileageEnabled || form.data.serviceYearsEnabled)
      formRef.value?.clearValidate('serviceMileageEnabled')
  }
  const formItems = computed<FormItem[]>(() => [
    { label: '零部件信息', key: 'partInfoSection', type: 'tab', span: 24 },
    {
      label: '车牌号',
      key: 'vehicleId',
      span: 12,
      type: 'dataSelect',
      props: {
        mode: 'table',
        multiple: false,
        modelValue: vehicleSelectValue.value,
        'onUpdate:modelValue': (value: typeof vehicleSelectValue.value) => {
          vehicleSelectValue.value = value
        },
        selectedData: form.vehicleSelection,
        'onUpdate:selectedData': (value: typeof form.vehicleSelection) => {
          form.vehicleSelection = value
        },
        apiFn: fetchApprovedVehicleSelectData,
        columns: vehicleColumns,
        rowKey: 'id',
        labelKey: 'plateNo',
        descriptionKey: 'companyName',
        title: '选择车辆',
        searchPlaceholder: '输入车牌号或所属公司',
        emptyText: '暂无可选车辆',
        emptyDescription: '请先维护车辆档案并确保车辆已启用。',
        showPagination: true,
        onChange: handleVehicleChange,
        showSelectedPanel: false
      },
      slots: { empty: () => h(VehicleDataSourceEmptyActions, { source: 'vehicle' }) }
    },
    { label: '所属公司', key: 'companyName', type: 'input', span: 12, props: { disabled: true } },
    {
      label: '零部件类型',
      key: 'partType',
      type: 'radioGroup',
      span: 24,
      options: getDictMap.value.vehiclePartType ?? []
    },
    {
      label: '零部件名称',
      key: 'partId',
      span: 12,
      type: 'dataSelect',
      props: {
        mode: 'table',
        multiple: false,
        modelValue: partSelectValue.value,
        'onUpdate:modelValue': (value: typeof partSelectValue.value) => {
          partSelectValue.value = value
        },
        selectedData: form.partSelection,
        'onUpdate:selectedData': (value: typeof form.partSelection) => {
          form.partSelection = value
        },
        apiFn: fetchPartRows,
        columns: partColumns,
        rowKey: 'id',
        labelKey: 'partName',
        descriptionKey: 'partCode',
        title: '选择零部件',
        searchPlaceholder: '输入零部件名称或编码',
        emptyText: '暂无可选零部件',
        emptyDescription: '请先维护零部件资料，并确认库存与启用状态满足当前领用条件。',
        showPagination: true,
        onChange: handlePartChange,
        showSelectedPanel: false
      },
      slots: { empty: () => h(VehicleDataSourceEmptyActions, { source: 'part' }) }
    },
    {
      label: '零部件类别',
      key: 'categoryName',
      type: 'input',
      span: 12,
      props: { disabled: true }
    },
    {
      label: '零部件品牌',
      key: 'brand',
      type: 'input',
      props: { disabled: true }
    },
    {
      label: '零部件型号',
      key: 'model',
      type: 'input',
      props: { disabled: true }
    },
    { label: '单位', key: 'unit', type: 'input', props: { disabled: true } },
    {
      label: '是否易损/耗件',
      key: 'isConsumable',
      type: 'radioGroup',
      props: {
        disabled: true,
        options: getBooleanDictOptions()
      }
    },
    {
      label: '品质分类',
      key: 'qualityCategory',
      type: 'select',
      options: getDictMap.value.vehiclePartQualityCategory ?? []
    },
    { label: '生产厂商', key: 'manufacturer', type: 'input' },
    ...(canViewField(currentFieldAccess.value, 'supplierDetails')
      ? ([
          {
            label: '供应厂商',
            key: 'supplierName',
            type: 'input',
            props: { disabled: true }
          },
          {
            label: '供应厂商联系人',
            key: 'supplierContact',
            type: 'input',
            span: 16,
            props: { disabled: true }
          }
        ] as FormItem[])
      : []),
    { label: '零部件使用', key: 'partUsageSection', type: 'tab', span: 24 },
    ...(canViewField(currentFieldAccess.value, 'traceabilityTag')
      ? ([
          {
            key: 'rfidEnabled',
            label: '启用RFID标签',
            type: 'radioGroup',
            span: 12,
            options: getBooleanDictOptions(),
            props: { disabled: !canEditField(currentFieldAccess.value, 'traceabilityTag') }
          },
          {
            key: 'rfidTag',
            label: 'RFID标签',
            type: 'input',
            span: 12,
            hidden: !form.data.rfidEnabled,
            props: {
              placeholder: '请输入RFID标签',
              maxlength: 80,
              clearable: true,
              disabled: !canEditField(currentFieldAccess.value, 'traceabilityTag')
            }
          }
        ] as FormItem[])
      : []),
    ...(canViewField(currentFieldAccess.value, 'lifecycleLimits')
      ? ([
          {
            key: 'enableMode',
            label: '启用方式',
            type: 'radioGroup',
            span: 12,
            options: getDictMap.value.vehiclePartEnableMode ?? [],
            props: {
              disabled: !canEditField(currentFieldAccess.value, 'lifecycleLimits'),
              onChange: handleEnableModeChange
            }
          },
          {
            key: 'enableDate',
            label: '启用日期',
            type: 'date',
            span: 12,
            hidden: form.data.enableMode !== 'date',
            props: {
              type: 'date',
              valueFormat: 'YYYY-MM-DD',
              placeholder: '选择启用日期',
              class: 'w-full',
              disabled: !canEditField(currentFieldAccess.value, 'lifecycleLimits')
            }
          },
          {
            key: 'warrantyMode',
            label: '质保方式',
            type: 'radioGroup',
            span: 24,
            options: getDictMap.value.vehiclePartWarrantyMode ?? [],
            props: {
              disabled: !canEditField(currentFieldAccess.value, 'lifecycleLimits'),
              onChange: handleWarrantyModeChange
            }
          },
          {
            key: 'warrantyMileage',
            label: '质保里程（公里）',
            type: 'number',
            span: 12,
            hidden: form.data.warrantyMode !== 'self',
            props: {
              min: 0,
              controls: false,
              class: 'w-full!',
              placeholder: '质保里程',
              disabled: !canEditField(currentFieldAccess.value, 'lifecycleLimits'),
              onChange: () => {
                if (form.data.warrantyMileage || form.data.warrantyDuration)
                  formRef.value?.clearValidate('warrantyMileage')
              }
            }
          },
          {
            key: 'warrantyDuration',
            label: '质保时长（个月）',
            type: 'number',
            span: 12,
            hidden: form.data.warrantyMode !== 'self',
            props: {
              min: 0,
              precision: 0,
              controls: false,
              class: 'w-full!',
              placeholder: '质保时长',
              disabled: !canEditField(currentFieldAccess.value, 'lifecycleLimits'),
              onChange: () => {
                if (form.data.warrantyMileage || form.data.warrantyDuration)
                  formRef.value?.clearValidate('warrantyMileage')
              }
            }
          },
          {
            key: 'serviceMileageEnabled',
            label: '使用里程限制',
            type: 'checkbox',
            span: 12,
            props: {
              label: '使用里程',
              disabled: !canEditField(currentFieldAccess.value, 'lifecycleLimits'),
              onChange: handleServiceLimitChange
            }
          },
          {
            key: 'serviceMileage',
            label: '使用里程（公里）',
            type: 'number',
            span: 12,
            hidden: !form.data.serviceMileageEnabled,
            props: {
              min: 0,
              controls: false,
              class: 'w-full!',
              disabled: !canEditField(currentFieldAccess.value, 'lifecycleLimits')
            }
          },
          {
            key: 'serviceYearsEnabled',
            label: '使用年限限制',
            type: 'checkbox',
            span: 12,
            props: {
              label: '使用年限',
              disabled: !canEditField(currentFieldAccess.value, 'lifecycleLimits'),
              onChange: handleServiceLimitChange
            }
          },
          {
            key: 'serviceYears',
            label: '使用年限（年）',
            type: 'number',
            span: 12,
            hidden: !form.data.serviceYearsEnabled,
            props: {
              min: 0,
              precision: 0,
              controls: false,
              class: 'w-full!',
              disabled: !canEditField(currentFieldAccess.value, 'lifecycleLimits')
            }
          },
          {
            label: '已使用里程',
            key: 'usedMileage',
            type: 'number',
            span: 12,
            props: {
              min: 0,
              controls: false,
              class: 'w-full',
              disabled: !canEditField(currentFieldAccess.value, 'lifecycleLimits')
            }
          }
        ] as FormItem[])
      : []),
    {
      key: 'status',
      label: '状态',
      type: 'radioGroup',
      span: 24,
      options: getDictMap.value.vehiclePartUsageStatus ?? [],
      props: { onChange: handleStatusChange }
    },
    {
      key: 'scrapReason',
      label: '报废原因',
      type: 'input',
      span: 24,
      hidden:
        form.data.status !== 'scrapped' ||
        !canViewField(currentFieldAccess.value, 'dispositionNotes'),
      props: {
        placeholder: '请输入报废原因',
        maxlength: 200,
        disabled: !canEditField(currentFieldAccess.value, 'dispositionNotes'),
        onChange: () => {
          if (form.data.scrapReason?.trim()) formRef.value?.clearValidate('status')
        }
      }
    },
    ...(canViewField(currentFieldAccess.value, 'dispositionNotes')
      ? ([
          {
            label: '备注',
            key: 'remark',
            type: 'input',
            span: 24,
            props: {
              type: 'textarea',
              rows: 3,
              maxlength: 500,
              showWordLimit: true,
              disabled: !canEditField(currentFieldAccess.value, 'dispositionNotes')
            }
          }
        ] as FormItem[])
      : [])
  ])

  const vehicleSelectValue = computed<DataSelectKey | undefined>({
    get: () => form.data.vehicleId ?? undefined,
    set: (value) => {
      form.data.vehicleId = value ? String(value) : null
    }
  })

  const partSelectValue = computed<DataSelectKey | undefined>({
    get: () => form.data.partId ?? undefined,
    set: (value) => {
      form.data.partId = value ? String(value) : null
    }
  })

  const vehicleColumns: DataSelectColumn[] = [
    { prop: 'companyName', label: '所属公司', minWidth: 180 },
    { prop: 'plateNo', label: '车牌号', width: 140 },
    {
      prop: 'operationStatus',
      label: '营运状态',
      width: 120,
      dict: { code: 'vehicleOperationStatus', display: 'auto' }
    }
  ]

  const partColumns: DataSelectColumn[] = [
    { prop: 'partName', label: '零部件名称', minWidth: 180 },
    { prop: 'partCode', label: '零部件编码', minWidth: 150 },
    {
      prop: 'category',
      label: '类别',
      minWidth: 120,
      formatter: (row) => row.category?.categoryName || '-'
    },
    { prop: 'brand', label: '品牌', width: 110 },
    { prop: 'model', label: '型号', minWidth: 130 },
    { prop: 'unit', label: '单位', width: 80 },
    {
      prop: 'supplier',
      label: '供应厂商',
      minWidth: 150,
      formatter: (row) => row.supplier?.supplierName || '-'
    }
  ]

  const getBooleanDictOptions = () =>
    (getDictMap.value.commonBoolean ?? []).map((item) => ({
      ...item,
      value: item.value === 'true'
    }))

  const fetchPartRows = async (params: DataSelectFetchParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
    const { data, total } = await fetchPartsList({
      partName: params.keyword,
      status: '1',
      from,
      to
    })
    return { data: data ?? [], total: total ?? 0 }
  }

  const handleVehicleChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const vehicle = rows[0] as Vehicle | undefined
    form.data.vehicleId = vehicle?.id ?? null
    form.data.plateNo = vehicle?.plateNo ?? ''
    form.data.companyName = vehicle?.companyName ?? ''
    if (form.data.enableMode === 'vehicle') {
      form.data.enableDate = vehicle?.startUseDate ?? vehicle?.registerDate ?? null
    }
  }

  const handlePartChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const part = rows[0] as Part | undefined
    form.data.partId = part?.id ?? null
    form.data.partName = part?.partName ?? ''
    form.data.partCode = part?.partCode ?? ''
    form.data.categoryId = part?.categoryId ?? null
    form.data.categoryName = part?.category?.categoryName ?? ''
    form.data.brand = part?.brand ?? ''
    form.data.model = part?.model ?? ''
    form.data.unit = part?.unit ?? ''
    form.data.manufacturer = part?.manufacturer ?? ''
    form.data.supplierId = part?.supplierId ?? null
    form.data.supplierName = part?.supplier?.supplierName ?? ''
    form.data.supplierContact = part?.supplierContact ?? ''
    form.data.isConsumable = Boolean(part?.isConsumable)
    form.data.warrantyMileage = part?.warrantyMileage ?? null
    form.data.warrantyDuration = part?.warrantyDuration ?? null
    form.data.serviceMileage = part?.serviceMileage ?? null
    form.data.serviceMileageEnabled =
      part?.serviceMileage !== null && part?.serviceMileage !== undefined
    form.data.serviceYears = part?.serviceLife ?? null
    form.data.serviceYearsEnabled = part?.serviceLife !== null && part?.serviceLife !== undefined
  }

  const handleEnableModeChange = (): void => {
    if (form.data.enableMode === 'date') {
      form.data.enableDate = null
      return
    }
    const vehicle = form.vehicleSelection[0] as Vehicle | undefined
    form.data.enableDate = vehicle?.startUseDate ?? vehicle?.registerDate ?? null
  }

  const handleWarrantyModeChange = (): void => {
    if (form.data.warrantyMode === 'vehicle') {
      form.data.warrantyMileage = null
      form.data.warrantyDuration = null
    }
  }

  const handleStatusChange = (): void => {
    if (form.data.status !== 'scrapped') form.data.scrapReason = ''
  }

  function validateRfidTag(_rule: unknown, value: string, callback: (error?: Error) => void): void {
    if (!canEditField(currentFieldAccess.value, 'traceabilityTag')) return callback()
    if (form.data.rfidEnabled && !String(value ?? '').trim()) {
      callback(new Error('请输入RFID标签'))
      return
    }
    callback()
  }

  function validateEnableDate(
    _rule: unknown,
    value: string,
    callback: (error?: Error) => void
  ): void {
    if (!canEditField(currentFieldAccess.value, 'lifecycleLimits')) return callback()
    if (form.data.enableMode === 'date' && !value) {
      callback(new Error('请选择启用日期'))
      return
    }
    callback()
  }

  function validateWarranty(
    _rule: unknown,
    _value: number,
    callback: (error?: Error) => void
  ): void {
    if (!canEditField(currentFieldAccess.value, 'lifecycleLimits')) return callback()
    if (
      form.data.warrantyMode === 'self' &&
      !form.data.warrantyMileage &&
      !form.data.warrantyDuration
    ) {
      callback(new Error('请至少填写质保里程或质保时长'))
      return
    }
    callback()
  }

  function validateServiceLife(
    _rule: unknown,
    _value: number,
    callback: (error?: Error) => void
  ): void {
    if (!canEditField(currentFieldAccess.value, 'lifecycleLimits')) return callback()
    if (!form.data.serviceMileageEnabled && !form.data.serviceYearsEnabled) {
      callback(new Error('请至少选择一种使用寿命'))
      return
    }
    if (form.data.serviceMileageEnabled && !form.data.serviceMileage) {
      callback(new Error('请输入使用里程'))
      return
    }
    if (form.data.serviceYearsEnabled && !form.data.serviceYears) {
      callback(new Error('请输入使用年限'))
      return
    }
    callback()
  }

  function validateStatus(_rule: unknown, _value: string, callback: (error?: Error) => void): void {
    if (!canEditField(currentFieldAccess.value, 'dispositionNotes')) return callback()
    if (form.data.status === 'scrapped' && !String(form.data.scrapReason ?? '').trim()) {
      callback(new Error('请输入报废原因'))
      return
    }
    callback()
  }

  const replaceForm = (data: Usage): void => {
    Object.assign(form.data, createInitialForm(), cloneDeep(toRaw(data)))
    form.vehicleSelection = data.vehicleId
      ? [
          {
            id: data.vehicleId,
            plateNo: data.plateNo,
            companyName: data.companyName
          }
        ]
      : []
    form.partSelection = data.partId
      ? [
          {
            id: data.partId,
            partName: data.partName,
            partCode: data.partCode,
            categoryName: data.categoryName,
            brand: data.brand,
            model: data.model,
            unit: data.unit,
            supplierName: data.supplierName
          }
        ]
      : []
  }

  const resetForm = async (): Promise<void> => {
    replaceForm(createInitialForm())
    await nextTick()
    formRef.value?.clearValidate()
  }

  const normalizePayload = (): Usage => {
    const payload = { ...toRaw(form.data) }
    delete payload.tenantId
    delete payload.createBy
    delete payload.createTime
    delete payload.updateBy
    delete payload.updateTime

    if (!payload.rfidEnabled) payload.rfidTag = ''
    if (payload.warrantyMode === 'vehicle') {
      payload.warrantyMileage = null
      payload.warrantyDuration = null
    }
    if (!payload.serviceMileageEnabled) payload.serviceMileage = null
    if (!payload.serviceYearsEnabled) payload.serviceYears = null
    if (payload.status !== 'scrapped') payload.scrapReason = ''
    return sanitizeVehiclePartUsagePayload(payload)
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '表单校验未完成，请稍后重试', 'warning')
      return false
    }

    try {
      const payload = normalizePayload()
      if (form.data.id) {
        await editVehiclePartUsage(payload)
      } else {
        await addVehiclePartUsage(payload)
      }
      emit('success', form.data.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '车辆配件记录保存失败，请检查配件信息后重试')
      return false
    }
  }

  const handleOpen = async (row?: Usage): Promise<void> => {
    activeTab.value = 'partInfoSection'
    await resetForm()
    if (row?.id) replaceForm(row)
    await dialogRef.value?.handleOpen(row, {
      title: row?.id ? '编辑零部件使用记录' : '新增零部件使用记录',
      contentMaxHeight: '74vh',
      onConfirm: handleSubmit,
      onReset: () => void resetForm()
    })
  }

  defineExpose({
    handleOpen,
    handleClose: () => dialogRef.value?.handleClose()
  })
</script>

<style scoped lang="scss">
  .vehicle-part-usage-form {
    :deep(.art-section-title) {
      margin: 8px 0 20px;
    }

    &__permission-alert {
      margin-bottom: 16px;
    }

    @media (width <= 768px) {
      :deep(.el-col-8),
      :deep(.el-col-12),
      :deep(.el-col-16) {
        flex: 0 0 100%;
        max-width: 100%;
      }
    }
  }
</style>
