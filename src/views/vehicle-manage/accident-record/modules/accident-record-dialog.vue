<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <template #subtitle
      >完整记录事故事实、损失、责任、处置状态与证据附件，支持后续安全复盘。</template
    >

    <div class="accident-record-dialog">
      <ArtForm
        ref="formRef"
        v-model:active-tab="activeTab"
        v-model="form.data"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="20"
        label-width="120px"
      >
        <template #accidentLocation>
          <ArtAddressPicker
            v-model:address-detail="form.data.accidentLocation"
            v-model:longitude="form.data.accidentLongitude"
            v-model:latitude="form.data.accidentLatitude"
            hide-region-selector
            detail-label="事故地点"
            detail-placeholder="输入事故地点，或使用地图搜索并选点"
            address-detail-prop="accidentLocation"
            label-width="120px"
            :disabled="!canEditAccidentField('accidentLocation')"
            @address-change="handleLocationChange"
          />
        </template>

        <template #accidentAttachments>
          <section v-if="canViewDocuments" class="accident-record-dialog__section">
            <div class="accident-record-dialog__section-header">
              <ArtSectionTitle :show-line="false">事故附件</ArtSectionTitle>
              <ElButton
                v-if="canEditDocuments"
                type="primary"
                plain
                :disabled="!attachmentTenantId"
                :title="!attachmentTenantId ? '请先选择车辆' : undefined"
                @click="openAttachmentDialog"
              >
                <template #icon><ArtSvgIcon icon="ri:upload-2-line" /></template>
                上传
              </ElButton>
            </div>
            <VehicleAttachmentTable
              :attachments="form.data.attachments ?? []"
              name-label="事故附件名称"
              :removable="canEditDocuments"
              @remove="removeAttachment"
            />
          </section>
        </template>
      </ArtForm>
    </div>
  </ArtDialog>

  <ArtDialog ref="attachmentDialogRef" size="md">
    <div class="accident-attachment-dialog">
      <ArtForm
        ref="attachmentFormRef"
        v-model="attachment.data"
        :items="attachment.items"
        :rules="attachment.rules"
        :span="24"
        label-width="150px"
      >
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { fetchVehicleDriverChoices } from '@/api/vehicle-driver-select'
  import type { DataSelectFetchParams } from '@/components/core/forms/art-data-select/types'
  import {
    vehicleDriverColumns,
    vehicleDriverSelectProps
  } from '@/components/business/vehicle-driver-select/columns'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { h } from 'vue'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableNumber } from '@/utils/form/normalize'

  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { useDraftAttachmentRemoval } from '@/hooks/core/useDraftAttachmentRemoval'
  import type { ComputedRef, UnwrapNestedRefs } from 'vue'
  import { cloneDeep } from 'lodash-es'
  import type { FormRules } from 'element-plus'
  import { ElButton, ElMessage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'

  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import ArtAddressPicker from '@/components/core/forms/art-address-picker/index.vue'
  import type { AddressLocationPayload } from '@/components/core/forms/art-address-picker/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import VehicleDataSourceEmptyActions from '../../../components/vehicle-data-source-empty-actions.vue'
  import type { DataSelectRecord } from '@/components/core/forms/art-data-select/types'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import {
    addVehicleAccident,
    editVehicleAccident,
    fetchApprovedVehicleSelectData,
    type VmsDriverReference
  } from '@vms/api'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { canEditField, canViewField } from '@/utils/field-permission'
  import {
    EDITABLE_VEHICLE_ACCIDENT_ACCESS,
    sanitizeVehicleAccidentPayload
  } from './accident-record-model'
  import {
    createInitialAttachmentForm,
    useVehicleAttachmentDialog,
    type VehicleAttachmentFormData as AttachmentFormData,
    type VehicleAttachmentGroup as AttachmentGroup,
    type VehicleFormExpose as FormExpose
  } from '../../vehicle-attachment-dialog'
  import VehicleAttachmentTable from '../../vehicle-attachment-table.vue'

  defineOptions({ name: 'AccidentRecordDialog' })

  type AccidentRecord = Api.Vms.VehicleManage.VehicleAccidentRecord
  type AccidentFieldKey = Api.Vms.VehicleManage.VehicleAccidentFieldKey
  type VehicleArchive = Api.Vms.ArchiveManage.VehicleArchive

  interface FormGroup {
    data: AccidentRecord
    items: ComputedRef<FormItem[]>
    rules: ComputedRef<FormRules<AccidentRecord>>
    vehicleSelection: VehicleArchive[]
  }

  interface Emits {
    (e: 'success', type: 'add' | 'edit'): void
  }

  const emit = defineEmits<Emits>()
  const responsibilityOptions = useDictionaryOptions('vehicleAccidentResponsibility')
  const accidentSourceOptions = useDictionaryOptions('vehicleAccidentDataSource')
  const booleanOptions = useDictionaryOptions<boolean>('commonBoolean', (value) => value === 'true')
  const processedOptions = useDictionaryOptions<boolean>(
    'vehicleRecordProcessed',
    (value) => value === 'true'
  )
  const activeTab = ref('baseSection')
  const dialogRef = ref<ArtDialogExpose<AccidentRecord | undefined>>()
  const attachmentDialogRef = ref<ArtDialogExpose<void>>()
  const formRef = ref<FormExpose>()
  const attachmentFormRef = ref<FormExpose>()
  const tenantScopeStore = useTenantScopeStore()

  const createInitialForm = (): AccidentRecord => ({
    id: undefined,
    vehicleId: null,
    plateNo: '',
    companyName: '',
    driverName: '',
    driverId: null,
    driverPhone: '',
    accidentTime: '',
    accidentLocation: '',
    accidentLongitude: null,
    accidentLatitude: null,
    accidentSummary: '',
    damageLevel: '',
    responsibilityType: '',
    responsibilityPercent: null,
    companyBearAmount: null,
    economicLoss: null,
    reported: false,
    insuranceReported: false,
    processed: false,
    dataSource: 'self',
    remark: '',
    attachments: [],
    fieldAccess: { ...EDITABLE_VEHICLE_ACCIDENT_ACCESS },
    isRecordOwner: true
  })

  const canViewAccidentField = (field: AccidentFieldKey): boolean =>
    !form.data.id || canViewField(form.data.fieldAccess, field)
  const canEditAccidentField = (field: AccidentFieldKey): boolean =>
    !form.data.id || canEditField(form.data.fieldAccess, field)
  const canViewDocuments = computed(() => canViewAccidentField('documents'))
  const canEditDocuments = computed(() => canEditAccidentField('documents'))
  const attachmentTenantId = computed(
    () => form.data.tenantId || tenantScopeStore.effectiveTenantId || ''
  )

  const DRIVER_FIELDS = new Set(['driverId', 'driverName', 'driverPhone'])
  const LOCATION_FIELDS = new Set(['accidentLocation'])
  const NARRATIVE_FIELDS = new Set(['accidentSummary', 'remark'])
  const LOSS_FIELDS = new Set(['economicLoss', 'companyBearAmount'])

  const getSensitiveFieldForFormItem = (item: FormItem): AccidentFieldKey | null => {
    const key = String(item.key)
    if (DRIVER_FIELDS.has(key)) return 'driverContact'
    if (LOCATION_FIELDS.has(key)) return 'accidentLocation'
    if (NARRATIVE_FIELDS.has(key)) return 'accidentNarrative'
    if (LOSS_FIELDS.has(key)) return 'lossAmounts'
    return null
  }

  const dateTimeProps = {
    type: 'datetime',
    valueFormat: 'YYYY-MM-DD HH:mm:ss',
    class: '!w-full'
  }

  const moneyProps = {
    min: 0,
    precision: 2,
    controlsPosition: 'right',
    class: '!w-full'
  }

  const form: UnwrapNestedRefs<FormGroup> = reactive<FormGroup>({
    data: createInitialForm(),
    vehicleSelection: [],
    items: computed<FormItem[]>(() => {
      const items: FormItem[] = [
        { label: '基础信息', key: 'baseSection', type: 'tab', span: 24 },
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
            dialogWidth: 'xl',
            showTableHeader: true,
            searchPlaceholder: '输入车牌号或所属公司',
            emptyText: '暂无可选车辆',
            emptyDescription: '请先维护车辆档案并确保车辆已启用。',
            showPagination: true,
            onChange: handleVehicleChange,
            showSelectedPanel: false
          },
          slots: { empty: () => h(VehicleDataSourceEmptyActions, { source: 'vehicle' }) }
        },
        { label: '所属公司', key: 'companyName', type: 'input', props: { disabled: true } },
        {
          label: '驾驶员',
          key: 'driverId',
          type: 'dataSelect',
          props: {
            ...vehicleDriverSelectProps('driver'),
            title: '选择驾驶员',
            apiFn: (params: DataSelectFetchParams) =>
              fetchVehicleDriverChoices<VmsDriverReference>('vehicle_driver', params, {
                vehicleId: form.data.vehicleId
              }),
            selectedData: form.data.driverId
              ? [{ id: form.data.driverId, driverName: form.data.driverName }]
              : [],
            disabled: !form.data.vehicleId || !canEditAccidentField('driverContact'),
            placeholder: form.data.vehicleId ? '请选择驾驶员（选填）' : '请先选择车辆',
            onChange: (_value: unknown, rows: VmsDriverReference[]) =>
              handleDriverChange(rows[0] ?? null)
          }
        },
        {
          label: '联系方式',
          key: 'driverPhone',
          type: 'input',
          props: { maxlength: 30, placeholder: '参选司机后自动带出，可按实际情况修改' }
        },
        { label: '事故时间', key: 'accidentTime', type: 'date', props: dateTimeProps },
        {
          label: '',
          key: 'accidentLocation',
          type: 'input',
          span: 24,
          labelWidth: 0
        },
        {
          label: '事故概述',
          key: 'accidentSummary',
          type: 'input',
          span: 24,
          props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true }
        },
        { label: '责任及处理', key: 'processSection', type: 'tab', span: 24 },
        { label: '事故等级', key: 'damageLevel', type: 'input', props: { maxlength: 50 } },
        {
          label: '责任类型',
          key: 'responsibilityType',
          type: 'select',
          props: { options: responsibilityOptions }
        },
        {
          label: '责任比例',
          key: 'responsibilityPercent',
          type: 'number',
          props: {
            min: 0,
            max: 100,
            precision: 0,
            controlsPosition: 'right',
            class: '!w-full'
          }
        },
        { label: '经济损失', key: 'economicLoss', type: 'number', props: moneyProps },
        { label: '公司承担', key: 'companyBearAmount', type: 'number', props: moneyProps },
        {
          label: '是否报案',
          key: 'reported',
          type: 'radioGroup',
          props: { options: getBooleanDictOptions() }
        },
        {
          label: '是否报保险公司',
          key: 'insuranceReported',
          type: 'radioGroup',
          props: { options: getBooleanDictOptions() }
        },
        {
          label: '是否处理',
          key: 'processed',
          type: 'radioGroup',
          props: { options: getProcessedDictOptions() }
        },
        {
          label: '数据来源',
          key: 'dataSource',
          type: 'select',
          props: { options: accidentSourceOptions }
        },
        {
          label: '备注',
          key: 'remark',
          type: 'input',
          span: 24,
          props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true }
        },
        {
          key: 'accidentAttachmentsSection',
          label: '事故附件',
          type: 'tab',
          hidden: !canViewDocuments.value
        },
        { key: 'accidentAttachments', label: '', type: 'slot', span: 24 }
      ]
      return items
        .filter((item) => {
          const field = getSensitiveFieldForFormItem(item)
          return !field || canViewAccidentField(field)
        })
        .map((item) => {
          const field = getSensitiveFieldForFormItem(item)
          if (!field || canEditAccidentField(field) || field === 'accidentLocation') return item
          return { ...item, props: { ...(item.props ?? {}), disabled: true } }
        })
    }),
    rules: computed<FormRules<AccidentRecord>>(() => ({
      vehicleId: [{ required: true, message: '请选择车辆', trigger: 'change' }],
      accidentTime: [{ required: true, message: '请选择事故时间', trigger: 'change' }],
      accidentSummary: canEditAccidentField('accidentNarrative')
        ? [{ required: true, message: '请输入事故概述', trigger: 'blur' }]
        : [],
      dataSource: [{ required: true, message: '请选择数据来源', trigger: 'change' }]
    }))
  })

  const attachment: UnwrapNestedRefs<AttachmentGroup> = reactive<AttachmentGroup>({
    data: createInitialAttachmentForm(),
    items: computed<FormItem[]>(() => [
      {
        label: '事故附件名称',
        key: 'name',
        type: 'input',
        props: { maxlength: 100 }
      },
      {
        label: '选择上传文件',
        key: 'file',
        type: 'uploadFile',
        props: {
          title: attachmentTenantId.value ? '选择上传文件' : '请先选择车辆',
          resourceTenantId: attachmentTenantId.value,
          disabled: !attachmentTenantId.value,
          showFileList: false,
          showTip: false,
          onResourceChange: handleAttachmentFileChange
        },
        description: () =>
          attachment.data.fileName ? (
            <div class="accident-attachment-dialog__file">
              <span>{attachment.data.fileName}</span>
              {attachment.data.url ? <ArtSvgIcon icon="ri:check-line" /> : null}
            </div>
          ) : null
      }
    ]),
    rules: computed<FormRules<AttachmentFormData>>(() => ({
      name: [{ required: true, message: '请输入事故附件名称', trigger: 'blur' }],
      file: [{ required: true, message: '请选择上传文件', trigger: 'change' }]
    }))
  })

  const vehicleSelectValue = computed({
    get: () => form.data.vehicleId ?? undefined,
    set: (value?: string | number) => {
      form.data.vehicleId = value ? String(value) : null
    }
  })

  const vehicleColumns = vehicleDriverColumns('vehicle')

  const getBooleanDictOptions = () => booleanOptions

  const getProcessedDictOptions = () => processedOptions

  const handleVehicleChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const vehicle = rows[0] as VehicleArchive | undefined
    const targetTenantId = vehicle?.tenantId || tenantScopeStore.effectiveTenantId || undefined
    if (form.data.tenantId !== targetTenantId && (form.data.attachments?.length ?? 0) > 0) {
      form.data.attachments = []
      ElMessage.warning('车辆所属租户已变化，原有附件已清空，请重新上传')
    }
    Object.assign(form.data, {
      tenantId: targetTenantId,
      vehicleId: vehicle?.id ?? null,
      plateNo: vehicle?.plateNo ?? '',
      companyName: vehicle?.companyName ?? '',
      driverId: vehicle?.primaryDriverId ?? null,
      driverName: vehicle?.primaryDriver?.driverName || vehicle?.driverOneName || '',
      driverPhone: vehicle?.primaryDriver?.phone || vehicle?.driverOnePhone || ''
    })
  }

  const handleDriverChange = (driver: VmsDriverReference | null): void => {
    form.data.driverId = driver?.id ?? null
    form.data.driverName = driver?.driverName ?? ''
    form.data.driverPhone =
      driver && canViewField(driver.fieldAccess, 'contactPhone') ? (driver.phone ?? '') : ''
  }

  const handleLocationChange = (location: AddressLocationPayload): void => {
    if (location.coordinateStatus !== 'unconfirmed') return
    Object.assign(form.data, {
      accidentLongitude: null,
      accidentLatitude: null
    })
  }

  const replaceForm = (data: AccidentRecord): void => {
    Object.assign(form.data, createInitialForm(), cloneDeep(toRaw(data)))
    form.data.attachments ??= []
    form.vehicleSelection = form.data.vehicleId
      ? [
          {
            id: form.data.vehicleId,
            plateNo: form.data.plateNo,
            companyName: form.data.companyName
          } as VehicleArchive
        ]
      : []
  }

  const resetForm = async (): Promise<void> => {
    replaceForm(createInitialForm())
    await nextTick()
    formRef.value?.clearValidate()
  }

  const { resetAttachmentForm, handleAttachmentFileChange, handleAttachmentConfirm } =
    useVehicleAttachmentDialog(form, attachment, attachmentFormRef)

  const openAttachmentDialog = async (): Promise<void> => {
    await resetAttachmentForm()
    await attachmentDialogRef.value?.handleOpen(undefined, {
      title: '上传事故附件',
      contentMaxHeight: '420px',
      onConfirm: handleAttachmentConfirm,
      onReset: () => void resetAttachmentForm()
    })
  }

  const normalizePayload = (): AccidentRecord => {
    const payload = { ...toRaw(form.data) }
    const accidentLongitude = normalizeNullableNumber(payload.accidentLongitude)
    const accidentLatitude = normalizeNullableNumber(payload.accidentLatitude)
    const hasCoordinate = accidentLongitude !== null && accidentLatitude !== null
    return sanitizeVehicleAccidentPayload({
      ...payload,
      vehicleId: payload.vehicleId || null,
      driverName: payload.driverName?.trim() || '',
      driverPhone: payload.driverPhone?.trim() || '',
      accidentLocation: payload.accidentLocation?.trim() || '',
      accidentLongitude: hasCoordinate ? accidentLongitude : null,
      accidentLatitude: hasCoordinate ? accidentLatitude : null,
      attachments: payload.attachments ?? []
    })
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
        await editVehicleAccident(payload)
      } else {
        await addVehicleAccident(payload)
      }
      emit('success', form.data.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '车辆事故记录保存失败，请检查事故信息后重试')
      return false
    }
  }

  const handleOpen = async (row?: AccidentRecord): Promise<void> => {
    activeTab.value = 'baseSection'
    await resetForm()
    if (row?.id) replaceForm(row)

    await dialogRef.value?.handleOpen(row, {
      title: row?.id ? '编辑事故记录' : '新增事故记录',
      contentMaxHeight: '74vh',
      onConfirm: handleSubmit,
      onReset: () => void resetForm()
    })
  }

  const removeAttachment = useDraftAttachmentRemoval<Api.Vms.VehicleManage.VehicleAttachment>({
    getAttachments: () => form.data.attachments,
    setAttachments: (rows) => {
      form.data.attachments = rows
    },
    canRemove: () => canEditDocuments.value,
    getContext: () => [form.data.id, form.data.tenantId, form.data.vehicleId]
  })

  defineExpose({
    handleOpen,
    handleClose: () => dialogRef.value?.handleClose()
  })
</script>

<style scoped lang="scss">
  .accident-record-dialog {
    &__section {
      padding: 0 16px;
      margin-top: 8px;
    }

    &__section-header {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
  }

  .accident-attachment-dialog {
    padding: 8px 0 4px;

    &__file {
      display: flex;
      gap: 8px;
      align-items: center;
      color: var(--el-text-color-secondary);

      :deep(.art-svg-icon) {
        color: var(--el-color-success);
      }
    }
  }
</style>
