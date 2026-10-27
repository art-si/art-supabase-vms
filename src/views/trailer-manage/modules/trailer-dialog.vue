<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <template #subtitle>按行驶证影像核对车辆参数，再补充归属与默认牵引车。</template>

    <div class="trailer-dialog">
      <ElAlert v-if="saveError" :title="saveError" type="error" show-icon :closable="false" />
      <div class="trailer-dialog__identity">
        <span class="trailer-dialog__identity-icon"><ArtSvgIcon icon="ri:truck-line" /></span>
        <div>
          <strong>{{ form.plateNo || '新挂车' }}</strong>
          <p>{{ form.trailerType || '请选择挂车车型' }} · {{ filledImageCount }}/4 张影像已上传</p>
        </div>
      </div>

      <div class="trailer-dialog__workarea">
        <section class="trailer-dialog__photos" aria-label="行驶证及车辆影像">
          <div class="trailer-dialog__section-heading">
            <strong>行驶证影像</strong>
            <span>选择影像，右侧同步展示对应字段</span>
          </div>
          <div class="trailer-dialog__photo-tabs" role="tablist" aria-label="影像类型">
            <button
              v-for="item in imageItems"
              :key="item.key"
              type="button"
              role="tab"
              :aria-selected="activeImage === item.key"
              :class="{ 'is-active': activeImage === item.key }"
              @click="activeImage = item.key"
            >
              <ArtSvgIcon :icon="form[item.key] ? 'ri:image-2-line' : 'ri:upload-2-line'" />
              <span>{{ item.label }}</span>
              <ArtSvgIcon
                v-if="form[item.key]"
                icon="ri:checkbox-circle-fill"
                class="trailer-dialog__done"
              />
            </button>
          </div>
          <div class="trailer-dialog__photo-preview">
            <ArtUploadImage
              v-model="form[activeImage]"
              :resource-tenant-id="resourceTenantId"
              :upload-request="uploadTrailerImage"
              :show-resource-picker="false"
              :file-size="8 * 1024 * 1024"
              file-type=".jpg,.jpeg,.png,.webp"
              :title="activeImageLabel"
              width="100%"
              :height="210"
              :limit="1"
            />
          </div>
          <p class="trailer-dialog__photo-help">影像私有存储，仅授权人员可预览、替换。</p>
        </section>

        <section class="trailer-dialog__details" aria-label="挂车档案信息">
          <div class="trailer-dialog__section-heading">
            <strong>{{
              activeImage === 'licenseBackUrl' ? '行驶证副页信息' : '车辆行驶证审核'
            }}</strong>
            <span>{{ activeImageLabel }}</span>
          </div>
          <ArtForm
            ref="formRef"
            :model-value="form"
            @update:model-value="replaceReactiveModel(form, $event)"
            :items="visibleItems"
            :rules="rules"
            :span="12"
            :gutter="16"
            label-width="116px"
            :show-reset="false"
            :show-submit="false"
          >
            <template #vehicleTypeProfileId>
              <ElButton class="trailer-dialog__picker" @click="openTypePicker">
                <span>{{ form.vehicleTypeProfileId ? form.trailerType : '请选择挂车车型' }}</span>
                <span class="trailer-dialog__picker-action"
                  >参选 <ArtSvgIcon icon="ri:arrow-right-s-line"
                /></span>
              </ElButton>
            </template>
          </ArtForm>
        </section>
      </div>

      <ArtSectionCard
        class="trailer-dialog__other"
        title="其他信息"
        subtitle="明确车辆归属与使用关系，便于后续任务关联。"
        :show-scrollbar="false"
        :min-height="0"
      >
        <ArtForm
          :model-value="form"
          @update:model-value="replaceReactiveModel(form, $event)"
          :items="otherItems"
          :span="12"
          :gutter="16"
          label-width="116px"
          :show-reset="false"
          :show-submit="false"
        >
          <template #defaultTractorId>
            <ArtTableSingleSelect
              v-model="tractorId"
              v-model:selected-data="selectedTractor"
              :api-fn="fetchTractorOptions"
              :columns="tractorColumns"
              row-key="id"
              label-key="plateNo"
              description-key="companyName"
              title="参选默认牵引车"
              search-placeholder="输入牵引车车牌号"
              placeholder="请选择默认牵引车（选填）"
              clearable
            />
          </template>
          <template #companyOrganizationId>
            <ArtTableSingleSelect
              v-model="companyOrganizationId"
              v-model:selected-data="selectedCompany"
              :api-fn="fetchCompanyOptions"
              :columns="companyColumns"
              row-key="id"
              label-key="label"
              title="参选所属公司"
              search-placeholder="输入公司名称"
              placeholder="请选择所属公司（可留空）"
              clearable
            />
          </template>
        </ArtForm>
      </ArtSectionCard>
    </div>

    <VehicleTypePicker ref="typePickerRef" @selected="selectProfile" />
  </ArtDialog>
