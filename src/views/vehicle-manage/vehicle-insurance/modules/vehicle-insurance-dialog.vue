<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <template #subtitle
      >维护商业险与交强险保单、保费、有效期和附件，确保车辆保险资料完整。</template
    >

    <div class="vehicle-insurance-dialog">
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
      />

      <section v-if="canViewInsuranceField('documents')" class="vehicle-insurance-dialog__section">
        <div class="vehicle-insurance-dialog__section-header">
          <ArtSectionTitle :show-line="false">保险附件</ArtSectionTitle>
          <ArtUploadFile
            v-if="canEditInsuranceField('documents')"
            title="上传附件"
            :resource-tenant-id="form.data.tenantId || ''"
            :show-file-list="false"
            :show-tip="false"
            inline
            @resource-change="handleAttachmentUpload"
          />
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
</template>

<script setup lang="tsx">
  import BusinessAttachmentRowActions from '@/components/business/business-attachment-row-actions/index.vue'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import type { ComputedRef, UnwrapNestedRefs } from 'vue'
  import { cloneDeep } from 'lodash-es'
  import type { FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    addVehicleInsurance,
    editVehicleInsurance,
    fetchInsuranceCompanyOptions,
    fetchVehicleArchiveOptions
  } from '@vms/api'
  import { getFileExtension, removeAttachmentRow } from '@/utils/file'
  import { attachmentTableLink } from '@/components/core/media/art-file-viewer/table-link'
  import { canEditField, canViewField } from '@/utils/field-permission'
  import {
    EDITABLE_VEHICLE_INSURANCE_ACCESS,
    sanitizeVehicleInsurancePayload
  } from './vehicle-insurance-model'

  defineOptions({ name: 'VehicleInsuranceDialog' })

  const { confirmAction } = useArtFeedback()

  type VehicleInsurance = Api.Vms.VehicleManage.VehicleInsurance
  type VehicleOption = Api.Vms.VehicleManage.VehicleOption
  type InsuranceCompanyOption = Api.Vms.VehicleManage.InsuranceCompanyOption
  type Attachment = Api.Vms.VehicleManage.VehicleAttachment
  type InsuranceFieldKey = Api.Vms.VehicleManage.VehicleInsuranceFieldKey

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
    reloadOptions: (key?: string) => Promise<unknown>
  }

  interface FormGroup {
    data: VehicleInsurance
    items: ComputedRef<FormItem[]>
    rules: ComputedRef<FormRules<VehicleInsurance>>
    vehicleOptions: VehicleOption[]
    companyOptions: InsuranceCompanyOption[]
  }

  interface Emits {
    (e: 'success', type: 'add' | 'edit'): void
  }

  const emit = defineEmits<Emits>()
  const dialogRef = ref<ArtDialogExpose<VehicleInsurance | undefined>>()
  const formRef = ref<FormExpose>()

  const createInitialForm = (): VehicleInsurance => ({
    id: undefined,
    vehicleId: null,
    plateNo: '',
    companyName: '',
    commercialPolicyNo: '',
    commercialCompanyId: null,
    commercialCompanyName: '',
    commercialInsureDate: '',
    commercialPremium: null,
    commercialExpireDate: '',
    compulsoryPolicyNo: '',
    compulsoryCompanyId: null,
    compulsoryCompanyName: '',
    compulsoryInsureDate: '',
    compulsoryPremium: null,
    compulsoryExpireDate: '',
    remark: '',
    attachments: [],
    fieldAccess: { ...EDITABLE_VEHICLE_INSURANCE_ACCESS },
    isRecordOwner: false
  })

  const canViewInsuranceField = (field: InsuranceFieldKey): boolean =>
    !form.data.id || canViewField(form.data.fieldAccess, field)
  const canEditInsuranceField = (field: InsuranceFieldKey): boolean =>
    !form.data.id || canEditField(form.data.fieldAccess, field)

  const POLICY_FIELDS = new Set(['commercialPolicyNo', 'compulsoryPolicyNo'])
  const PREMIUM_FIELDS = new Set(['commercialPremium', 'compulsoryPremium'])

  const canDisplayFormItem = (item: FormItem): boolean => {
    const key = String(item.key)
    if (POLICY_FIELDS.has(key)) return canViewInsuranceField('policyNumbers')
    if (PREMIUM_FIELDS.has(key)) return canViewInsuranceField('premiumAmounts')
    return true
  }

  const getSensitiveFieldForFormItem = (item: FormItem): InsuranceFieldKey | null => {
    const key = String(item.key)
    if (POLICY_FIELDS.has(key)) return 'policyNumbers'
    if (PREMIUM_FIELDS.has(key)) return 'premiumAmounts'
    return null
  }

  const dateProps = {
    type: 'date',
    valueFormat: 'YYYY-MM-DD',
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
    vehicleOptions: [],
    companyOptions: [],
    items: computed<FormItem[]>(() => {
      const items: FormItem[] = [
        { label: '车辆信息', key: 'vehicleSection', type: 'divider', span: 24 },
        {
          label: '车牌号',
          key: 'vehicleId',
          type: 'select',
          api: fetchVehicleArchiveOptions,
          immediate: false,
          resultField: 'data',
          labelField: 'plateNo',
          valueField: 'id',
          afterFetch: syncVehicleOptions,
          props: {
            onChange: handleVehicleChange
          }
        },
        {
          label: '所属公司',
          key: 'companyName',
          type: 'input',
          props: {
            disabled: true,
            placeholder: '选择车辆后自动带出'
          }
        },
        { label: '商业险', key: 'commercialSection', type: 'divider', span: 24 },
        {
          label: '商业险保单号',
          key: 'commercialPolicyNo',
          type: 'input',
          props: { maxlength: 80 }
        },
        {
          label: '保险公司',
          key: 'commercialCompanyId',
          type: 'select',
          api: fetchInsuranceCompanyOptions,
          immediate: false,
          resultField: 'data',
          labelField: 'companyName',
          valueField: 'id',
          afterFetch: syncCompanyOptions,
          props: {
            onChange: (value?: string) => handleInsuranceCompanyChange(value, 'commercial')
          }
        },
        { label: '投保日期', key: 'commercialInsureDate', type: 'date', props: dateProps },
        { label: '投保金额', key: 'commercialPremium', type: 'number', props: moneyProps },
        { label: '到期日期', key: 'commercialExpireDate', type: 'date', props: dateProps },
        { label: '交强险', key: 'compulsorySection', type: 'divider', span: 24 },
        {
          label: '交强险保单号',
          key: 'compulsoryPolicyNo',
          type: 'input',
          props: { maxlength: 80 }
        },
        {
          label: '保险公司',
          key: 'compulsoryCompanyId',
          type: 'select',
          api: fetchInsuranceCompanyOptions,
          immediate: false,
          resultField: 'data',
          labelField: 'companyName',
          valueField: 'id',
          afterFetch: syncCompanyOptions,
          props: {
            onChange: (value?: string) => handleInsuranceCompanyChange(value, 'compulsory')
          }
        },
        { label: '投保日期', key: 'compulsoryInsureDate', type: 'date', props: dateProps },
        { label: '投保金额', key: 'compulsoryPremium', type: 'number', props: moneyProps },
        { label: '到期日期', key: 'compulsoryExpireDate', type: 'date', props: dateProps },
        {
          label: '备注',
          key: 'remark',
          type: 'input',
          span: 24,
          props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true }
        }
      ]
      return items.filter(canDisplayFormItem).map((item) => {
        const field = getSensitiveFieldForFormItem(item)
        if (!field || canEditInsuranceField(field)) return item
        return { ...item, props: { ...(item.props ?? {}), disabled: true } }
      })
    }),
    rules: computed<FormRules<VehicleInsurance>>(() => {
      const rules: FormRules<VehicleInsurance> = {
        vehicleId: [{ required: true, message: '请选择车辆', trigger: 'change' }],
        commercialPolicyNo: [{ required: true, message: '请输入商业险保单号', trigger: 'blur' }],
        commercialCompanyId: [
          { required: true, message: '请选择商业险保险公司', trigger: 'change' }
        ],
        commercialInsureDate: [
          { required: true, message: '请选择商业险投保日期', trigger: 'change' }
        ],
        commercialPremium: [{ required: true, message: '请输入商业险投保金额', trigger: 'blur' }],
        commercialExpireDate: [
          { required: true, message: '请选择商业险到期日期', trigger: 'change' }
        ],
        compulsoryPolicyNo: [{ required: true, message: '请输入交强险保单号', trigger: 'blur' }],
        compulsoryCompanyId: [
          { required: true, message: '请选择交强险保险公司', trigger: 'change' }
        ],
        compulsoryInsureDate: [
          { required: true, message: '请选择交强险投保日期', trigger: 'change' }
        ],
        compulsoryPremium: [{ required: true, message: '请输入交强险投保金额', trigger: 'blur' }],
        compulsoryExpireDate: [
          { required: true, message: '请选择交强险到期日期', trigger: 'change' }
        ]
      }
      if (!canEditInsuranceField('policyNumbers')) {
        delete rules.commercialPolicyNo
        delete rules.compulsoryPolicyNo
      }
      if (!canEditInsuranceField('premiumAmounts')) {
        delete rules.commercialPremium
        delete rules.compulsoryPremium
      }
      return rules
    })
  })

  const attachmentColumns = computed<ColumnOption<Attachment>[]>(() => [
    { type: 'globalIndex', label: '序号', width: 72 },
    { prop: 'name', label: '附件名称', minWidth: 220, link: attachmentTableLink },
    {
      prop: 'fileType',
      label: '格式类型',
      width: 120,
      dict: { code: 'FILE_EXTENSION_LABEL_MAP', display: 'text' }
    },
    { prop: 'fileSize', label: '附件大小', width: 120 },
    {
      prop: 'operation',
      label: '操作',
      width: canEditInsuranceField('documents') ? 144 : 104,
      fixed: 'right',
      formatter: (row) => (
        <BusinessAttachmentRowActions
          file={row}
          removable={canEditInsuranceField('documents')}
          removeLabel="移除附件"
          onRemove={() => void removeAttachment(row)}
        />
      )
    }
  ])

  const getResponseData = <TRecord,>(result: unknown): TRecord[] => {
    if (!result || typeof result !== 'object') return []
    const data = (result as { data?: TRecord[] }).data
    return Array.isArray(data) ? data : []
  }

  const syncVehicleOptions = (result: unknown): unknown => {
    form.vehicleOptions = getResponseData<VehicleOption>(result)
    return result
  }

  const syncCompanyOptions = (result: unknown): unknown => {
    form.companyOptions = getResponseData<InsuranceCompanyOption>(result)
    return result
  }

  const handleVehicleChange = (vehicleId?: string): void => {
    const vehicle = form.vehicleOptions.find((item) => item.id === vehicleId)
    form.data.vehicleId = vehicle?.id ?? null
    form.data.plateNo = vehicle?.plateNo ?? ''
    form.data.companyName = vehicle?.companyName ?? ''
  }

  const handleInsuranceCompanyChange = (
    companyId: string | undefined,
    type: 'commercial' | 'compulsory'
  ): void => {
    const company = form.companyOptions.find((item) => item.id === companyId)
    if (type === 'commercial') {
      form.data.commercialCompanyName = company?.companyName ?? ''
      return
    }
    form.data.compulsoryCompanyName = company?.companyName ?? ''
  }

  const replaceForm = (data: VehicleInsurance): void => {
    Object.assign(form.data, createInitialForm(), cloneDeep(toRaw(data)))
    form.data.attachments ??= []
  }

  const resetForm = async (): Promise<void> => {
    replaceForm(createInitialForm())
    await nextTick()
    formRef.value?.clearValidate()
  }

  const normalizePayload = (): VehicleInsurance => {
    const payload = sanitizeVehicleInsurancePayload(toRaw(form.data))
    return {
      ...payload,
      vehicleId: payload.vehicleId || null,
      commercialCompanyId: payload.commercialCompanyId || null,
      compulsoryCompanyId: payload.compulsoryCompanyId || null,
      attachments: payload.attachments ?? []
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
        await editVehicleInsurance(payload)
      } else {
        await addVehicleInsurance(payload)
      }
      emit('success', form.data.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '车辆保险保存失败，请检查保单信息和网络后重试')
      return false
    }
  }

  const handleOpen = async (row?: VehicleInsurance): Promise<void> => {
    await resetForm()
    if (row?.id) {
      replaceForm(row)
    }

    await dialogRef.value?.handleOpen(row, {
      title: row?.id ? '编辑车辆保险' : '新增车辆保险',
      contentMaxHeight: '72vh',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          await formRef.value?.reloadOptions()
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit,
      onReset: () => void resetForm()
    })
  }

  const handleAttachmentUpload = (resources: Api.DataCenter.Resources.ResourceListItem[]): void => {
    const resource = resources[0]
    if (!resource) return
    if (!resource.url) return
    if ((form.data.attachments ?? []).some((item) => item.url === resource.url)) {
      ElMessage.info('该附件已在当前记录中')
      return
    }
    const fileName = resource.originName || resource.objectName || '附件'
    form.data.attachments = [
      ...(form.data.attachments ?? []),
      {
        name: fileName,
        url: resource.url,
        fileType: getFileExtension(fileName, resource.suffix),
        fileSize: resource.sizeInfo
      }
    ]
    ElMessage.success('附件已添加')
  }

  const removeAttachment = async (row: Attachment): Promise<void> => {
    try {
      await confirmAction(`确定删除附件“${row.name}”吗？`, '删除确认', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonType: 'danger'
      })
      form.data.attachments = removeAttachmentRow(form.data.attachments ?? [], row)
    } catch {
      // 用户取消删除时无需提示。
    }
  }

  defineExpose({
    handleOpen,
    handleClose: () => dialogRef.value?.handleClose()
  })
</script>

<style scoped lang="scss">
  .vehicle-insurance-dialog {
    &__section {
      padding: 0 16px;
      margin-top: 8px;
    }

    &__section-header {
      display: flex;
      gap: var(--art-space-3);
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--art-space-3);

      :deep(.art-section-title) {
        width: auto;
        margin: 0;
      }
    }

    @media (width <= 680px) {
      &__section-header {
        flex-wrap: wrap;
        justify-content: flex-start;
      }
    }
  }
</style>
