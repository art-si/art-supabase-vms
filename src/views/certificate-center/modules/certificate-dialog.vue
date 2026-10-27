<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <template #subtitle>一类证件可登记多次。续证时保留原记录，便于追溯历史与到期处置。</template>

    <div class="min-w-0 px-1">
      <ArtForm
        ref="formRef"
        v-model="form"
        :items="formItems"
        :rules="formRules"
        :span="12"
        :gutter="20"
        label-width="120px"
        :show-reset="false"
        :show-submit="false"
      >
        <template #subjectId>
          <ArtTableSingleSelect
            :model-value="form.subjectId || undefined"
            :selected-data="selectedSubject ? [selectedSubject] : []"
            :api-fn="fetchSubjects"
            :columns="subjectColumns"
            row-key="id"
            label-key="label"
            :title="form.subjectType === 'vehicle' ? '选择车辆' : '选择司机'"
            search-placeholder="输入车牌号或司机姓名"
            empty-text="暂无可选档案"
            empty-description="请先完善对应的车辆或司机档案。"
            show-pagination
            :disabled="Boolean(recordId || form.renewalOfId || sourcePrefill)"
            @change="handleSubjectChange"
          />
        </template>
        <template #responsibleUserId>
          <ArtUserSelect
            v-model="form.responsibleUserId"
            :options="responsibleOptions"
            :loading="responsibleLoading"
            :disabled="!form.subjectId || responsibleLoading"
            placeholder="请选择证件责任人"
            no-data-text="该对象所属租户暂无可选责任人"
            class="w-full"
          />
        </template>
      </ArtForm>

      <section class="mt-3 min-w-0 px-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <ArtSectionTitle :show-line="false">证件附件</ArtSectionTitle>
            <p class="mt-1 text-sm text-[var(--art-gray-600)]">支持照片及 PDF，可上传多份证据。</p>
          </div>
          <ArtUploadFile
            v-if="form.subjectId && subjectTenantId"
            title="上传附件"
            :resource-tenant-id="subjectTenantId"
            :upload-request="uploadAttachment"
            :show-resource-picker="false"
            :show-file-list="false"
            :show-tip="false"
            :file-size="15 * 1024 * 1024"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            multiple
            :limit="20"
            inline
            @resource-change="handleAttachmentUpload"
          />
        </div>
        <ArtTable
          :data="form.attachments"
          :columns="attachmentColumns"
          :pagination="undefined"
          :show-table-header="false"
          empty-height="144px"
        />
      </section>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage, type FormRules } from 'element-plus'
  import { uniqBy } from 'lodash-es'
  import type { ColumnOption } from '@/types'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import type {
    DataSelectColumn,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import ArtUserSelect from '@/components/core/forms/art-user-select/index.vue'
  import type { ArtUserSelectOption } from '@/components/core/forms/art-user-select/types'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import BusinessAttachmentRowActions from '@/components/business/business-attachment-row-actions/index.vue'
  import { attachmentTableLink } from '@/components/core/media/art-file-viewer/table-link'
  import { getFileExtension, removeAttachmentRow } from '@/utils/file'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import type {
    CertificateAttachment,
    CertificateRecord,
    CertificateSubjectOption,
    CertificateSubjectType,
    CertificateWritePayload
  } from '../../../types/certificate'
  import {
    fetchCertificateResponsibleOptions,
    fetchCertificateSubjectOptions,
    saveCertificate,
    uploadCertificateAttachment
  } from '../../../api/providers/supabase/vehicle/certificates'
  import { CERTIFICATE_TYPE_OPTIONS, isLegacyCertificateRecord } from './certificate-policy'

  defineOptions({ name: 'VmsCertificateDialog' })

  const emit = defineEmits<{ success: [] }>()
  const { confirmAction } = useArtFeedback()
  const dialogRef = ref<ArtDialogExpose<CertificateRecord | undefined>>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const recordId = ref<string | null>(null)
  const sourcePrefill = ref(false)
  const subjectTenantId = ref('')
  const selectedSubject = ref<CertificateSubjectOption | null>(null)
  const responsibleOptions = ref<ArtUserSelectOption[]>([])
  const responsibleLoading = ref(false)
  let responsibleRequest = 0

  function emptyForm(): CertificateWritePayload {
    return {
      subjectType: 'vehicle',
      subjectId: '',
      certificateType: 'vehicle_registration',
      certificateNo: '',
      issueDate: null,
      validFrom: null,
      expiresOn: '',
      attachments: [],
      responsibleUserId: '',
      renewalOfId: null
    }
  }

  const form = reactive<CertificateWritePayload>(emptyForm())
  const subjectDictionaryOptions = useDictionaryOptions('vehicleCertificateSubjectType')
  const certificateDictionaryOptions = useDictionaryOptions('vehicleCertificateType')
  watch(
    () => form.subjectType,
    (type) => {
      form.subjectId = ''
      form.certificateType = CERTIFICATE_TYPE_OPTIONS[type][0].value
      form.responsibleUserId = ''
      form.attachments = []
      selectedSubject.value = null
      subjectTenantId.value = ''
      responsibleOptions.value = []
    },
    { flush: 'sync' }
  )
  const dateProps = { type: 'date', valueFormat: 'YYYY-MM-DD', class: '!w-full' }
  const subjectOptions = computed(() =>
    subjectDictionaryOptions.length
      ? subjectDictionaryOptions.filter(
          (option) => option.value === 'vehicle' || option.value === 'driver'
        )
      : [
          { label: '车辆', value: 'vehicle' },
          { label: '司机', value: 'driver' }
        ]
  )
  const certificateOptions = computed(() => {
    const allowed = CERTIFICATE_TYPE_OPTIONS[form.subjectType]
    const labels = new Map(
      certificateDictionaryOptions.map((option) => [option.value, option.label])
    )
    return allowed.map((option) => ({ ...option, label: labels.get(option.value) ?? option.label }))
  })
  const formItems = computed<FormItem[]>(() => [
    {
      label: '归属对象',
      key: 'subjectType',
      type: 'select',
      options: subjectOptions.value,
      span: 12,
      disabled: Boolean(recordId.value || form.renewalOfId || sourcePrefill.value)
    },
    { label: form.subjectType === 'vehicle' ? '车辆' : '司机', key: 'subjectId', span: 12 },
    { label: '证件信息', key: 'certificateSection', type: 'divider', span: 24 },
    {
      label: '证件类型',
      key: 'certificateType',
      type: 'select',
      options: certificateOptions.value,
      disabled: Boolean(recordId.value || form.renewalOfId || sourcePrefill.value),
      span: 12
    },
    {
      label: '证件编号',
      key: 'certificateNo',
      type: 'input',
      props: { maxlength: 100, showWordLimit: true },
      span: 12
    },
    { label: '发证日期', key: 'issueDate', type: 'date', props: dateProps, span: 8 },
    { label: '有效期开始', key: 'validFrom', type: 'date', props: dateProps, span: 8 },
    { label: '有效期截止', key: 'expiresOn', type: 'date', props: dateProps, span: 8 },
    { label: '证件责任人', key: 'responsibleUserId', span: 24 }
  ])
  const formRules: FormRules<CertificateWritePayload> = {
    subjectId: [{ required: true, message: '请选择车辆或司机', trigger: 'change' }],
    certificateType: [{ required: true, message: '请选择证件类型', trigger: 'change' }],
    certificateNo: [{ required: true, message: '请输入证件编号', trigger: 'blur' }],
    expiresOn: [{ required: true, message: '请选择有效期截止日', trigger: 'change' }],
    responsibleUserId: [{ required: true, message: '请选择证件责任人', trigger: 'change' }]
  }
  const subjectColumns: DataSelectColumn[] = [
    { prop: 'label', label: '车辆 / 司机', minWidth: 180 }
  ]
  const attachmentColumns: ColumnOption<CertificateAttachment>[] = [
    { type: 'globalIndex', label: '序号', width: 72 },
    { prop: 'name', label: '附件名称', minWidth: 220, link: attachmentTableLink },
    { prop: 'fileType', label: '格式', width: 90 },
    { prop: 'fileSize', label: '大小', width: 110 },
    {
      prop: 'operation',
      label: '操作',
      width: 100,
      fixed: 'right',
      formatter: (row) => (
        <BusinessAttachmentRowActions
          file={row}
          removable
          removeLabel="移除附件"
          onRemove={() => void removeAttachment(row)}
        />
      )
    }
  ]

  async function fetchSubjects(params: { keyword?: string; page?: number; pageSize?: number }) {
    const page = Math.max(params.page ?? 1, 1)
    const size = params.pageSize ?? 10
    return await fetchCertificateSubjectOptions(
      form.subjectType,
      params.keyword,
      (page - 1) * size,
      page * size - 1
    )
  }

  function handleSubjectChange(_value: unknown, rows: DataSelectRecord[]): void {
    const option = rows[0] as CertificateSubjectOption | undefined
    selectedSubject.value = option ?? null
    form.subjectId = option?.id ?? ''
    subjectTenantId.value = option?.tenantId ?? ''
    form.responsibleUserId = ''
    form.attachments = []
    responsibleOptions.value = []
    if (option) void loadResponsibleOptions(form.subjectType, option.id)
  }

  async function loadResponsibleOptions(type: CertificateSubjectType, id: string): Promise<void> {
    const request = ++responsibleRequest
    responsibleLoading.value = true
    try {
      const result = await fetchCertificateResponsibleOptions(type, id)
      if (request !== responsibleRequest) return
      responsibleOptions.value = (result.data ?? []).map((user) => ({
        value: user.id,
        label: user.nickName || user.userName || user.userEmail || '未命名用户',
        userName: user.userName,
        nickName: user.nickName,
        userEmail: user.userEmail,
        avatar: user.avatar
      }))
    } catch (error) {
      if (request === responsibleRequest)
        notifyFriendlyError(error, '责任人加载失败，请重新选择对象后重试')
    } finally {
      if (request === responsibleRequest) responsibleLoading.value = false
    }
  }

  function handleAttachmentUpload(resources: Api.DataCenter.Resources.ResourceListItem[]): void {
    const attachments = resources.flatMap((resource): CertificateAttachment[] => {
      if (!resource.url) return []
      const name = resource.originName || resource.objectName || '证件附件'
      return [
        {
          name,
          url: resource.url,
          fileType: getFileExtension(name, resource.suffix),
          fileSize: resource.sizeInfo
        }
      ]
    })
    if (!attachments.length) return
    const additions = uniqBy(attachments, 'url').filter(
      (item) => !form.attachments.some((existing) => existing.url === item.url)
    )
    if (!additions.length) {
      ElMessage.info('所选附件已在当前记录中')
      return
    }
    form.attachments = [...form.attachments, ...additions]
    ElMessage.success(`已添加 ${additions.length} 份附件`)
  }

  const uploadAttachment = (file: File) => uploadCertificateAttachment(file, subjectTenantId.value)

  async function removeAttachment(row: CertificateAttachment): Promise<void> {
    try {
      await confirmAction(`确定移除附件“${row.name}”吗？`, '移除附件', {
        confirmButtonText: '移除',
        cancelButtonText: '取消',
        type: 'warning'
      })
      form.attachments = removeAttachmentRow(form.attachments, row)
    } catch {
      // 用户取消操作。
    }
  }

  async function submit(): Promise<boolean> {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (form.validFrom && form.expiresOn < form.validFrom) {
        ElMessage.warning('有效期截止日不能早于开始日')
        return false
      }
      if (form.issueDate && form.expiresOn < form.issueDate) {
        ElMessage.warning('有效期截止日不能早于发证日期')
        return false
      }
      await saveCertificate(recordId.value, {
        ...form,
        certificateNo: form.certificateNo.trim(),
        attachments: [...form.attachments]
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '证件保存失败，请核对信息后重试')
      return false
    }
  }

  async function handleOpen(row?: CertificateRecord, renewal = false): Promise<void> {
    Object.assign(form, emptyForm())
    sourcePrefill.value = Boolean(row && isLegacyCertificateRecord(row))
    recordId.value = renewal || sourcePrefill.value ? null : (row?.id ?? null)
    selectedSubject.value = null
    subjectTenantId.value = ''
    responsibleOptions.value = []
    if (row) {
      const createFromLegacy = sourcePrefill.value
      Object.assign(form, {
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        certificateType: row.certificateType,
        certificateNo: renewal || createFromLegacy ? '' : row.certificateNo,
        issueDate: renewal || createFromLegacy ? null : row.issueDate,
        validFrom: renewal || createFromLegacy ? null : row.validFrom,
        expiresOn: renewal || createFromLegacy ? '' : row.expiresOn,
        attachments: renewal || createFromLegacy ? [] : [...row.attachments],
        responsibleUserId: createFromLegacy ? '' : row.responsibleUserId,
        renewalOfId:
          renewal && !createFromLegacy ? row.id : createFromLegacy ? null : row.renewalOfId
      })
      selectedSubject.value = { id: row.subjectId, label: row.subjectLabel, tenantId: row.tenantId }
      subjectTenantId.value = row.tenantId
      await loadResponsibleOptions(row.subjectType, row.subjectId)
    }
    await dialogRef.value?.handleOpen(row, {
      title: sourcePrefill.value
        ? '从旧台账登记新证件'
        : renewal
          ? '登记续证'
          : row
            ? '编辑证件'
            : '新增证件',
      contentMaxHeight: '72vh',
      onConfirm: submit
    })
  }

  defineExpose({ handleOpen })
</script>
