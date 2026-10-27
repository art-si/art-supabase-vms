<template>
  <ArtPageShell
    class="vehicle-archive-edit"
    :loading="page.loading"
    loading-mode="skeleton"
    :error="page.error"
    full-height
    @retry="initializePage"
  >
    <ArtPageHeader
      class="vehicle-archive-edit__header"
      :title="isEdit ? '编辑车辆档案' : isCopy ? '复制车辆档案' : '新增车辆档案'"
      :subtitle="pageSubtitle"
      show-back
      @back="goBack"
    />

    <div ref="pageRef" class="vehicle-archive-edit__content">
      <ElTabs v-model="page.activeTab" class="vehicle-archive-edit__tabs art-card-xs">
        <ElTabPane v-if="hasAuth('VehicleArchive:TabBasic')" label="基础信息" name="basic">
          <div class="vehicle-archive-edit__vehicle-photo">
            <ArtUploadImage
              v-model="form.vehiclePhotoUrl"
              :resource-tenant-id="form.tenantId"
              title="车辆图片"
              :size="120"
              :limit="1"
              :readonly="!form.tenantId || !hasAuth(savePermission)"
            />
            <div>
              <strong>车辆图片</strong>
              <p>上传车辆外观照片，便于调度和车管快速识别。</p>
            </div>
          </div>
          <ArtForm
            ref="basicFormRef"
            :model-value="form"
            @update:model-value="replaceReactiveModel(form, $event)"
            :items="basicItems"
            :rules="rules"
            :span="8"
            :gutter="20"
            label-width="130px"
            :show-reset="false"
            :show-submit="false"
          >
            <template #vehicleType>
              <ElButton
                class="vehicle-archive-edit__type-trigger"
                :class="{ 'is-selected': Boolean(form.vehicleTypeProfileId) }"
                :disabled="page.saving || !hasAuth(savePermission)"
                @click="openVehicleTypePicker"
              >
                <ArtSvgIcon icon="ri:truck-line" aria-hidden="true" />
                <span class="vehicle-archive-edit__type-value">
                  {{
                    form.vehicleTypeProfileId
                      ? `${form.vehicleType} · ${form.specLengthM ?? form.loadTons}${form.specLengthM == null ? ' 吨' : ' 米'}`
                      : '请选择车型与规格'
                  }}
                </span>
                <span class="vehicle-archive-edit__type-action">参选</span>
                <ArtSvgIcon icon="ri:arrow-right-s-line" aria-hidden="true" />
              </ElButton>
            </template>
          </ArtForm>

          <div class="vehicle-archive-edit__trailer-field">
            <div>
              <strong>默认挂车</strong>
              <p>可从挂车档案参选；牵引车与挂车的默认关系会同步更新。</p>
            </div>
            <div class="vehicle-archive-edit__trailer-actions">
              <ArtTableSingleSelect
                v-model="defaultTrailerId"
                v-model:selected-data="defaultTrailerSelection"
                :api-fn="fetchDefaultTrailerOptions"
                :columns="defaultTrailerColumns"
                row-key="id"
                label-key="plateNo"
                description-key="trailerType"
                title="参选默认挂车"
                search-placeholder="输入挂车车牌号"
                placeholder="请选择默认挂车"
                :disabled="
                  !isEdit || page.saving || trailerSaving || !hasAuth('VehicleArchive:Edit')
                "
                clearable
                show-pagination
                @change="handleDefaultTrailerChange"
              />
              <span v-if="!isEdit">先保存车辆档案后参选</span>
              <ElButton v-if="defaultTrailerError" link type="primary" @click="loadDefaultTrailer"
                >加载失败，重试</ElButton
              >
            </div>
          </div>

          <section
            v-if="canViewArchiveField('documents')"
            class="vehicle-archive-edit__section vehicle-archive-edit__certificate-panel"
          >
            <header class="vehicle-archive-edit__certificate-heading">
              <div>
                <ArtSectionTitle :show-line="false">车辆证件影像</ArtSectionTitle>
                <p>证照影像私有存储，仅授权人员可预览、替换和删除</p>
              </div>
              <span>{{ certificateFilledCount }}/{{ visibleCertificateItems.length }} 已完成</span>
            </header>
            <div
              class="vehicle-archive-edit__image-switch"
              role="tablist"
              aria-label="车辆证件影像"
            >
              <button
                v-for="item in visibleCertificateItems"
                :key="item.key"
                type="button"
                role="tab"
                :aria-selected="activeImageKey === item.key"
                :class="{ 'is-current': activeImageKey === item.key }"
                @click="activeImageKey = item.key"
              >
                {{ item.label }}<span v-if="form[item.key]" aria-label="已上传">✓</span>
              </button>
            </div>
            <div class="vehicle-archive-edit__images">
              <div
                v-for="item in visibleCertificateItems.filter(
                  (candidate) => candidate.key === activeImageKey
                )"
                :key="item.key"
                class="vehicle-archive-edit__certificate-item"
              >
                <ArtUploadImage
                  v-model="form[item.key]"
                  :resource-tenant-id="documentTenantId"
                  :upload-request="uploadVehicleDocument"
                  :show-resource-picker="false"
                  :file-size="15 * 1024 * 1024"
                  file-type=".jpg,.jpeg,.png,.webp"
                  :title="item.label"
                  :size="120"
                  :limit="1"
                  :readonly="
                    !documentTenantId ||
                    (item.key !== 'vehiclePhotoUrl' && !canEditArchiveField('documents'))
                  "
                />
                <div
                  v-if="item.key === 'drivingLicenseFrontUrl' || item.key === 'operationLicenseUrl'"
                  class="flex flex-wrap gap-2"
                >
                  <ElButton
                    v-auth="'VehicleArchive:Ocr'"
                    size="small"
                    plain
                    :loading="ocrBusyKey === item.key && ocrMode === 'ai'"
                    :disabled="!form[item.key] || ocrBusyKey !== null"
                    @click="recognizeCertificate(item.key)"
                  >
                    智能识别
                  </ElButton>
                  <ElButton
                    v-auth="'VehicleArchive:Ocr'"
                    size="small"
                    plain
                    :loading="ocrBusyKey === item.key && ocrMode === 'local'"
                    :disabled="!form[item.key] || ocrBusyKey !== null"
                    @click="recognizeCertificateLocally(item.key)"
                  >
                    本地识别
                  </ElButton>
                </div>
              </div>
            </div>
            <ElAlert
              v-if="ocrError"
              class="mt-3"
              type="error"
              :title="ocrError"
              show-icon
              @close="ocrError = ''"
            />
          </section>
        </ElTabPane>

        <ElTabPane v-if="hasAuth('VehicleArchive:TabBody')" label="车身参数" name="body">
          <ArtForm
            ref="bodyFormRef"
            :model-value="form"
            @update:model-value="replaceReactiveModel(form, $event)"
            :items="bodyItems"
            :rules="rules"
            :span="8"
            :gutter="20"
            label-width="130px"
            :show-reset="false"
            :show-submit="false"
          />
        </ElTabPane>

        <ElTabPane v-if="hasAuth('VehicleArchive:TabEngine')" label="发动机参数" name="engine">
          <ArtForm
            ref="engineFormRef"
            :model-value="form"
            @update:model-value="replaceReactiveModel(form, $event)"
            :items="engineItems"
            :rules="rules"
            :span="8"
            :gutter="20"
            label-width="130px"
            :show-reset="false"
            :show-submit="false"
          />
        </ElTabPane>

        <ElTabPane v-if="hasAuth('VehicleArchive:TabOther')" label="其他信息" name="other">
          <ArtForm
            ref="otherFormRef"
            :model-value="form"
            @update:model-value="replaceReactiveModel(form, $event)"
            :items="otherItems"
            :rules="rules"
            :span="8"
            :gutter="20"
            label-width="130px"
            :show-reset="false"
            :show-submit="false"
          />

          <section v-if="canViewArchiveField('documents')" class="vehicle-archive-edit__section">
            <div class="vehicle-archive-edit__section-header">
              <ArtSectionTitle class="vehicle-archive-edit__section-title" :show-line="false">
                车辆档案附件
              </ArtSectionTitle>
              <ArtUploadFile
                title="上传附件"
                :resource-tenant-id="documentTenantId"
                :upload-request="uploadVehicleDocument"
                :show-resource-picker="false"
                :file-size="15 * 1024 * 1024"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                :disabled="!documentTenantId || !canManageArchiveAttachments"
                :show-file-list="false"
                :show-tip="false"
                inline
                @resource-change="handleAttachmentUpload"
              />
            </div>
            <ArtTable
              :data="form.attachments"
              :columns="attachmentColumns"
              :pagination="undefined"
              :show-table-header="false"
              empty-height="180px"
            />
          </section>
        </ElTabPane>
        <ElTabPane v-if="hasAuth('VehicleArchive:TabTypes')" label="车型" name="types" lazy>
          <VehicleTypeTab />
        </ElTabPane>
      </ElTabs>
      <ArtEmptyState
        v-if="!availableTabNames.length"
        title="暂无可访问的页签"
        description="请联系管理员在角色权限中授权车辆档案页签。"
      />
    </div>

    <ArtStickyActionBar
      v-if="availableTabNames.length && page.activeTab !== 'types'"
      class="vehicle-archive-edit__footer"
      hint="带 * 的信息为必填项；提交前请确认车辆、证件与运营信息完整。"
    >
      <ElButton :disabled="page.saving" @click="goBack">取消</ElButton>
      <ElButton
        v-auth="savePermission"
        :type="canSubmitForApproval ? undefined : 'primary'"
        :loading="page.saving"
        @click="handleSave(false)"
      >
        {{ isEdit ? '保存资料' : '保存草稿' }}
      </ElButton>
      <ElButton
        v-if="canSubmitForApproval"
        v-auth="'VehicleArchive:Submit'"
        type="primary"
        :loading="page.saving"
        @click="handleSave(true)"
      >
        {{ originalAuditStatus === 'rejected' ? '保存并重新提交' : '保存并提交审核' }}
      </ElButton>
    </ArtStickyActionBar>
    <VehicleTypePicker ref="vehicleTypePickerRef" @selected="handleVehicleTypeSelected" />
    <ArtDialog ref="ocrReviewDialogRef" size="lg">
      <div class="vehicle-archive-edit__ocr-review">
        <p>{{ ocrResult?.summary }}</p>
        <ElAlert
          v-if="ocrResult?.warnings.length"
          type="warning"
          :title="ocrResult.warnings.join('；')"
          show-icon
          :closable="false"
        />
        <OcrOriginalText
          :text="ocrResult?.rawText"
          description="原始文字供人工核对；只有点击填入才会修改车辆表单。"
          :rows="5"
        />
        <ArtTable
          :data="ocrReviewRows"
          :columns="ocrReviewColumns"
          :pagination="false"
          :show-table-header="false"
          empty-text="没有可自动填入的可靠字段，请对照原图手工填写"
          :height="Math.min(56 + ocrReviewRows.length * 44, 460)"
          empty-height="140px"
        />
        <p class="vehicle-archive-edit__ocr-note">
          识别结果需人工核对。车型需参选具体规格，经营范围仅在匹配现有选项时填入；已填写字段默认保留。
          <template v-if="ocrDocumentType === 'operation_license'">
            运输证核发日期不会覆盖行驶证发证日期。
          </template>
        </p>
      </div>
      <template #footer>
        <div class="vehicle-archive-edit__ocr-actions">
          <ElCheckbox v-if="canApplyOcrResult" v-model="ocrReplaceExisting">
            覆盖已填写字段
          </ElCheckbox>
          <span v-else>{{ ocrApplyRestrictionMessage }}</span>
          <ElButton @click="ocrReviewDialogRef?.handleClose()">关闭</ElButton>
          <ElButton
            v-if="canApplyOcrResult"
            type="primary"
            :disabled="!ocrReviewRows.length"
            @click="applyOcrResult"
          >
            填入表单
          </ElButton>
        </div>
      </template>
    </ArtDialog>
  </ArtPageShell>