</template>

<script setup lang="ts">
  import { ElAlert, ElButton, ElMessage, type FormRules } from 'element-plus'
  import { pick } from 'lodash-es'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import type {
    DataSelectColumn,
    DataSelectFetchParams
  } from '@/components/core/forms/art-data-select/types'
  import VehicleTypePicker from '../../vehicle-archive-edit/modules/vehicle-type-picker.vue'
  import { vehicleTypeProfileLabel } from '../../vehicle-archive-edit/modules/vehicle-type-catalog'
  import type { VehicleTypeProfile } from '@vms/types/vehicle-type'
  import type { TrailerRecord, TrailerWritePayload } from '@vms/types/trailer'
  import {
    fetchVehicleArchiveOptions,
    fetchTrailerCompanyOptions,
    saveTrailer,
    uploadTrailerPrivateImage
  } from '@vms/api'
  import type { TrailerCompanyOption } from '@vms/types/trailer'
  import { replaceReactiveModel } from '@/utils/form/model'
  import { normalizeNullableText, normalizeNullableNumber } from '@/utils/form/normalize'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useUserStore } from '@/store/modules/user'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'

  type ImageKey = 'licenseFrontUrl' | 'licenseBackUrl' | 'licenseBackReverseUrl' | 'rearPhotoUrl'
  type TrailerForm = TrailerWritePayload & { id: string | null }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<TrailerRecord | undefined>>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const typePickerRef = ref<{
    handleOpen: (data: { tenantId?: string; selectedId?: string | null }) => Promise<void>
  }>()
  const tenantScopeStore = useTenantScopeStore()
  const userStore = useUserStore()
  const plateColors = useDictionaryOptions('vehiclePlateColor')
  const ownershipOptions = useDictionaryOptions('vehicleOwnership')
  const activeImage = ref<ImageKey>('licenseFrontUrl')
  const saveError = ref('')
  const recordTenantId = ref<string | null>(null)
  const selectedTractor = ref<Api.Vms.VehicleManage.VehicleOption[]>([])
  const selectedCompany = ref<TrailerCompanyOption[]>([])

  const imageItems: { key: ImageKey; label: string }[] = [
    { key: 'licenseFrontUrl', label: '行驶证主页' },
    { key: 'licenseBackUrl', label: '行驶证副页' },
    { key: 'licenseBackReverseUrl', label: '副页背面照' },
    { key: 'rearPhotoUrl', label: '挂车车尾照' }
  ]

  const emptyForm = (): TrailerForm => ({
    id: null,
    plateNo: '',
    plateColor: '',
    vehicleTypeProfileId: null,
    trailerType: '',
    vin: null,
    ownerName: null,
    brandModel: null,
    archiveNo: null,
    curbWeightKg: null,
    approvedLoadKg: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    inspectionValidUntil: null,
    mandatoryScrapDate: null,
    ownership: 'self_operated',
    defaultTractorId: null,
    companyOrganizationId: null,
    source: null,
    remark: null,
    licenseFrontUrl: null,
    licenseBackUrl: null,
    licenseBackReverseUrl: null,
    rearPhotoUrl: null
  })
  const form = reactive<TrailerForm>(emptyForm())
  const resourceTenantId = computed(
    () =>
      recordTenantId.value ??
      tenantScopeStore.effectiveTenantId ??
      userStore.getUserInfo.tenantId ??
      undefined
  )
  const uploadTrailerImage = (file: File) =>
    uploadTrailerPrivateImage(file, resourceTenantId.value ?? '')
  const activeImageLabel = computed(
    () => imageItems.find((item) => item.key === activeImage.value)?.label ?? ''
  )
  const filledImageCount = computed(() => imageItems.filter((item) => form[item.key]).length)
  const tractorId = computed({
    get: () => form.defaultTractorId ?? undefined,
    set: (value?: string | number) => {
      form.defaultTractorId = value ? String(value) : null
    }
  })
  const companyOrganizationId = computed({
    get: () => form.companyOrganizationId ?? undefined,
    set: (value?: string | number) => {
      form.companyOrganizationId = value ? String(value) : null
    }
  })

  const tractorColumns: DataSelectColumn<Api.Vms.VehicleManage.VehicleOption>[] = [
    { prop: 'plateNo', label: '车牌号', width: 150 },
    { prop: 'vehicleType', label: '车型', minWidth: 160 },
    { prop: 'companyName', label: '所属公司', minWidth: 160 }
  ]
  const fetchTractorOptions = async (params: DataSelectFetchParams) => {
    const result = await fetchVehicleArchiveOptions({ plateNo: params.keyword })
    return { data: result.data ?? [], total: result.data?.length ?? 0, error: result.error }
  }
  const companyColumns: DataSelectColumn<TrailerCompanyOption>[] = [
    { prop: 'label', label: '公司名称', minWidth: 230 }
  ]
  const fetchCompanyOptions = async (params: DataSelectFetchParams) => {
    const result = await fetchTrailerCompanyOptions(params.keyword, form.id)
    return { data: result.data ?? [], total: result.data?.length ?? 0, error: result.error }
  }

  const rules: FormRules<TrailerForm> = {
    plateNo: [{ required: true, message: '请输入挂车车牌号', trigger: 'blur' }],
    plateColor: [{ required: true, message: '请选择车牌颜色', trigger: 'change' }],
    vehicleTypeProfileId: [{ required: true, message: '请选择挂车车型', trigger: 'change' }],
    ownerName: [{ required: true, message: '请输入行驶证所有人', trigger: 'blur' }]
  }
  const frontItems = computed<FormItem[]>(() => [
    {
      label: '车牌号',
      key: 'plateNo',
      type: 'input',
      span: 12,
      props: { maxlength: 20, placeholder: '请输入车牌号' }
    },
    {
      label: '车牌颜色',
      key: 'plateColor',
      type: 'select',
      span: 12,
      props: { options: plateColors }
    },
    { label: '挂车车型', key: 'vehicleTypeProfileId', type: 'input', span: 24 },
    { label: '车辆识别代码', key: 'vin', type: 'input', span: 24, props: { maxlength: 40 } },
    { label: '所有人', key: 'ownerName', type: 'input', span: 12, props: { maxlength: 100 } },
    { label: '品牌型号', key: 'brandModel', type: 'input', span: 12, props: { maxlength: 100 } }
  ])
  const backItems: FormItem[] = [
    { label: '档案编号', key: 'archiveNo', type: 'input', span: 24, props: { maxlength: 60 } },
    { label: '整备质量 (kg)', key: 'curbWeightKg', type: 'number', span: 12, props: { min: 0 } },
    {
      label: '核定载质量 (kg)',
      key: 'approvedLoadKg',
      type: 'number',
      span: 12,
      props: { min: 0 }
    },
    { label: '车长 (mm)', key: 'lengthMm', type: 'number', span: 8, props: { min: 0 } },
    { label: '车宽 (mm)', key: 'widthMm', type: 'number', span: 8, props: { min: 0 } },
    { label: '车高 (mm)', key: 'heightMm', type: 'number', span: 8, props: { min: 0 } },
    {
      label: '检验有效期至',
      key: 'inspectionValidUntil',
      type: 'date',
      span: 12,
      props: { type: 'date', valueFormat: 'YYYY-MM-DD', class: '!w-full' }
    },
    {
      label: '强制报废日期',
      key: 'mandatoryScrapDate',
      type: 'date',
      span: 12,
      props: { type: 'date', valueFormat: 'YYYY-MM-DD', class: '!w-full' }
    }
  ]
  const visibleItems = computed<FormItem[]>(() =>
    activeImage.value === 'licenseBackUrl' ? backItems : frontItems.value
  )
  const otherItems = computed<FormItem[]>(() => [
    { label: '车辆归属', key: 'ownership', type: 'select', props: { options: ownershipOptions } },
    { label: '默认牵引车', key: 'defaultTractorId', type: 'input' },
    { label: '所属公司', key: 'companyOrganizationId', type: 'input' },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 2, maxlength: 500 }
    }
  ])

  const openTypePicker = async () => {
    await typePickerRef.value?.handleOpen({
      tenantId: resourceTenantId.value,
      selectedId: form.vehicleTypeProfileId
    })
  }
  const selectProfile = (profile: VehicleTypeProfile) => {
    form.vehicleTypeProfileId = profile.id
    form.trailerType = vehicleTypeProfileLabel(profile)
    if (profile.lengthM != null) form.lengthMm = Math.round(profile.lengthM * 1000)
    if (profile.loadTons != null) form.approvedLoadKg = Math.round(profile.loadTons * 1000)
  }

  const validateRequired = (): boolean => {
    if (
      !form.plateNo.trim() ||
      !form.plateColor ||
      !form.vehicleTypeProfileId ||
      !form.ownerName?.trim()
    ) {
      activeImage.value = 'licenseFrontUrl'
      saveError.value = '请填写车牌号、车牌颜色、挂车车型和行驶证所有人，再保存档案'
      ElMessage.warning('请填写车牌号、车牌颜色、挂车车型和行驶证所有人')
      return false
    }
    return true
  }
  const handleSubmit = async (): Promise<boolean> => {
    saveError.value = ''
    if (!validateRequired()) return false
    const { id, ...values } = toRaw(form)
    const payload: TrailerWritePayload = {
      ...values,
      plateNo: values.plateNo.trim().toUpperCase(),
      vin: normalizeNullableText(values.vin),
      ownerName: normalizeNullableText(values.ownerName),
      brandModel: normalizeNullableText(values.brandModel),
      archiveNo: normalizeNullableText(values.archiveNo),
      remark: normalizeNullableText(values.remark),
      curbWeightKg: normalizeNullableNumber(values.curbWeightKg),
      approvedLoadKg: normalizeNullableNumber(values.approvedLoadKg),
      lengthMm: normalizeNullableNumber(values.lengthMm),
      widthMm: normalizeNullableNumber(values.widthMm),
      heightMm: normalizeNullableNumber(values.heightMm)
    }
    try {
      const result = await saveTrailer(id, payload)
      if (result.error) throw result.error
      emit('success')
      return true
    } catch (error) {
      saveError.value = getFriendlySupabaseErrorMessage(
        error,
        '挂车档案保存失败，请检查默认牵引车、所属公司与影像后重试'
      )
      notifyFriendlyError(error, saveError.value)
      return false
    }
  }

  const handleOpen = async (row?: TrailerRecord): Promise<void> => {
    saveError.value = ''
    recordTenantId.value = row?.tenantId ?? null
    const initial = emptyForm()
    replaceReactiveModel(form, row ? { ...initial, ...pick(row, Object.keys(initial)) } : initial)
    activeImage.value = 'licenseFrontUrl'
    selectedTractor.value = row?.defaultTractorId
      ? [
          {
            id: row.defaultTractorId,
            plateNo: row.defaultTractorPlateNo ?? '牵引车',
            companyName: row.companyName ?? undefined
          }
        ]
      : []
    selectedCompany.value = form.companyOrganizationId
      ? [
          {
            id: form.companyOrganizationId,
            label: row?.companyName ?? '所属公司'
          }
        ]
      : []
    if (!row) {
      try {
        const result = await fetchTrailerCompanyOptions()
        if (result.error) throw result.error
        const defaultCompany = result.data?.find((company) => company.isDefault)
        if (defaultCompany) {
          form.companyOrganizationId = defaultCompany.id
          selectedCompany.value = [defaultCompany]
        }
      } catch (error) {
        notifyFriendlyError(error, '默认公司加载失败，可在表单中重新参选')
      }
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(row, {
      title: row ? '编辑挂车档案' : '添加挂车',
      confirmText: row ? '保存修改' : '保存档案',
      onConfirm: handleSubmit
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .trailer-dialog {
    display: grid;
    gap: 16px;
    min-width: 0;
  }

  .trailer-dialog__identity {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    background: var(--art-gray-100);
    border-radius: var(--art-surface-radius);
  }

  .trailer-dialog__identity-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    font-size: 19px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 12%, transparent);
    border-radius: var(--art-control-radius);
  }

  .trailer-dialog__identity strong {
    font-size: 15px;
    color: var(--art-gray-900);
  }

  .trailer-dialog__identity p {
    margin: 3px 0 0;
    font-size: 12px;
    color: var(--art-gray-700);
  }

  .trailer-dialog__workarea {
    display: grid;
    grid-template-columns: minmax(260px, 38%) minmax(0, 1fr);
    gap: 24px;
    min-width: 0;
  }

  .trailer-dialog__photos,
  .trailer-dialog__details {
    min-width: 0;
  }

  .trailer-dialog__section-heading {
    display: flex;
    gap: 8px;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .trailer-dialog__section-heading strong {
    font-size: 14px;
    color: var(--art-gray-900);
  }

  .trailer-dialog__section-heading span {
    font-size: 12px;
    color: var(--art-gray-600);
  }

  .trailer-dialog__photo-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }

  .trailer-dialog__photo-tabs button {
    display: flex;
    gap: 7px;
    align-items: center;
    min-height: 40px;
    padding: 8px 10px;
    color: var(--art-gray-700);
    text-align: left;
    cursor: pointer;
    background: var(--default-box-color);
    border: 1px solid var(--art-gray-200);
    border-radius: var(--art-control-radius);
  }

  .trailer-dialog__photo-tabs button span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trailer-dialog__photo-tabs button.is-active {
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
    border-color: var(--theme-color);
  }

  .trailer-dialog__photo-tabs button:focus-visible {
    outline: 2px solid var(--theme-color);
    outline-offset: 2px;
  }

  .trailer-dialog__done {
    margin-left: auto;
    color: var(--el-color-success);
  }

  .trailer-dialog__photo-preview {
    padding: 16px;
    background: var(--art-gray-100);
    border-radius: var(--art-surface-radius);
  }

  .trailer-dialog__photo-help {
    margin: 9px 0 0;
    font-size: 12px;
    color: var(--art-gray-600);
  }

  .trailer-dialog__picker {
    justify-content: space-between;
    width: 100%;
  }

  .trailer-dialog__picker-action {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    color: var(--theme-color);
  }

  @media (width <= 900px) {
    .trailer-dialog__workarea {
      grid-template-columns: 1fr;
    }
  }
</style>
