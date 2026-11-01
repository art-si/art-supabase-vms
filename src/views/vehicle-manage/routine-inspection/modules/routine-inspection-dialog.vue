<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <template #subtitle
      >记录检查类型、人员、检查结果和处置方式，形成可复核的车辆安全检查记录。</template
    >

    <div class="routine-inspection-dialog">
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
        <template #driverId>
          <VmsDriverSelect
            :model-value="form.data.driverId"
            :vehicle-id="form.data.vehicleId"
            :driver-name="form.data.driverName"
            :disabled="!canEditField(currentFieldAccess, 'responsiblePeople')"
            @change="handleDriverChange"
          />
        </template>
        <template #inspectionAttachments>
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
            <VehicleAttachmentTable
              :attachments="form.data.attachments ?? []"
              :name-min-width="180"
              :removable="canEditField(currentFieldAccess, 'documents')"
              @remove="removeAttachment"
            />
          </section>
        </template>
      </ArtForm>
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
      >
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { h } from 'vue'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { useDraftAttachmentRemoval } from '@/hooks/core/useDraftAttachmentRemoval'
  import type { ComputedRef, UnwrapNestedRefs } from 'vue'
  import { cloneDeep } from 'lodash-es'
  import type { FormRules } from 'element-plus'
  import { ElButton, ElMessage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import VehicleDataSourceEmptyActions from '../../../components/vehicle-data-source-empty-actions.vue'
  import VmsDriverSelect from '../../../components/vms-driver-select.vue'
  import type { VmsDriverReference } from '@vms/api'
  import type {
    DataSelectColumn,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'

  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import {
    addVehicleRoutineInspection,
    editVehicleRoutineInspection,
    fetchApprovedVehicleSelectData
  } from '@vms/api'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { canEditField, canViewField } from '@/utils/field-permission'
  import {
    EDITABLE_VEHICLE_ROUTINE_INSPECTION_ACCESS,
    sanitizeVehicleRoutineInspectionPayload
  } from './routine-inspection-model'
  import {
    createInitialAttachmentForm,
    useVehicleAttachmentDialog,
    type VehicleAttachmentFormData as AttachmentFormData,
    type VehicleAttachmentGroup as AttachmentGroup,
    type VehicleFormExpose as FormExpose
  } from '../../vehicle-attachment-dialog'
  import VehicleAttachmentTable from '../../vehicle-attachment-table.vue'

  defineOptions({ name: 'RoutineInspectionDialog' })

  type RoutineInspection = Api.Vms.VehicleManage.VehicleRoutineInspectionRecord
  type VehicleArchive = Api.Vms.ArchiveManage.VehicleArchive

  interface FormGroup {
    data: RoutineInspection
    items: ComputedRef<FormItem[]>
    rules: ComputedRef<FormRules<RoutineInspection>>
    vehicleSelection: VehicleArchive[]
  }

  interface Emits {
    (e: 'success', type: 'add' | 'edit'): void
  }

  const emit = defineEmits<Emits>()
  const inspectionTypeOptions = useDictionaryOptions('vehicleRoutineInspectionType')
  const inspectionResultOptions = useDictionaryOptions('vehicleRoutineInspectionResult')
  const activeTab = ref('baseSection')
  const dialogRef = ref<ArtDialogExpose<RoutineInspection | undefined>>()
  const attachmentDialogRef = ref<ArtDialogExpose<void>>()
  const formRef = ref<FormExpose>()
  const routineNumber = useDocumentNumberRule('vehicle.routine_inspection')
  const tenantScopeStore = useTenantScopeStore()
  const attachmentFormRef = ref<FormExpose>()
  const currentFieldAccess = computed(() =>
    form.data.id ? (form.data.fieldAccess ?? {}) : EDITABLE_VEHICLE_ROUTINE_INSPECTION_ACCESS
  )
  const hasFindingsWorkspace = computed(
    () =>
      canViewField(currentFieldAccess.value, 'documents') ||
      (canViewField(currentFieldAccess.value, 'inspectionFindings') &&
        canViewField(currentFieldAccess.value, 'remediationDetails'))
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

  const dateTimeProps = {
    type: 'datetime',
    valueFormat: 'YYYY-MM-DD HH:mm:ss',
    class: '!w-full'
  }

  const form: UnwrapNestedRefs<FormGroup> = reactive<FormGroup>({
    data: createInitialForm(),
    vehicleSelection: [],
    items: computed<FormItem[]>(() => [
      ...(hasFindingsWorkspace.value
        ? [{ label: '检查信息', key: 'baseSection', type: 'tab', span: 24 } satisfies FormItem]
        : []),
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
      ...(hasFindingsWorkspace.value
        ? [{ label: '检查结果与证据', key: 'findingsSection', type: 'tab' } satisfies FormItem]
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
        : []),
      { key: 'inspectionAttachments', label: '', type: 'slot', span: 24 }
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
      {
        label: '上传文件',
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
            <div class="routine-attachment-dialog__file">
              <span>{attachment.data.fileName}</span>
              {attachment.data.url ? <ArtSvgIcon icon="ri:check-line" /> : null}
            </div>
          ) : null
      }
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

  const { resetAttachmentForm, handleAttachmentFileChange, handleAttachmentConfirm } =
    useVehicleAttachmentDialog(form, attachment, attachmentFormRef)

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

  const removeAttachment = useDraftAttachmentRemoval<Api.Vms.VehicleManage.VehicleAttachment>({
    getAttachments: () => form.data.attachments,
    setAttachments: (rows) => {
      form.data.attachments = rows
    },
    canRemove: () => canEditField(currentFieldAccess.value, 'documents'),
    getContext: () => [form.data.id, form.data.tenantId, form.data.vehicleId]
  })

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
    activeTab.value = 'baseSection'
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