</template>

<script setup lang="tsx">
  import BusinessAttachmentRowActions from '@/components/business/business-attachment-row-actions/index.vue'
  import { replaceReactiveModel } from '@/utils/form/model'
  import { focusFirstInvalidFormField } from '@/utils/form/validation'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import type { ComputedRef, Ref, UnwrapNestedRefs } from 'vue'
  import type { FormRules } from 'element-plus'
  import { ElAlert, ElButton, ElCheckbox, ElMessage, ElTabPane, ElTabs } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import OcrOriginalText from '@/components/business/ocr-original-text/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    addVehicleArchive,
    analyzeVehicleDocumentByAi,
    analyzeVehicleDocumentLocally,
    editVehicleArchive,
    fetchDefaultTrailer,
    fetchTrailerOptions,
    setDefaultTrailer,
    fetchCarrierOptions,
    fetchDriverOptions,
    fetchVehicleArchiveDetail,
    submitVehicleArchiveForApproval,
    uploadVehiclePrivateDocument,
    type VmsCarrierReference,
    type VmsDriverReference,
    type VehicleDocumentOcrType,
    type VehicleDocumentOcrResult,
    type TrailerOption
  } from '@vms/api'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useAuth } from '@/hooks/core/useAuth'
  import { getFileExtension, removeAttachmentRow } from '@/utils/file'
  import { attachmentTableLink } from '@/components/core/media/art-file-viewer/table-link'
  import { canEditField, canViewField } from '@/utils/field-permission'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import { formatVehicleAge } from './modules/vehicle-age'
  import {
    createInitialVehicleArchiveForm,
    requiresVehicleArchiveResubmission,
    sanitizeVehicleArchivePayload,
    type VehicleArchive,
    type VehicleArchiveForm
  } from './modules/vehicle-archive-model'
  import VehicleTypeTab from './modules/vehicle-type-tab.vue'
  import VehicleTypePicker from './modules/vehicle-type-picker.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import type {
    DataSelectColumn,
    DataSelectFetchParams
  } from '@/components/core/forms/art-data-select/types'
  import type { VehicleTypeProfile } from './modules/vehicle-type-catalog'

  defineOptions({ name: 'VehicleArchiveEdit' })

  const { confirmAction } = useArtFeedback()

  type ArchiveAttachment = Api.Vms.ArchiveManage.VehicleArchiveAttachment
  type CarrierOption = VmsCarrierReference
  type DriverOption = VmsDriverReference
  type ArchiveTabName = 'basic' | 'body' | 'engine' | 'other' | 'types'
  type BooleanDictOption = Omit<Api.DataCenter.DictListItem, 'value'> & { value: boolean }
  type ImageKey =
    | 'vehiclePhotoUrl'
    | 'drivingLicenseFrontUrl'
    | 'drivingLicenseBackUrl'
    | 'drivingLicenseBackReverseUrl'
    | 'personVehiclePhotoUrl'
    | 'vehicleHeadPhotoUrl'
    | 'operationLicenseUrl'

  const originalAuditStatus = ref<VehicleArchive['auditStatus']>()
  const shouldResubmit = computed(
    () => isEdit.value && requiresVehicleArchiveResubmission(originalAuditStatus.value)
  )
  const canSubmitForApproval = computed(
    () =>
      hasAuth('VehicleArchive:Submit') &&
      hasAuth(savePermission.value) &&
      (!isEdit.value || originalAuditStatus.value === 'draft' || shouldResubmit.value)
  )
  const pageSubtitle = computed(() =>
    shouldResubmit.value
      ? '修正驳回问题；可先保存资料，再明确提交审批'
      : isEdit.value
        ? originalAuditStatus.value === 'draft'
          ? '档案已建立，继续完善车辆、证照与运营资料后提交审核'
          : '维护车辆基础资料、车身参数、发动机参数和运营信息'
        : '填写车辆资料，可保存草稿或提交审核'
  )

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
    reloadOptions: (key?: string) => Promise<unknown>
  }

  interface PageGroup {
    activeTab: ArchiveTabName
    loading: boolean
    saving: boolean
    error: Error | null
  }

  interface FormTab {
    name: ArchiveTabName
    formRef: Readonly<Ref<FormExpose | undefined>>
  }

  interface OptionGroup {
    vehicleOwnership: ComputedRef<Api.DataCenter.DictListItem[]>
    originType: ComputedRef<Api.DataCenter.DictListItem[]>
    color: ComputedRef<Api.DataCenter.DictListItem[]>
    plateColor: ComputedRef<Api.DataCenter.DictListItem[]>
    businessType: ComputedRef<Api.DataCenter.DictListItem[]>
    usageNature: ComputedRef<Api.DataCenter.DictListItem[]>
    operationStatus: ComputedRef<Api.DataCenter.DictListItem[]>
    purchaseStatus: ComputedRef<Api.DataCenter.DictListItem[]>
    vehicleLevel: ComputedRef<Api.DataCenter.DictListItem[]>
    fuelType: ComputedRef<Api.DataCenter.DictListItem[]>
    emissionStandard: ComputedRef<Api.DataCenter.DictListItem[]>
    transportIndustry: ComputedRef<Api.DataCenter.DictListItem[]>
    operationType: ComputedRef<Api.DataCenter.DictListItem[]>
    gender: ComputedRef<Api.DataCenter.DictListItem[]>
    boolean: ComputedRef<BooleanDictOption[]>
  }

  const route = useRoute()
  const router = useRouter()
  const { hasAuth } = useAuth()
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { getDictMap } = storeToRefs(userStore)
  const page = reactive<PageGroup>({
    activeTab: 'basic',
    loading: false,
    saving: false,
    error: null
  })
  const pageRef = ref<HTMLElement>()
  const basicFormRef = ref<FormExpose>()
  const bodyFormRef = ref<FormExpose>()
  const engineFormRef = ref<FormExpose>()
  const otherFormRef = ref<FormExpose>()
  const vehicleTypePickerRef = ref<{
    handleOpen: (data: {
      vehicleId?: string
      carrierId?: string
      tenantId?: string
      selectedId?: string | null
    }) => Promise<void>
  }>()
  const defaultTrailer = shallowRef<TrailerOption | null>(null)
  const defaultTrailerError = ref(false)
  const trailerSaving = ref(false)
  const defaultTrailerId = ref<string>()
  const defaultTrailerSelection = ref<TrailerOption[]>([])
  const defaultTrailerColumns: DataSelectColumn<TrailerOption>[] = [
    { prop: 'plateNo', label: '车牌号', width: 150 },
    {
      prop: 'plateColor',
      label: '车牌颜色',
      width: 110,
      dict: { code: 'vehiclePlateColor', display: 'auto' }
    },
    { prop: 'trailerType', label: '挂车类型', minWidth: 170 }
  ]
  const ocrReviewDialogRef = ref<ArtDialogExpose<VehicleDocumentOcrResult>>()
  const ocrResult = ref<VehicleDocumentOcrResult | null>(null)
  const ocrError = ref('')
  const ocrDocumentType = ref<VehicleDocumentOcrType>('driving_license')
  const ocrBusyKey = ref<ImageKey | null>(null)
  const ocrMode = ref<'ai' | 'local' | null>(null)
  const activeImageKey = ref<ImageKey>('drivingLicenseFrontUrl')
  const submitIntent = ref(false)
  const ocrReplaceExisting = ref(false)
  const formTabs: FormTab[] = [
    { name: 'basic', formRef: basicFormRef },
    { name: 'body', formRef: bodyFormRef },
    { name: 'engine', formRef: engineFormRef },
    { name: 'other', formRef: otherFormRef }
  ]
  const tabPermissions: Record<ArchiveTabName, string> = {
    basic: 'VehicleArchive:TabBasic',
    body: 'VehicleArchive:TabBody',
    engine: 'VehicleArchive:TabEngine',
    other: 'VehicleArchive:TabOther',
    types: 'VehicleArchive:TabTypes'
  }
  const availableTabNames = computed<ArchiveTabName[]>(() =>
    (Object.keys(tabPermissions) as ArchiveTabName[]).filter((name) =>
      hasAuth(tabPermissions[name])
    )
  )
  watch(
    availableTabNames,
    (names) => {
      if (!names.includes(page.activeTab)) page.activeTab = names[0] ?? 'basic'
    },
    { immediate: true }
  )
  const driverCache = ref(new Map<string, DriverOption>())

  const isEdit = computed(() => typeof route.params.id === 'string' && route.params.id.length > 0)
  const isCopy = computed(() => !isEdit.value && typeof route.query.copyFrom === 'string')
  const savePermission = computed(() =>
    isEdit.value ? 'VehicleArchive:Edit' : 'VehicleArchive:Add'
  )
  // 普通用户只可用识别结果新建档案；AI 辅助修改已有档案由服务端限定为平台超管。
  const canApplyOcrResult = computed(
    () =>
      hasAuth('VehicleArchive:Ocr') &&
      hasAuth(savePermission.value) &&
      (!isEdit.value || userStore.isPlatformSuper)
  )
  const ocrApplyRestrictionMessage = computed(() =>
    isEdit.value && !userStore.isPlatformSuper
      ? '当前账号可查看识别结果；用识别结果修改已有车辆档案需平台超级管理员。'
      : `当前账号可查看识别结果；填入表单需车辆档案${isEdit.value ? '编辑' : '新增'}权限。`
  )
  const selectedPrimaryDriverOptions = computed<FormItemOption[]>(() => {
    const driver = getSelectedPrimaryDriver()
    return driver ? [createDriverOption(driver)] : []
  })
  const selectedSecondaryDriverOptions = computed<FormItemOption[]>(() =>
    getSelectedBackupDrivers().map(createDriverOption)
  )

  const options: UnwrapNestedRefs<OptionGroup> = reactive<OptionGroup>({
    vehicleOwnership: computed(() =>
      (getDictMap.value.vehicleOwnership ?? []).map((item) => ({
        ...item,
        disabled: Boolean(item.status && item.status !== '1')
      }))
    ),
    originType: computed(() => getDictMap.value.vehicleOriginType ?? []),
    color: computed(() => getDictMap.value.vehicleColor ?? []),
    plateColor: computed(() => getDictMap.value.vehiclePlateColor ?? []),
    businessType: computed(() => getDictMap.value.vehicleBusinessType ?? []),
    usageNature: computed(() => getDictMap.value.vehicleUsageNature ?? []),
    operationStatus: computed(() => getDictMap.value.vehicleOperationStatus ?? []),
    purchaseStatus: computed(() => getDictMap.value.vehiclePurchaseStatus ?? []),
    vehicleLevel: computed(() => getDictMap.value.vehicleLevel ?? []),
    fuelType: computed(() => getDictMap.value.vehicleFuelType ?? []),
    emissionStandard: computed(() => getDictMap.value.vehicleEmissionStandard ?? []),
    transportIndustry: computed(() => getDictMap.value.vehicleTransportIndustry ?? []),
    operationType: computed(() => getDictMap.value.vehicleOperationType ?? []),
    gender: computed(() => getDictMap.value.sex ?? []),
    boolean: computed(() =>
      (getDictMap.value.commonBoolean ?? []).map((item) => ({
        ...item,
        value: item.value === 'true'
      }))
    )
  })

  const createInitialForm = createInitialVehicleArchiveForm

  const form = reactive<VehicleArchiveForm>(createInitialForm())
  const documentTenantId = computed(
    () =>
      form.tenantId ?? tenantScopeStore.effectiveTenantId ?? userStore.getUserInfo.tenantId ?? ''
  )
  const uploadVehicleDocument = (file: File) =>
    uploadVehiclePrivateDocument(file, documentTenantId.value)
  watch(
    () => form.purchaseDate,
    (date) => {
      form.vehicleAgeDisplay = formatVehicleAge(date)
    },
    { immediate: true }
  )
  const archiveNumber = useDocumentNumberRule('vehicle.archive_self', () => form.tenantId)

  const canViewArchiveField = (field: Api.Vms.ArchiveManage.VehicleArchiveFieldKey): boolean =>
    !isEdit.value || canViewField(form.fieldAccess, field)
  const canEditArchiveField = (field: Api.Vms.ArchiveManage.VehicleArchiveFieldKey): boolean =>
    !isEdit.value || canEditField(form.fieldAccess, field)
  const canManageArchiveAttachments = computed(
    () => canEditArchiveField('documents') && hasAuth(savePermission.value)
  )

  const sensitiveFormFields: Partial<
    Record<keyof VehicleArchiveForm, Api.Vms.ArchiveManage.VehicleArchiveFieldKey>
  > = {
    vin: 'vehicleIdentifiers',
    operationCertNo: 'vehicleIdentifiers',
    purchaseCertNo: 'vehicleIdentifiers',
    registrationCertNo: 'vehicleIdentifiers',
    chassisNo: 'vehicleIdentifiers',
    gearboxSerialNo: 'vehicleIdentifiers',
    engineNo: 'vehicleIdentifiers',
    licensePlateCode: 'vehicleIdentifiers',
    ownerName: 'ownerIdentity',
    ownerGender: 'ownerIdentity',
    idCardNo: 'ownerIdentity',
    ownerPhone: 'contactPhones',
    mailingAddress: 'mailingAddress',
    operationRoute: 'operationRoute',
    acCode: 'deviceIdentity',
    terminalPhone: 'deviceIdentity'
  }

  const applyVehicleFieldAccess = (item: FormItem): FormItem => {
    const field = sensitiveFormFields[String(item.key) as keyof VehicleArchiveForm]
    if (!field) return item
    const canView = canViewArchiveField(field)
    const canEdit = canEditArchiveField(field)
    return {
      ...item,
      hidden: !canView,
      props: {
        ...(item.props ?? {}),
        disabled: !canEdit
      },
      description: !canView ? item.description : canEdit ? item.description : '当前字段按权限只读。'
    }
  }

  const rules = computed<FormRules<VehicleArchiveForm>>(() => ({
    plateNo: [{ required: true, message: '请输入车牌号', trigger: 'blur' }],
    tenantId:
      tenantScopeStore.isAllTenants && !isEdit.value
        ? [{ required: true, message: '请选择所属租户', trigger: 'change' }]
        : [],
    vehicleType: [
      {
        validator: (_rule, _value, callback) => {
          if (form.vehicleTypeProfileId || (isEdit.value && form.vehicleType)) callback()
          else callback(new Error('请参选已配置的车型规格'))
        },
        trigger: 'change'
      }
    ],
    plateColor: [{ required: true, message: '请选择车牌颜色', trigger: 'change' }],
    vehicleOwnership: [{ required: true, message: '请选择车辆归属', trigger: 'change' }],
    registerDate: submitIntent.value
      ? [{ required: true, message: '请选择登记日期', trigger: 'change' }]
      : [],
    issueDate: submitIntent.value
      ? [{ required: true, message: '请选择发证日期', trigger: 'change' }]
      : [],
    invoiceDate: submitIntent.value
      ? [{ required: true, message: '请选择购入开票日期', trigger: 'change' }]
      : [],
    startUseDate: submitIntent.value
      ? [{ required: true, message: '请选择启用日期', trigger: 'change' }]
      : [],
    operationStatus: [{ required: true, message: '请选择营运状态', trigger: 'change' }]
  }))

  const derivedMetricInputProps = {
    readonly: true,
    placeholder: '参选车型后带入',
    class: 'vehicle-archive-edit__derived-input'
  }

  const basicItems = computed<FormItem[]>(() =>
    [
      { label: '车辆基础信息', key: 'identitySection', type: 'divider', span: 24 },
      { label: '车牌号', key: 'plateNo', type: 'input' },
      {
        label: '车牌颜色',
        key: 'plateColor',
        type: 'select',
        props: { options: options.plateColor }
      },
      {
        label: '车型',
        key: 'vehicleType',
        type: 'input',
        span: 6
      },
      {
        label: '规格 / 车长（米）',
        key: 'specLengthM',
        type: 'input',
        span: 6,
        props: derivedMetricInputProps
      },
      {
        label: '容积（立方米）',
        key: 'volumeM3',
        type: 'input',
        span: 6,
        props: derivedMetricInputProps
      },
      {
        label: '载重（吨）',
        key: 'loadTons',
        type: 'input',
        span: 6,
        props: derivedMetricInputProps
      },
      { label: '购置时间', key: 'purchaseDate', type: 'date', span: 12, props: dateProps },
      {
        label: '车辆年限',
        key: 'vehicleAgeDisplay',
        type: 'input',
        span: 12,
        props: {
          readonly: true,
          placeholder: '选择购置时间后自动计算',
          class: 'vehicle-archive-edit__derived-input'
        }
      },
      ...(tenantScopeStore.isAllTenants && !isEdit.value
        ? [
            {
              label: '所属租户',
              key: 'tenantId',
              type: 'select' as const,
              props: {
                options: [
                  {
                    label: userStore.getUserInfo.tenant?.tenantName ?? '平台租户',
                    value: userStore.getUserInfo.tenantId
                  },
                  ...tenantScopeStore.tenantOptions
                    .filter((tenant) => tenant.id !== userStore.getUserInfo.tenantId)
                    .map((tenant) => ({
                      label: tenant.tenantName,
                      value: tenant.id
                    }))
                ],
                filterable: true,
                placeholder: '默认平台租户，可选择其他所属租户',
                onChange: (tenantId: string) => {
                  form.companyName =
                    (tenantId === userStore.getUserInfo.tenantId
                      ? userStore.getUserInfo.tenant?.tenantName
                      : tenantScopeStore.tenantOptions.find((tenant) => tenant.id === tenantId)
                          ?.tenantName) ?? ''
                  form.carrierId = null
                  form.vehicleTypeProfileId = null
                  form.vehicleType = ''
                  form.primaryDriverId = null
                  form.secondaryDriverId = null
                  form.backupDriverIds = []
                  form.backupDrivers = []
                  form.vehiclePhotoUrl = ''
                  form.drivingLicenseFrontUrl = ''
                  form.drivingLicenseBackUrl = ''
                  form.drivingLicenseBackReverseUrl = ''
                  form.operationLicenseUrl = ''
                  form.personVehiclePhotoUrl = ''
                  form.vehicleHeadPhotoUrl = ''
                  form.attachments = []
                }
              }
            }
          ]
        : []),
      {
        label: '所属承运商',
        key: 'carrierId',
        type: 'select',
        api: fetchCarrierOptions,
        resultField: 'data',
        labelField: 'companyName',
        valueField: 'id',
        labelFn: (option: unknown) => {
          const carrier = option as CarrierOption
          return carrier.carrierCode
            ? `${carrier.companyName}（${carrier.carrierCode}）`
            : carrier.companyName
        },
        props: {
          filterable: true,
          clearable: true,
          placeholder: '请选择所属承运商（选填）',
          onChange: (value?: string) => {
            if (!value) {
              form.primaryDriverId = null
              form.primaryDriver = null
              form.primaryDriverName = ''
              form.primaryDriverPhone = ''
              form.secondaryDriverId = null
              form.secondaryDriver = null
              form.backupDriverIds = []
              form.backupDrivers = []
              form.secondaryDriverName = ''
              form.secondaryDriverPhone = ''
              driverCache.value = new Map()
              return
            }
            form.primaryDriverId = null
            form.primaryDriver = null
            form.primaryDriverName = ''
            form.primaryDriverPhone = ''
            form.secondaryDriverId = null
            form.secondaryDriver = null
            form.backupDriverIds = []
            form.backupDrivers = []
            form.secondaryDriverName = ''
            form.secondaryDriverPhone = ''
            driverCache.value = new Map()
          }
        }
      },
      { label: '所属公司', key: 'companyName', type: 'input', props: { readonly: true } },
      {
        label: '自编号',
        key: 'selfNo',
        type: 'input',
        props: {
          maxlength: 50,
          ...archiveNumber.inputProps(Boolean(form.id), '可手工填写车辆自编号', true)
        },
        description: archiveNumber.description.value
      },
      {
        label: '车辆归属',
        key: 'vehicleOwnership',
        type: 'radioGroup',
        props: { options: options.vehicleOwnership, optionType: 'button' }
      },
      {
        label: '使用性质',
        key: 'usageNature',
        type: 'select',
        description: '新车默认货运；历史档案请按行驶证核对。',
        props: {
          options: options.usageNature,
          clearable: true,
          placeholder: '请选择使用性质'
        }
      },
      {
        label: '国产/进口',
        key: 'originType',
        type: 'radioGroup',
        props: { options: options.originType, optionType: 'button' }
      },
      {
        label: '营运状态',
        key: 'operationStatus',
        type: 'select',
        props: { options: options.operationStatus }
      },
      {
        label: '是否新能源车',
        key: 'isNewEnergy',
        type: 'radioGroup',
        props: { options: options.boolean }
      },
      {
        label: '车身颜色',
        key: 'vehicleColor',
        type: 'select',
        props: { options: options.color }
      },
      { label: '车型与运力', key: 'capacitySection', type: 'divider', span: 24 },
      { label: '吨位/座位', key: 'tonnageOrSeat', type: 'input' },
      {
        label: '核定乘员数',
        key: 'approvedPassengerCount',
        type: 'number',
        description: '单位：人',
        props: numberProps
      },
      { label: '座位数', key: 'seatCount', type: 'number', props: numberProps },
      { label: '车辆识别与证照', key: 'documentsSection', type: 'divider', span: 24 },
      { label: '车架号（VIN）', key: 'vin', type: 'input' },
      { label: '车辆厂商', key: 'manufacturer', type: 'input' },
      { label: '厂牌型号', key: 'brandModel', type: 'input' },
      { label: '营运证号', key: 'operationCertNo', type: 'input' },
      { label: '购置证号', key: 'purchaseCertNo', type: 'input' },
      { label: '登记证号', key: 'registrationCertNo', type: 'input' },
      { label: '底盘号', key: 'chassisNo', type: 'input', span: 12 },
      { label: '空调号码', key: 'acCode', type: 'input', span: 12 },
      { label: '波箱系列号', key: 'gearboxSerialNo', type: 'input', span: 12 },
      { label: '登记与使用', key: 'registrationSection', type: 'divider', span: 24 },
      { label: '登记日期', key: 'registerDate', type: 'date', span: 6, props: dateProps },
      { label: '发证日期', key: 'issueDate', type: 'date', span: 6, props: dateProps },
      { label: '购入开票日期', key: 'invoiceDate', type: 'date', span: 6, props: dateProps },
      { label: '启用日期', key: 'startUseDate', type: 'date', span: 6, props: dateProps },
      { label: '营运配置', key: 'operationSection', type: 'divider', span: 24 },
      {
        label: '业务类型',
        key: 'businessType',
        type: 'select',
        props: { options: options.businessType }
      },
      {
        label: '是否空调车',
        key: 'isAirConditioned',
        type: 'radioGroup',
        props: { options: options.boolean }
      },
      { label: '营运状态变更', key: 'operationStatusChangeDate', type: 'date', props: dateProps },
      {
        label: '购置状态',
        key: 'purchaseStatus',
        type: 'select',
        props: { options: options.purchaseStatus }
      },
      { label: '购置状态变更', key: 'purchaseStatusChangeDate', type: 'date', props: dateProps },
      { label: '例检启用日期', key: 'inspectionStartDate', type: 'date', props: dateProps },
      {
        label: '车辆等级',
        key: 'vehicleLevel',
        type: 'select',
        props: { options: options.vehicleLevel }
      },
      { label: '质保与备注', key: 'warrantySection', type: 'divider', span: 24 },
      {
        label: '使用年限',
        key: 'serviceYears',
        type: 'number',
        description: '单位：年',
        props: numberProps
      },
      {
        label: '整车三包里程',
        key: 'threeGuaranteeMileage',
        type: 'number',
        description: '单位：公里',
        props: numberProps
      },
      {
        label: '整车三包时长',
        key: 'threeGuaranteeDuration',
        type: 'number',
        description: '单位：个月',
        props: numberProps
      },
      {
        label: '整车包修里程',
        key: 'warrantyMileage',
        type: 'number',
        span: 12,
        description: '单位：公里',
        props: numberProps
      },
      {
        label: '整车包修时长',
        key: 'warrantyDuration',
        type: 'number',
        span: 12,
        description: '单位：个月',
        props: numberProps
      },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: { type: 'textarea', rows: 3 }
      }
    ].map(applyVehicleFieldAccess)
  )

  const bodyItems = computed<FormItem[]>(() => [
    { label: '载质量', key: 'massSection', type: 'divider', span: 24 },
    {
      label: '满载总质量',
      key: 'grossMass',
      type: 'number',
      props: numberProps,
      slots: {
        suffix: () => 'kg'
      }
    },
    {
      label: '整备质量',
      key: 'curbWeight',
      type: 'number',
      props: numberProps,
      slots: {
        suffix: () => 'kg'
      }
    },
    {
      label: '核定载质量',
      key: 'approvedLoadMass',
      type: 'number',
      props: numberProps,
      slots: {
        suffix: () => 'kg'
      }
    },
    { label: '外廓与底盘', key: 'bodyDimensionsSection', type: 'divider', span: 24 },
    {
      label: '外廓长度',
      key: 'overallLength',
      type: 'number',
      props: numberProps,
      slots: {
        suffix: () => 'mm'
      }
    },
    {
      label: '外廓宽度',
      key: 'overallWidth',
      type: 'number',
      props: numberProps,
      slots: {
        suffix: () => 'mm'
      }
    },
    {
      label: '外廓高度',
      key: 'overallHeight',
      type: 'number',
      props: numberProps,
      slots: {
        suffix: () => 'mm'
      }
    },
    { label: '标台', key: 'platform', type: 'input' },
    {
      label: '前轮距',
      key: 'frontTrack',
      type: 'number',
      props: numberProps,
      slots: {
        suffix: () => 'mm'
      }
    },
    {
      label: '后轮距',
      key: 'rearTrack',
      type: 'number',
      props: numberProps,
      slots: {
        suffix: () => 'mm'
      }
    },
    { label: '轴距', key: 'wheelbase', type: 'number', props: numberProps },
    { label: '车轴数', key: 'axleCount', type: 'number', props: numberProps },
    { label: '轮胎数', key: 'tireCount', type: 'number', props: numberProps },
    {
      label: '钢板弹簧数',
      key: 'leafSpringCount',
      type: 'number',
      span: 12,
      props: numberProps,
      slots: {
        suffix: () => '片'
      }
    },
    {
      label: '是否双层',
      key: 'isDoubleDeck',
      type: 'radioGroup',
      span: 12,
      props: { options: options.boolean }
    }
  ])

  const engineItems = computed<FormItem[]>(() =>
    [
      { label: '发动机身份', key: 'engineIdentitySection', type: 'divider', span: 24 },
      { label: '发动机号', key: 'engineNo', type: 'input' },
      { label: '发动机型号', key: 'engineModel', type: 'input' },
      { label: '燃油类型', key: 'fuelType', type: 'select', props: { options: options.fuelType } },
      { label: '动力与排放', key: 'enginePerformanceSection', type: 'divider', span: 24 },
      {
        label: '发动机排量',
        key: 'displacement',
        type: 'number',
        props: numberProps,
        slots: {
          suffix: () => 'L'
        }
      },
      {
        label: '排放标准',
        key: 'emissionStandard',
        type: 'select',
        props: { options: options.emissionStandard }
      },
      {
        label: '发动机功率',
        key: 'enginePower',
        type: 'number',
        props: numberProps,
        slots: {
          suffix: () => 'KW'
        }
      },
      {
        label: '额定扭矩转速',
        key: 'ratedTorqueSpeed',
        type: 'number',
        span: 12,
        props: numberProps,
        slots: {
          suffix: () => 'r/min'
        }
      },
      {
        label: '发动机扭矩',
        key: 'engineTorque',
        type: 'number',
        span: 12,
        props: numberProps,
        slots: {
          suffix: () => 'N-M'
        }
      }
    ].map(applyVehicleFieldAccess)
  )

  const otherItems = computed<FormItem[]>(() =>
    [
      { label: '车主与联系', key: 'ownerContactSection', type: 'divider', span: 24 },
      {
        label: '运输行业',
        key: 'transportIndustry',
        type: 'select',
        props: { options: options.transportIndustry }
      },
      {
        label: '营运类型',
        key: 'operationType',
        type: 'select',
        props: { options: options.operationType }
      },
      { label: '业户名称', key: 'ownerName', type: 'input' },
      { label: '业户联系电话', key: 'ownerPhone', type: 'input' },
      { label: '车载终端电话', key: 'terminalPhone', type: 'input' },
      { label: '车主性别', key: 'ownerGender', type: 'select', props: { options: options.gender } },
      { label: '身份证号码', key: 'idCardNo', type: 'input' },
      { label: '通讯地址', key: 'mailingAddress', type: 'input' },
      { label: '驾驶人员', key: 'driversSection', type: 'divider', span: 24 },
      {
        label: '主司机',
        key: 'primaryDriverId',
        type: 'select',
        span: 8,
        api: fetchDriverOptions,
        options: selectedPrimaryDriverOptions.value,
        resultField: 'data',
        labelField: 'driverName',
        valueField: 'id',
        immediate: false,
        beforeFetch: () => ({
          carrierId: form.carrierId ?? undefined,
          driverType: 'primary'
        }),
        shouldFetch: () => Boolean(form.carrierId),
        afterFetch: syncPrimaryDriverOptions,
        labelFn: (option: unknown) => {
          const driver = option as DriverOption
          return driver.phone ? `${driver.driverName}（${driver.phone}）` : driver.driverName
        },
        props: {
          filterable: true,
          clearable: true,
          disabled: !form.carrierId,
          placeholder: form.carrierId ? '请选择主司机' : '请先选择所属承运商',
          onVisibleChange: (visible: boolean) => {
            if (visible && form.carrierId) void otherFormRef.value?.reloadOptions('primaryDriverId')
          },
          onChange: (value?: string) => {
            if (!value) {
              form.primaryDriver = null
              form.primaryDriverName = ''
              form.primaryDriverPhone = ''
              return
            }
            const driver = driverCache.value.get(value)
            form.primaryDriver = driver ?? null
            form.primaryDriverName = driver?.driverName ?? ''
            form.primaryDriverPhone = driver?.phone ?? ''
          }
        }
      },
      { label: '主司机姓名', key: 'primaryDriverName', type: 'input', props: { readonly: true } },
      { label: '主司机电话', key: 'primaryDriverPhone', type: 'input', props: { readonly: true } },
      {
        label: '备用司机',
        key: 'backupDriverIds',
        type: 'select',
        span: 24,
        description: '可绑定多名轮班司机；列表首位同步为默认备用司机。',
        api: fetchDriverOptions,
        options: selectedSecondaryDriverOptions.value,
        resultField: 'data',
        labelField: 'driverName',
        valueField: 'id',
        immediate: false,
        beforeFetch: () => ({
          carrierId: form.carrierId ?? undefined,
          driverType: 'secondary'
        }),
        shouldFetch: () => Boolean(form.carrierId),
        afterFetch: syncSecondaryDriverOptions,
        labelFn: (option: unknown) => {
          const driver = option as DriverOption
          return driver.phone ? `${driver.driverName}（${driver.phone}）` : driver.driverName
        },
        props: {
          filterable: true,
          clearable: true,
          multiple: true,
          collapseTags: true,
          collapseTagsTooltip: true,
          disabled: !form.carrierId,
          placeholder: form.carrierId ? '请选择一名或多名备用司机' : '请先选择所属承运商',
          onVisibleChange: (visible: boolean) => {
            if (visible && form.carrierId) void otherFormRef.value?.reloadOptions('backupDriverIds')
          },
          onChange: (value?: string[]) => syncBackupDriverSelection(value ?? [])
        }
      },
      { label: '运营与设备', key: 'otherOperationsSection', type: 'divider', span: 24 },
      { label: '营运线路', key: 'operationRoute', type: 'input' },
      { label: '车籍地代码', key: 'licensePlateCode', type: 'input' },
      {
        label: '支持拍照',
        key: 'supportPhoto',
        type: 'radioGroup',
        props: { options: options.boolean }
      },
      { label: '服务开始时间', key: 'serviceStartTime', type: 'date', span: 12, props: dateProps },
      { label: '服务结束时间', key: 'serviceEndTime', type: 'date', span: 12, props: dateProps }
    ].map(applyVehicleFieldAccess)
  )

  function syncPrimaryDriverOptions(result: unknown): unknown {
    const selected = getSelectedPrimaryDriver()
    return syncDriverOptions(result, selected ? [selected] : [])
  }

  function syncSecondaryDriverOptions(result: unknown): unknown {
    return syncDriverOptions(result, getSelectedBackupDrivers())
  }

  function syncDriverOptions(result: unknown, selectedDrivers: DriverOption[]): unknown {
    if (!result || typeof result !== 'object') return result

    const data = (result as { data?: DriverOption[] }).data
    if (Array.isArray(data)) {
      const nextData = [
        ...selectedDrivers.filter((driver) => !data.some((item) => item.id === driver.id)),
        ...data
      ]
      driverCache.value = new Map([
        ...driverCache.value,
        ...nextData.map((item): [string, DriverOption] => [item.id, item])
      ])
      return {
        ...(result as Record<string, unknown>),
        data: nextData
      }
    }

    return result
  }

  function getSelectedPrimaryDriver(): DriverOption | undefined {
    if (!form.primaryDriverId) return undefined
    return (
      driverCache.value.get(form.primaryDriverId) ??
      (form.primaryDriver?.id === form.primaryDriverId ? form.primaryDriver : undefined)
    )
  }

  function getSelectedBackupDrivers(): DriverOption[] {
    return (form.backupDriverIds ?? []).flatMap((id) => {
      const driver =
        driverCache.value.get(id) ??
        form.backupDrivers?.find((item) => item.id === id) ??
        (form.secondaryDriver?.id === id ? form.secondaryDriver : null)
      return driver ? [driver] : []
    })
  }

  function syncBackupDriverSelection(ids: string[]): void {
    const nextIds = ids.filter((id) => id !== form.primaryDriverId)
    if (nextIds.length !== ids.length) ElMessage.warning('主司机不能重复选为备用司机')
    form.backupDriverIds = nextIds
    form.backupDrivers = nextIds.flatMap((id) => {
      const driver = driverCache.value.get(id)
      return driver ? [driver] : []
    })
    form.secondaryDriverId = nextIds[0] ?? null
    form.secondaryDriver = form.backupDrivers[0] ?? null
    form.secondaryDriverName = form.secondaryDriver?.driverName ?? ''
    form.secondaryDriverPhone = form.secondaryDriver?.phone ?? ''
  }

  function createDriverOption(driver: DriverOption): FormItemOption {
    return {
      ...driver,
      label: driver.phone ? `${driver.driverName}（${driver.phone}）` : driver.driverName,
      value: driver.id
    }
  }

  const certificateItems: Array<{ key: ImageKey; label: string }> = [
    { key: 'drivingLicenseFrontUrl', label: '行驶证主页' },
    { key: 'drivingLicenseBackUrl', label: '行驶证副页' },
    { key: 'drivingLicenseBackReverseUrl', label: '副页背面照' },
    { key: 'personVehiclePhotoUrl', label: '人车合影' },
    { key: 'vehicleHeadPhotoUrl', label: '车辆大头照' },
    { key: 'operationLicenseUrl', label: '运营证照片' }
  ]
  const visibleCertificateItems = computed(() =>
    canViewArchiveField('documents') ? certificateItems : []
  )
  const certificateFilledCount = computed(
    () => visibleCertificateItems.value.filter((item) => Boolean(form[item.key])).length
  )

  type OcrField = keyof VehicleDocumentOcrResult['document']
  interface OcrReviewRow {
    field: OcrField
    label: string
    current: string
    recognized: string
  }
  const ocrFieldLabels: Record<OcrField, string> = {
    plateNo: '车牌号',
    vin: '车架号（VIN）',
    engineNo: '发动机号',
    vehicleType: '车型',
    brandModel: '厂牌型号',
    ownerName: '所有人',
    registerDate: '登记日期',
    issueDate: '发证日期',
    operationCertNo: '营运证号',
    operationType: '经营范围'
  }
  const ocrFieldAccess: Partial<Record<OcrField, Api.Vms.ArchiveManage.VehicleArchiveFieldKey>> = {
    vin: 'vehicleIdentifiers',
    engineNo: 'vehicleIdentifiers',
    operationCertNo: 'vehicleIdentifiers',
    ownerName: 'ownerIdentity'
  }
  const ocrReviewRows = computed<OcrReviewRow[]>(() =>
    (Object.keys(ocrFieldLabels) as OcrField[])
      .filter((field) => {
        const access = ocrFieldAccess[field]
        const mismatchedDate =
          ocrDocumentType.value === 'operation_license' &&
          (field === 'registerDate' || field === 'issueDate')
        return (
          !mismatchedDate &&
          (!access || canViewArchiveField(access)) &&
          Boolean(ocrResult.value?.document[field])
        )
      })
      .map((field) => ({
        field,
        label: ocrFieldLabels[field],
        current: String(form[field] ?? ''),
        recognized: String(ocrResult.value?.document[field] ?? '')
      }))
  )
  const ocrReviewColumns: ColumnOption<OcrReviewRow>[] = [
    { prop: 'label', label: '表单字段', width: 140 },
    { prop: 'current', label: '当前内容', minWidth: 170 },
    { prop: 'recognized', label: '识别内容', minWidth: 200 }
  ]

  const recognizeCertificate = async (
    key: 'drivingLicenseFrontUrl' | 'operationLicenseUrl'
  ): Promise<void> => {
    const url = form[key]
    if (!url) {
      ocrError.value = '请先上传要识别的证照照片'
      return
    }
    if (!hasAuth('VehicleArchive:Ocr')) {
      ocrError.value = '当前账号没有证照识别权限'
      return
    }
    ocrError.value = ''
    ocrBusyKey.value = key
    ocrMode.value = 'ai'
    try {
      const documentType =
        key === 'drivingLicenseFrontUrl' ? 'driving_license' : 'operation_license'
      const { data, error } = await analyzeVehicleDocumentByAi(
        url,
        documentType,
        documentTenantId.value,
        isEdit.value ? String(route.params.id) : null
      )
      if (error) throw error
      if (!data) throw new Error('未获取到证照识别结果')
      if (activeImageKey.value !== key) return
      await openOcrReview(data, documentType, '车辆证照识别结果')
    } catch (error) {
      ocrError.value = getFriendlySupabaseErrorMessage(error, '车辆证照识别失败，请检查网络后重试')
    } finally {
      ocrBusyKey.value = null
      ocrMode.value = null
    }
  }

  const recognizeCertificateLocally = async (
    key: 'drivingLicenseFrontUrl' | 'operationLicenseUrl'
  ): Promise<void> => {
    const url = form[key]
    if (!url) {
      ocrError.value = '请先上传要识别的证照照片'
      return
    }
    if (!hasAuth('VehicleArchive:Ocr') || !canViewArchiveField('documents')) {
      ocrError.value = '当前账号没有证照识别权限'
      return
    }
    ocrError.value = ''
    ocrBusyKey.value = key
    ocrMode.value = 'local'
    try {
      const documentType =
        key === 'drivingLicenseFrontUrl' ? 'driving_license' : 'operation_license'
      const result = await analyzeVehicleDocumentLocally(url, documentType)
      if (activeImageKey.value !== key) return
      await openOcrReview(result, documentType, '本地证照文字识别结果')
    } catch (error) {
      ocrError.value = getFriendlySupabaseErrorMessage(
        error,
        '本地识别失败，请使用清晰照片重试或手工填写'
      )
    } finally {
      ocrBusyKey.value = null
      ocrMode.value = null
    }
  }

  const openOcrReview = async (
    result: VehicleDocumentOcrResult,
    documentType: VehicleDocumentOcrType,
    title: string
  ): Promise<void> => {
    ocrDocumentType.value = documentType
    ocrResult.value = result
    ocrReplaceExisting.value = false
    await ocrReviewDialogRef.value?.handleOpen(result, { title })
  }

  const applyOcrResult = (): void => {
    if (!canApplyOcrResult.value || !ocrResult.value) return
    let applied = 0
    for (const row of ocrReviewRows.value) {
      if (row.field === 'vehicleType') continue
      const access = ocrFieldAccess[row.field]
      if (access && !canEditArchiveField(access)) continue
      if (!ocrReplaceExisting.value && form[row.field]) continue
      const value =
        row.field === 'operationType'
          ? options.operationType.find(
              (option) => option.value === row.recognized || option.label === row.recognized
            )?.value
          : row.recognized
      if (!value) continue
      form[row.field] = value
      applied += 1
    }
    if (applied && ocrResult.value.artifactId) form.aiArtifactId = ocrResult.value.artifactId
    ElMessage.success(applied ? `已填入 ${applied} 个字段，请核对后保存` : '没有需要填入的字段')
    ocrReviewDialogRef.value?.handleClose()
  }

  const attachmentColumns: ColumnOption<ArchiveAttachment>[] = [
    { type: 'globalIndex', label: '序号', width: 80 },
    {
      prop: 'name',
      label: '档案附件名称',
      minWidth: 220,
      link: attachmentTableLink
    },
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
      width: 144,
      fixed: 'right',
      formatter: (row) => (
        <BusinessAttachmentRowActions
          file={row}
          removable={canManageArchiveAttachments.value}
          removeLabel="删除附件"
          onRemove={() => void removeAttachment(row)}
        />
      )
    }
  ]

  onMounted(() => {
    void initializePage()
  })

  const initializePage = async (): Promise<void> => {
    page.loading = true
    page.error = null
    try {
      await tenantScopeStore.loadTenantOptions()
      const dictionaryCodes = [
        'FILE_EXTENSION_LABEL_MAP',
        'vehicleOwnership',
        'vehicleOriginType',
        'vehicleTypeCategory',
        'vehicleColor',
        'vehiclePlateColor',
        'vehicleBusinessType',
        'vehicleUsageNature',
        'vehicleOperationStatus',
        'vehiclePurchaseStatus',
        'vehicleLevel',
        'vehicleFuelType',
        'vehicleEmissionStandard',
        'vehicleTransportIndustry',
        'vehicleOperationType',
        'sex',
        'commonBoolean'
      ] as const
      await Promise.all([
        loadArchiveDetail(),
        ...dictionaryCodes.map((code) => userStore.ensureDictLoaded(code))
      ])
      await archiveNumber.loadRule()
      await nextTick()
      formTabs.forEach((tab) => tab.formRef.value?.clearValidate())
    } catch (error) {
      page.error = error instanceof Error ? error : new Error('车辆档案加载失败')
    } finally {
      page.loading = false
    }
  }

  const loadArchiveDetail = async (): Promise<void> => {
    if (!isEdit.value) {
      if (isCopy.value) {
        if (!hasAuth('VehicleArchive:Copy') || !hasAuth('VehicleArchive:Add')) {
          throw new Error('没有复制车辆档案的权限')
        }
        const { data } = await fetchVehicleArchiveDetail(String(route.query.copyFrom))
        if (!data) throw new Error('源车辆档案不存在或无权访问')
        replaceForm({
          ...createInitialForm(),
          ...data,
          id: undefined,
          plateNo: '',
          selfNo: '',
          vin: '',
          chassisNo: '',
          engineNo: '',
          drivingLicenseFrontUrl: '',
          drivingLicenseBackUrl: '',
          operationLicenseUrl: '',
          drivingLicenseBackReverseUrl: '',
          personVehiclePhotoUrl: '',
          vehicleHeadPhotoUrl: '',
          vehiclePhotoUrl: '',
          attachments: [],
          auditStatus: 'draft',
          auditRemark: ''
        })
        return
      }
      form.companyName =
        tenantScopeStore.selectedTenant?.tenantName ??
        userStore.getUserInfo.tenant?.tenantName ??
        ''
      form.tenantId =
        tenantScopeStore.effectiveTenantId ?? userStore.getUserInfo.tenantId ?? undefined
      return
    }
    const id = String(route.params.id)
    const { data } = await fetchVehicleArchiveDetail(id)
    if (!data) throw new Error('车辆档案不存在或无权访问')
    originalAuditStatus.value = data.auditStatus
    replaceForm({ ...createInitialForm(), ...data, attachments: data.attachments ?? [] })
    await loadDefaultTrailer()
  }

  const loadDefaultTrailer = async (): Promise<void> => {
    if (!isEdit.value) return
    const result = await fetchDefaultTrailer(String(route.params.id))
    defaultTrailerError.value = Boolean(result.error)
    if (!result.error) {
      defaultTrailer.value = result.data ?? null
      defaultTrailerId.value = result.data?.id
      defaultTrailerSelection.value = result.data ? [result.data] : []
    }
  }

  const fetchDefaultTrailerOptions = async (params: DataSelectFetchParams) => {
    return await fetchTrailerOptions({
      vehicleId: String(route.params.id),
      keyword: params.keyword,
      from: (params.page - 1) * params.pageSize,
      to: params.page * params.pageSize - 1
    })
  }

  const handleDefaultTrailerChange = async (
    _value: unknown,
    rows: TrailerOption[]
  ): Promise<void> => {
    const prior = defaultTrailer.value
    trailerSaving.value = true
    try {
      const result = await setDefaultTrailer({
        vehicleId: String(route.params.id),
        trailerId: rows[0]?.id ?? null
      })
      if (result.error) throw result.error
      defaultTrailer.value = result.data ?? rows[0] ?? null
      defaultTrailerError.value = false
    } catch {
      defaultTrailerId.value = prior?.id
      defaultTrailerSelection.value = prior ? [prior] : []
    } finally {
      trailerSaving.value = false
    }
  }

  const replaceForm = (nextForm: VehicleArchiveForm): void => {
    Object.keys(form).forEach((key) => {
      delete form[key as keyof VehicleArchive]
    })
    Object.assign(form, nextForm)
    if (nextForm.primaryDriver?.id) {
      driverCache.value.set(nextForm.primaryDriver.id, nextForm.primaryDriver)
      form.primaryDriverName = nextForm.primaryDriver.driverName
      form.primaryDriverPhone = nextForm.primaryDriver.phone ?? ''
    }
    if (nextForm.secondaryDriver?.id) {
      driverCache.value.set(nextForm.secondaryDriver.id, nextForm.secondaryDriver)
      form.secondaryDriverName = nextForm.secondaryDriver.driverName
      form.secondaryDriverPhone = nextForm.secondaryDriver.phone ?? ''
    }
    for (const driver of nextForm.backupDrivers ?? []) {
      driverCache.value.set(driver.id, driver)
    }
    form.backupDriverIds = nextForm.backupDriverIds?.length
      ? [...nextForm.backupDriverIds]
      : nextForm.secondaryDriverId
        ? [nextForm.secondaryDriverId]
        : []
  }

  const validateForms = async (): Promise<boolean> => {
    for (const tab of formTabs.filter((item) => availableTabNames.value.includes(item.name))) {
      try {
        await tab.formRef.value?.validate()
      } catch {
        page.activeTab = tab.name
        await nextTick()
        focusFirstInvalidFormField(pageRef, `#pane-${tab.name} .el-form-item.is-error`)
        return false
      }
    }

    return true
  }

  const handleSave = async (submitForApproval: boolean): Promise<void> => {
    submitIntent.value = submitForApproval
    await nextTick()
    const valid = await validateForms()
    if (!valid) return

    page.saving = true
    try {
      const payload = sanitizeVehicleArchivePayload(toRaw(form))
      if (isEdit.value) {
        await editVehicleArchive(payload, { showMessage: !submitForApproval })
        if (submitForApproval) {
          await submitVehicleArchiveForApproval(
            String(payload.id),
            String(payload.plateNo || '未编号车辆')
          )
        }
      } else {
        const response = await addVehicleArchive(payload, { showMessage: false })
        if (!response.data?.id) throw new Error('车辆档案创建成功，但未返回档案 ID')
        if (submitForApproval) {
          await submitVehicleArchiveForApproval(
            response.data.id,
            String(payload.plateNo || '未编号车辆')
          )
        }
      }
      goBack()
    } finally {
      page.saving = false
    }
  }

  const openVehicleTypePicker = (): void => {
    void vehicleTypePickerRef.value?.handleOpen({
      vehicleId: isEdit.value ? String(route.params.id) : undefined,
      carrierId: form.carrierId ?? undefined,
      tenantId: form.tenantId,
      selectedId: form.vehicleTypeProfileId
    })
  }

  const handleVehicleTypeSelected = (profile: VehicleTypeProfile): void => {
    form.vehicleTypeProfileId = profile.id
    form.vehicleType = profile.category
    form.specLengthM = profile.lengthM
    form.volumeM3 = profile.volumeM3
    form.loadTons = profile.loadTons
    basicFormRef.value?.clearValidate()
  }

  const handleAttachmentUpload = (resources: Api.DataCenter.Resources.ResourceListItem[]): void => {
    const resource = resources[0]
    if (!resource) return
    if (!resource.url) return
    if ((form.attachments ?? []).some((item) => item.url === resource.url)) {
      ElMessage.info('该附件已在当前记录中')
      return
    }
    const fileName = resource.originName || resource.objectName || '附件'
    const nextAttachment: ArchiveAttachment = {
      name: fileName,
      url: resource.url,
      fileType: getFileExtension(fileName, resource.suffix),
      fileSize: resource.sizeInfo
    }
    form.attachments = [...(form.attachments ?? []), nextAttachment]
    ElMessage.success('附件已添加')
  }

  const removeAttachment = async (row: ArchiveAttachment): Promise<void> => {
    if (!canManageArchiveAttachments.value) return
    try {
      await confirmAction(`确定删除附件“${row.name}”吗？`, '删除确认', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonType: 'danger'
      })
      form.attachments = removeAttachmentRow(form.attachments ?? [], row)
    } catch {
      // 用户取消删除时无须提示
    }
  }

  const goBack = (): void => {
    void router.push('/vms/vehicle-archive-manage')
  }

  const dateProps = {
    type: 'date',
    valueFormat: 'YYYY-MM-DD',
    class: '!w-full'
  }

  const numberProps = {
    min: 0,
    controlsPosition: 'right',
    class: '!w-full'
  }
