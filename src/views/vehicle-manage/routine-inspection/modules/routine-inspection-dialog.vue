<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <template #subtitle
      >记录检查类型、人员、检查结果和处置方式，形成可复核的车辆安全检查记录。</template
    >

    <div class="routine-inspection-dialog">
      <ArtForm
        ref="formRef"
        v-model="form.data"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="20"
        label-width="120px"
        :show-reset="false"
        :show-submit="false"
      >
        <template #vehicleId>
          <ArtTableSingleSelect
            v-model="vehicleSelectValue"
            v-model:selected-data="form.vehicleSelection"
            :api-fn="fetchApprovedVehicleSelectData"
            :columns="vehicleColumns"
            row-key="id"
            label-key="plateNo"
            description-key="companyName"
            title="选择车辆"
            search-placeholder="输入车牌号或所属公司"
            empty-text="暂无可选车辆"
            empty-description="请先维护车辆档案并确保车辆已启用。"
            show-pagination
            @change="handleVehicleChange"
          >
            <template #empty><VehicleDataSourceEmptyActions source="vehicle" /></template>
          </ArtTableSingleSelect>
        </template>
        <template #driverId>
          <VmsDriverSelect
            :model-value="form.data.driverId"
            :vehicle-id="form.data.vehicleId"
            :driver-name="form.data.driverName"
            :disabled="!canEditField(currentFieldAccess, 'responsiblePeople')"
            @change="handleDriverChange"
          />
        </template>
      </ArtForm>

      <section
        v-if="canViewField(currentFieldAccess, 'documents')"
        class="routine-inspection-dialog__section"
      >
        <div class="routine-inspection-dialog__section-header">
          <ArtSectionTitle :show-line="false">例检附件</ArtSectionTitle>
          <ElButton
            v-if="canEditField(currentFieldAccess, 'documents')"
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
        <ArtTable
          :data="form.data.attachments"
          :columns="attachmentColumns"
          :pagination="undefined"
          :show-table-header="false"
          empty-height="160px"
        />
      </section>
    </div>
  </ArtDialog>

  <ArtDialog ref="attachmentDialogRef" size="md">
    <div class="routine-attachment-dialog">
      <ArtForm
        ref="attachmentFormRef"
        v-model="attachment.data"
        :items="attachment.items"
        :rules="attachment.rules"
        :span="24"
        label-width="140px"
        :show-reset="false"
        :show-submit="false"
      >
        <template #file>
          <div class="routine-attachment-dialog__upload">
            <ArtUploadFile
              :title="attachmentTenantId ? '选择上传文件' : '请先选择车辆'"
              :resource-tenant-id="attachmentTenantId"
              :disabled="!attachmentTenantId"
              :show-file-list="false"
              :show-tip="false"
              @resource-change="handleAttachmentFileChange"
            />
            <div v-if="attachment.data.fileName" class="routine-attachment-dialog__file">
              <span>{{ attachment.data.fileName }}</span>
              <ArtSvgIcon v-if="attachment.data.url" icon="ri:check-line" />
            </div>
          </div>
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import BusinessAttachmentRowActions from '@/components/business/business-attachment-row-actions/index.vue'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import type { ComputedRef, UnwrapNestedRefs } from 'vue'
  import { cloneDeep } from 'lodash-es'
  import type { FormRules } from 'element-plus'
  import { ElButton, ElMessage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import VehicleDataSourceEmptyActions from '../../../components/vehicle-data-source-empty-actions.vue'
  import VmsDriverSelect from '../../../components/vms-driver-select.vue'
  import type { VmsDriverReference } from '@vms/api'
  import type {
    DataSelectColumn,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    addVehicleRoutineInspection,
    editVehicleRoutineInspection,
    fetchApprovedVehicleSelectData
  } from '@vms/api'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { getFileExtension } from '@/utils/file'
  import { attachmentTableLink } from '@/components/core/media/art-file-viewer/table-link'
  import { canEditField, canViewField } from '@/utils/field-permission'
  import {
    EDITABLE_VEHICLE_ROUTINE_INSPECTION_ACCESS,
    sanitizeVehicleRoutineInspectionPayload
  } from './routine-inspection-model'

  defineOptions({ name: 'RoutineInspectionDialog' })

  const { confirmAction } = useArtFeedback()

  type RoutineInspection = Api.Vms.VehicleManage.VehicleRoutineInspectionRecord
  type VehicleArchive = Api.Vms.ArchiveManage.VehicleArchive
  type Attachment = Api.Vms.VehicleManage.VehicleAttachment

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  interface FormGroup {
    data: RoutineInspection
    items: ComputedRef<FormItem[]>
    rules: ComputedRef<FormRules<RoutineInspection>>
    vehicleSelection: VehicleArchive[]
  }

  interface AttachmentFormData {
    name: string
    file: string
    fileName: string
    url: string
    fileType?: string
    fileSize?: string
  }

  interface AttachmentGroup {
    data: AttachmentFormData
    items: ComputedRef<FormItem[]>
    rules: ComputedRef<FormRules<AttachmentFormData>>
  }

  interface Emits {
    (e: 'success', type: 'add' | 'edit'): void
  }

  const emit = defineEmits<Emits>()
  const inspectionTypeOptions = useDictionaryOptions('vehicleRoutineInspectionType')
  const inspectionResultOptions = useDictionaryOptions('vehicleRoutineInspectionResult')
  const dialogRef = ref<ArtDialogExpose<RoutineInspection | undefined>>()
  const attachmentDialogRef = ref<ArtDialogExpose<void>>()
  const formRef = ref<FormExpose>()
  const routineNumber = useDocumentNumberRule('vehicle.routine_inspection')
  const tenantScopeStore = useTenantScopeStore()
  const attachmentFormRef = ref<FormExpose>()
  const currentFieldAccess = computed(() =>
    form.data.id ? (form.data.fieldAccess ?? {}) : EDITABLE_VEHICLE_ROUTINE_INSPECTION_ACCESS
  )
  const attachmentTenantId = computed(
    () => form.data.tenantId || tenantScopeStore.effectiveTenantId || ''
  )

  const createInitialForm = (): RoutineInspection => ({
    id: undefined,
    vehicleId: null,
    plateNo: '',
    companyName: '',
    routineInspectionNo: '',
    inspectionType: 'daily',
    inspectionTime: '',
    inspector: '',
    driverName: '',
    driverId: null,
    checkCondition: '',
    checkResult: 'qualified',
    handlingMethod: '',
    remark: '',
    attachments: []
  })

  const createInitialAttachmentForm = (): AttachmentFormData => ({
    name: '',
    file: '',
    fileName: '',
    url: '',
    fileType: '',
    fileSize: ''
  })

  const dateTimeProps = {
    type: 'datetime',
    valueFormat: 'YYYY-MM-DD HH:mm:ss',
    class: '!w-full'
  }

  const form: UnwrapNestedRefs<FormGroup> = reactive<FormGroup>({
    data: createInitialForm(),
    vehicleSelection: [],
    items: computed<FormItem[]>(() => [
      { label: '基础信息', key: 'baseSection', type: 'divider', span: 24 },
      { label: '车牌号', key: 'vehicleId', span: 12 },
      { label: '所属公司', key: 'companyName', type: 'input', props: { disabled: true } },
      {
        label: '例检编号',
        key: 'routineInspectionNo',
        type: 'input',
        props: {
          maxlength: 80,
          ...routineNumber.inputProps(Boolean(form.data.id), '请输入例检编号', true)
        },
        description: routineNumber.description.value
      },
      {
        label: '例检类型',
        key: 'inspectionType',
        type: 'select',
        props: { options: inspectionTypeOptions }
      },
      { label: '例检时间', key: 'inspectionTime', type: 'date', props: dateTimeProps },
      ...(canViewField(currentFieldAccess.value, 'responsiblePeople')
        ? [
            {
              label: '检查人',
              key: 'inspector',
              type: 'input',
              props: {
                maxlength: 50,
                disabled: !canEditField(currentFieldAccess.value, 'responsiblePeople')
              }
            },
            {
              label: '驾驶员',
              key: 'driverId'
            }
          ]
        : []),
      ...(canViewField(currentFieldAccess.value, 'inspectionFindings')
        ? [
            {
              label: '检查结果',
              key: 'checkResult',
              type: 'select',
              props: {
                options: inspectionResultOptions,
                disabled: !canEditField(currentFieldAccess.value, 'inspectionFindings')
              }
            },
            {
              label: '检查情况',
              key: 'checkCondition',
              type: 'input',
              span: 24,
              props: {
                type: 'textarea',
                rows: 3,
                maxlength: 500,
                showWordLimit: true,
                disabled: !canEditField(currentFieldAccess.value, 'inspectionFindings')
              }
            }
          ]
        : []),
      ...(canViewField(currentFieldAccess.value, 'remediationDetails')
        ? [
            {
              label: '处理方式',
              key: 'handlingMethod',
              type: 'input',
              span: 24,
              props: {
                type: 'textarea',
                rows: 3,
                maxlength: 500,
                showWordLimit: true,
                disabled: !canEditField(currentFieldAccess.value, 'remediationDetails')
              }
            },
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
                disabled: !canEditField(currentFieldAccess.value, 'remediationDetails')
              }
            }
          ]
        : [])
    ]),
    rules: computed<FormRules<RoutineInspection>>(() => ({
      vehicleId: [{ required: true, message: '请选择车辆', trigger: 'change' }],
      routineInspectionNo: routineNumber.manualRequired(Boolean(form.data.id))
        ? [{ required: true, message: '请输入例检编号', trigger: 'blur' }]
        : [],
      inspectionType: [{ required: true, message: '请选择例检类型', trigger: 'change' }],
      inspectionTime: [{ required: true, message: '请选择例检时间', trigger: 'change' }],
      inspector: canEditField(currentFieldAccess.value, 'responsiblePeople')
        ? [{ required: true, message: '请输入检查人', trigger: 'blur' }]
        : [],
      checkResult: canEditField(currentFieldAccess.value, 'inspectionFindings')
        ? [{ required: true, message: '请选择检查结果', trigger: 'change' }]
        : []
    }))
  })

  const attachment: UnwrapNestedRefs<AttachmentGroup> = reactive<AttachmentGroup>({
    data: createInitialAttachmentForm(),
    items: computed<FormItem[]>(() => [
      { label: '附件名称', key: 'name', type: 'input', props: { maxlength: 100 } },
      { label: '上传文件', key: 'file' }
    ]),
    rules: computed<FormRules<AttachmentFormData>>(() => ({
      name: [{ required: true, message: '请输入附件名称', trigger: 'blur' }],
      file: [{ required: true, message: '请选择上传文件', trigger: 'change' }]
    }))
  })

  const vehicleSelectValue = computed({
    get: () => form.data.vehicleId ?? undefined,
    set: (value?: string | number) => {
      form.data.vehicleId = value ? String(value) : null
    }
  })

  const vehicleColumns: DataSelectColumn[] = [
    { prop: 'companyName', label: '所属公司', minWidth: 180 },
    { prop: 'plateNo', label: '车牌号', width: 140 },
    {
      prop: 'operationStatus',
      label: '运营状态',
      width: 120,
      dict: { code: 'vehicleOperationStatus', display: 'auto' }
    }
  ]

  const attachmentColumns: ColumnOption<Attachment>[] = [
    { type: 'globalIndex', label: '序号', width: 56 },
    { prop: 'name', label: '附件名称', minWidth: 180, link: attachmentTableLink },
    {
      prop: 'fileType',
      label: '格式类型',
      width: 110,
      dict: { code: 'FILE_EXTENSION_LABEL_MAP', display: 'text' }
    },
    { prop: 'fileSize', label: '附件大小', width: 110 },
    {
      prop: 'operation',
      label: '操作',
      width: 144,
      fixed: 'right',
      formatter: (row) => (
        <BusinessAttachmentRowActions
          file={row}
          removable={canEditField(currentFieldAccess.value, 'documents')}
          removeLabel="删除附件"
          onRemove={() => void removeAttachment(row)}
        />
      )
    }
  ]

  const handleVehicleChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const vehicle = rows[0] as VehicleArchive | undefined
    const targetTenantId = vehicle?.tenantId || tenantScopeStore.effectiveTenantId || undefined
    if (form.data.tenantId !== targetTenantId && (form.data.attachments?.length ?? 0) > 0) {
      form.data.attachments = []
      ElMessage.warning('车辆所属租户已变化，原有附件已清空，请重新上传')
    }
    form.data.tenantId = targetTenantId
    form.data.vehicleId = vehicle?.id ?? null
    form.data.plateNo = vehicle?.plateNo ?? ''
    form.data.companyName = vehicle?.companyName ?? ''
    form.data.driverId = null
    form.data.driverName = ''
  }

  const handleDriverChange = (driver: VmsDriverReference | null): void => {
    form.data.driverId = driver?.id ?? null
    form.data.driverName = driver?.driverName ?? ''
  }

  const replaceForm = (data: RoutineInspection): void => {
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

  const resetAttachmentForm = async (): Promise<void> => {
    Object.assign(attachment.data, createInitialAttachmentForm())
    await nextTick()
    attachmentFormRef.value?.clearValidate()
  }

  const openAttachmentDialog = async (): Promise<void> => {
    if (!canEditField(currentFieldAccess.value, 'documents')) return
    await resetAttachmentForm()
    await attachmentDialogRef.value?.handleOpen(undefined, {
      title: '上传例检附件',
      contentMaxHeight: '420px',
      onConfirm: handleAttachmentConfirm,
      onReset: () => void resetAttachmentForm()
    })
  }

  const handleAttachmentFileChange = (
    resources: Api.DataCenter.Resources.ResourceListItem[]
  ): void => {
    const resource = resources[0]
    if (!resource) return
    if (!resource.url) return
    const fileName = resource.originName || resource.objectName || '附件'
    attachment.data.file = resource.url
    attachment.data.fileName = fileName
    attachment.data.url = resource.url
    attachment.data.fileType = getFileExtension(fileName, resource.suffix)
    attachment.data.fileSize = resource.sizeInfo
    if (!attachment.data.name) attachment.data.name = fileName
    attachmentFormRef.value?.clearValidate()
    ElMessage.success('附件已选择')
  }

  const handleAttachmentConfirm = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(attachmentFormRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '附件校验未完成，请稍后重试', 'warning')
      return false
    }

    form.data.attachments = [
      ...(form.data.attachments ?? []),
      {
        name: attachment.data.name,
        url: attachment.data.url,
        fileType: attachment.data.fileType,
        fileSize: attachment.data.fileSize
      }
    ]
    return true
  }

  const removeAttachment = async (row: Attachment): Promise<void> => {
    try {
      await confirmAction(`确定删除附件“${row.name}”吗？`, '删除确认', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonType: 'danger'
      })
      form.data.attachments = (form.data.attachments ?? []).filter((item) => item.url !== row.url)
    } catch {
      // 用户取消删除时无需提示。
    }
  }

  const normalizePayload = (): RoutineInspection => {
    const payload = sanitizeVehicleRoutineInspectionPayload({ ...toRaw(form.data) })
    return {
      ...payload,
      vehicleId: payload.vehicleId || null,
      ...(payload.attachments ? { attachments: payload.attachments } : {})
    }
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
        await editVehicleRoutineInspection(payload)
      } else {
        await addVehicleRoutineInspection(payload)
      }
      emit('success', form.data.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '日常检查保存失败，请检查检查结果后重试')
      return false
    }
  }

  const handleOpen = async (row?: RoutineInspection): Promise<void> => {
    await resetForm()
    if (row?.id) replaceForm(row)

    await dialogRef.value?.handleOpen(row, {
      title: row?.id ? '编辑例检记录' : '新增例检记录',
      contentMaxHeight: '74vh',
      loading: true,
      loadingText: '正在加载编号规则…',
      onOpen: async (_openData, api) => {
        try {
          await routineNumber.loadRule()
        } finally {
          api.setLoading(false)
        }
      },
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
  .routine-inspection-dialog {
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

  .routine-attachment-dialog {
    &__upload {
      display: flex;
      gap: 12px;
      align-items: center;
      min-width: 0;
    }

    &__file {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      min-width: 0;
      color: var(--el-text-color-regular);

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
</style>