</script>

<style scoped lang="scss">
  .vehicle-archive-edit {
    min-height: 100%;
    padding: var(--art-space-4) var(--art-space-4) 0;
    background: var(--default-box-color);

    :deep(> .art-async-state) {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    &__header {
      margin-bottom: 16px;
    }

    &__content {
      flex: 1 0 auto;
      min-width: 0;
    }

    &__tabs {
      padding: 0 20px 20px;

      :deep(.el-tabs__header) {
        margin-bottom: 14px;
      }

      :deep(.el-tab-pane > .art-form) {
        padding-top: 8px;
      }

      :deep(.el-form-item) {
        margin-bottom: 18px;
      }
    }

    &__footer {
      flex: none;
      // Sticky 向上偏移时会压缩视觉间距，提前补偿以稳定保持 16px 卡片间隔。
      margin-top: calc(var(--art-space-4) + var(--art-sticky-offset));
    }

    &__vehicle-photo {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 12px 0 18px;

      strong {
        font-size: 14px;
        color: var(--el-text-color-primary);
      }

      p {
        margin: 6px 0 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__trailer-field {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 20px;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      margin-top: 8px;
      background: var(--el-fill-color-extra-light);
      border-radius: var(--art-control-radius);

      strong {
        font-size: 14px;
        color: var(--el-text-color-primary);
      }

      p {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__trailer-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;

      > span {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__type-trigger {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      width: 100%;
      height: 40px;
      padding: 0 12px;
      font-weight: 400;
      text-align: left;
      background: var(--el-bg-color);
      border-color: var(--el-border-color);

      :deep(> span) {
        display: flex;
        gap: 8px;
        align-items: center;
        width: 100%;
        min-width: 0;
      }

      :deep(.art-svg-icon:first-child) {
        flex: none;
        width: 16px;
        height: 16px;
        color: var(--el-text-color-secondary);
      }

      &.is-selected {
        background: var(--el-color-primary-light-9);
        border-color: var(--el-color-primary-light-5);
      }
    }

    :deep(.vehicle-archive-edit__derived-input .el-input__wrapper) {
      background: var(--el-fill-color-extra-light);
      box-shadow: 0 0 0 1px var(--el-border-color-light) inset;
    }

    &__type-value {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--el-text-color-placeholder);
      text-align: left;
      white-space: nowrap;

      .is-selected & {
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }

    &__type-action {
      flex: none;
      font-size: 12px;
      color: var(--el-color-primary);
    }

    &__section {
      margin-top: 20px;

      h3 {
        margin: 0 0 14px;
        font-size: 16px;
        font-weight: 600;
      }
    }

    &__section-header {
      display: flex;
      gap: var(--art-space-3);
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--art-space-3);
    }

    &__section-title {
      flex: 1;
      margin: 0 !important;
    }

    @media (width <= 680px) {
      &__section-header {
        flex-wrap: wrap;
        justify-content: flex-start;
      }
    }

    &__certificate-panel {
      padding: 18px;
      background: var(--el-fill-color-extra-light);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__certificate-heading {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 18px;

      > div {
        min-width: 0;

        p {
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }

      > span {
        flex: none;
        padding: 5px 10px;
        font-size: 12px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
        border-radius: 999px;
      }
    }

    &__images {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
      justify-items: start;
    }

    &__image-switch {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;

      button {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        min-height: 36px;
        padding: 6px 12px;
        color: var(--el-text-color-regular);
        cursor: pointer;
        background: var(--el-bg-color);
        border: 1px solid var(--el-border-color-light);
        border-radius: var(--art-control-radius);

        &.is-current {
          font-weight: 600;
          color: var(--el-color-primary);
          background: var(--el-color-primary-light-9);
          border-color: var(--el-color-primary-light-5);
        }

        &:focus-visible {
          outline: 2px solid var(--el-color-primary);
          outline-offset: 2px;
        }

        span {
          color: var(--el-color-success);
        }
      }
    }

    &__certificate-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
      min-width: 0;
    }

    &__ocr-review {
      display: grid;
      gap: 14px;
      padding: 8px 16px 16px;

      > p {
        margin: 0;
        color: var(--el-text-color-regular);
      }
    }

    &__ocr-note {
      font-size: 12px;
      color: var(--el-text-color-secondary) !important;
    }

    &__ocr-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;

      > span {
        flex: 1;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.el-tabs__content) {
      padding-top: 8px;
    }
  }
</style>
