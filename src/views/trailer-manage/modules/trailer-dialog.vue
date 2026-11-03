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
            v-model:active-tab="activeTab"
            v-model="form"
            :items="visibleItems"
            :rules="rules"
            :span="12"
            :gutter="16"
            label-width="116px"
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
    </div>

    <VehicleTypePicker ref="typePickerRef" @selected="selectProfile" />
  </ArtDialog>
</template>

<script setup lang="ts">
  import { h } from 'vue'
  import { ElAlert, ElButton, ElMessage, type FormRules } from 'element-plus'
  import { pick } from 'lodash-es'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import type {
    DataSelectColumn,
    DataSelectFetchParams
  } from '@/components/core/forms/art-data-select/types'
  import VehicleTypePicker from '../../vehicle-archive-edit/modules/vehicle-type-picker.vue'
  import { vehicleTypeProfileLabel } from '../../vehicle-archive-edit/modules/vehicle-type-catalog'
  import type { VehicleTypeProfile } from '@vms/types/vehicle-type'
  import type { TrailerRecord, TrailerTractorOption, TrailerWritePayload } from '@vms/types/trailer'
  import {
    fetchTrailerTractorOptions,
    fetchVehicleArchiveDetail,
    fetchVmsAssetCompanyOptions,
    fetchVmsAssetCarrierReferences,
    saveTrailer,
    uploadTrailerPrivateImage
  } from '@vms/api'
  import type { VmsCarrierReference } from '@vms/api/integration'
  import { replaceReactiveModel } from '@/utils/form/model'
  import { normalizeNullableText, normalizeNullableNumber } from '@/utils/form/normalize'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useUserStore } from '@/store/modules/user'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import { copyTextToClipboard } from '@/utils/file/clipboard'

  type ImageKey = 'licenseFrontUrl' | 'licenseBackUrl' | 'licenseBackReverseUrl' | 'rearPhotoUrl'
  type TrailerForm = TrailerWritePayload & { id: string | null }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<TrailerRecord | undefined>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const typePickerRef = ref<{
    handleOpen: (data: { tenantId?: string; selectedId?: string | null }) => Promise<void>
  }>()
  const tenantScopeStore = useTenantScopeStore()
  const userStore = useUserStore()
  const plateColors = useDictionaryOptions('vehiclePlateColor')
  const ownershipOptions = useDictionaryOptions('vehicleOwnership')
  const activeImage = ref<ImageKey>('licenseFrontUrl')
  const activeTab = ref('licenseFrontSection')
  const saveError = ref('')
  const recordTenantId = ref<string | null>(null)
  const selectedTractor = ref<TrailerTractorOption[]>([])
  const carrierOptions = ref<VmsCarrierReference[]>([])

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
    tractorIds: [],
    carrierId: null,
    companyName: null,
    companyOrganizationId: null,
    source: null,
    remark: null,
    licenseFrontUrl: null,
    licenseBackUrl: null,
    licenseBackReverseUrl: null,
    rearPhotoUrl: null
  })
  const form = ref<TrailerForm>(emptyForm())
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
  const filledImageCount = computed(() => imageItems.filter((item) => form.value[item.key]).length)
  const tractorIds = computed({
    get: () => form.value.tractorIds,
    set: (value: string[] | number[] | undefined) => {
      form.value.tractorIds = (value ?? []).map(String)
      if (!form.value.tractorIds.includes(form.value.defaultTractorId ?? '')) {
        form.value.defaultTractorId = form.value.tractorIds[0] ?? null
      }
    }
  })

  const tractorColumns: DataSelectColumn<TrailerTractorOption>[] = [
    { prop: 'plateNo', label: '车牌号', width: 150 },
    { prop: 'vehicleType', label: '车型', minWidth: 160 },
    {
      prop: 'ownership',
      label: '车辆归属',
      minWidth: 110,
      dict: { code: 'vehicleOwnership', display: 'auto' }
    },
    { prop: 'carrierName', label: '所属承运商', minWidth: 150 },
    { prop: 'driverName', label: '司机', minWidth: 100 },
    { prop: 'driverPhone', label: '电话', minWidth: 130 },
    { prop: 'companyName', label: '所属公司', minWidth: 150 },
    {
      prop: 'isDefault',
      label: '默认值',
      width: 85,
      formatter: (row) => (row.isDefault ? '当前默认' : '—')
    }
  ]
  const fetchTractorOptions = async (params: DataSelectFetchParams) => {
    const from = (params.page - 1) * params.pageSize
    const result = await fetchTrailerTractorOptions({
      trailerId: form.value.id,
      tenantId: resourceTenantId.value,
      keyword: params.keyword,
      from,
      to: from + params.pageSize - 1
    })
    return { data: result.data ?? [], total: result.total, error: result.error }
  }
  const loadCarrierOptions = async () => {
    const result = await fetchVmsAssetCarrierReferences({
      trailerId: form.value.id,
      tenantId: resourceTenantId.value
    })
    if (!result.error) carrierOptions.value = result.data ?? []
    return result
  }
  const copyCarrier = async () => {
    const carrier = carrierOptions.value.find((item) => item.id === form.value.carrierId)
    if (!carrier) return
    try {
      await copyTextToClipboard(carrier.companyName)
      ElMessage.success('已复制承运商名称')
    } catch (error) {
      ElMessage.error(getFriendlySupabaseErrorMessage(error, '复制失败，请手动复制承运商名称'))
    }
  }

  const rules: FormRules<TrailerForm> = {
    plateNo: [{ required: true, whitespace: true, message: '请输入挂车车牌号', trigger: 'blur' }],
    plateColor: [{ required: true, message: '请选择车牌颜色', trigger: 'change' }],
    vehicleTypeProfileId: [{ required: true, message: '请选择挂车车型', trigger: 'change' }],
    ownerName: [
      { required: true, whitespace: true, message: '请输入行驶证所有人', trigger: 'blur' }
    ],
    ownership: [{ required: true, message: '请选择车辆归属', trigger: 'change' }],
    defaultTractorId: [
      {
        validator: (_rule, value, callback) => {
          if (form.value.tractorIds.length && !value) callback(new Error('请指定一辆默认牵引车'))
          else callback()
        },
        trigger: 'change'
      }
    ]
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
  const otherItems = computed<FormItem[]>(() => [
    {
      label: '车辆归属',
      key: 'ownership',
      type: 'radioGroup',
      span: 24,
      props: { options: ownershipOptions, optionType: 'button' }
    },
    {
      label: '牵引车',
      key: 'tractorIds',
      type: 'dataSelect',
      span: 24,
      props: {
        mode: 'table',
        multiple: true,
        modelValue: tractorIds.value,
        'onUpdate:modelValue': (value: string[] | number[] | undefined) => {
          tractorIds.value = value
        },
        selectedData: selectedTractor.value,
        'onUpdate:selectedData': (value: typeof selectedTractor.value) => {
          selectedTractor.value = value
        },
        apiFn: fetchTractorOptions,
        columns: tractorColumns,
        rowKey: 'id',
        labelKey: 'plateNo',
        descriptionKey: 'companyName',
        title: '参选牵引车',
        searchPlaceholder: '输入牵引车车牌号',
        placeholder: '请选择牵引车（可多选）',
        clearable: true,
        showSelectedPanel: false,
        showTableHeader: true,
        showPagination: Boolean(fetchTractorOptions)
      }
    },
    {
      label: '默认牵引车',
      key: 'defaultTractorId',
      type: 'radioGroup',
      span: 24,
      props: {
        options: selectedTractor.value.map((item) => ({ label: item.plateNo, value: item.id })),
        optionType: 'button'
      },
      description: selectedTractor.value.length
        ? '已参选车辆中只能指定一辆默认牵引车。'
        : '先参选牵引车，再指定默认值。'
    },
    {
      label: () =>
        h('span', { class: 'art-icon-label' }, [
          h('span', '所属承运商'),
          h(
            ElButton,
            {
              link: true,
              type: 'primary',
              size: 'small',
              disabled: !form.value.carrierId,
              title: '复制承运商名称',
              'aria-label': '复制承运商名称',
              onClick: copyCarrier
            },
            () => '复制'
          )
        ]),
      key: 'carrierId',
      type: 'select',
      span: 24,
      api: loadCarrierOptions,
      resultField: 'data',
      labelField: 'companyName',
      valueField: 'id',
      props: {
        filterable: true,
        clearable: true,
        placeholder: '请选择所属承运商（选填）',
        onChange: (value?: string) => {
          const carrier = carrierOptions.value.find((item) => item.id === value)
          if (carrier) {
            form.value.companyName = carrier.companyName
            form.value.companyOrganizationId = null
            form.value.ownership = 'carrier'
          }
        }
      }
    },
    {
      label: '所属公司',
      key: 'companyName',
      type: 'input',
      span: 24,
      props: {
        maxlength: 100,
        placeholder: '请输入所属公司',
        onInput: () => {
          form.value.companyOrganizationId = null
        }
      },
      description: '默认为租户法人公司，可按实际归属修改。'
    },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 2, maxlength: 500 }
    }
  ])
  const visibleItems = computed<FormItem[]>(() => [
    { key: 'licenseFrontSection', label: '行驶证主页', type: 'tab' },
    ...frontItems.value,
    { key: 'licenseBackSection', label: '副页与尺寸', type: 'tab' },
    ...backItems,
    { key: 'relationshipSection', label: '归属与关系', type: 'tab' },
    ...otherItems.value
  ])
  watch(activeImage, (image) => {
    activeTab.value = image === 'licenseBackUrl' ? 'licenseBackSection' : 'licenseFrontSection'
  })
  watch(activeTab, (tab) => {
    if (tab === 'licenseBackSection') activeImage.value = 'licenseBackUrl'
    else if (tab === 'licenseFrontSection' && activeImage.value === 'licenseBackUrl')
      activeImage.value = 'licenseFrontUrl'
  })

  const openTypePicker = async () => {
    await typePickerRef.value?.handleOpen({
      tenantId: resourceTenantId.value,
      selectedId: form.value.vehicleTypeProfileId
    })
  }
  const selectProfile = (profile: VehicleTypeProfile) => {
    form.value.vehicleTypeProfileId = profile.id
    form.value.trailerType = vehicleTypeProfileLabel(profile)
    if (profile.lengthM != null) form.value.lengthMm = Math.round(profile.lengthM * 1000)
    if (profile.loadTons != null) form.value.approvedLoadKg = Math.round(profile.loadTons * 1000)
  }

  const handleSubmit = async (): Promise<boolean> => {
    saveError.value = ''
    if (!(await validateArtFormForSubmit(formRef.value))) return false
    const { id, ...values } = toRaw(form.value)
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

  const handleOpen = async (row?: TrailerRecord, vehicleId?: string): Promise<void> => {
    activeTab.value = 'licenseFrontSection'
    saveError.value = ''
    recordTenantId.value = row?.tenantId ?? null
    const initial = emptyForm()
    replaceReactiveModel(
      form.value,
      row ? { ...initial, ...pick(row, Object.keys(initial)) } : initial
    )
    activeImage.value = 'licenseFrontUrl'
    selectedTractor.value = row?.tractors ?? []
    if (!row && vehicleId) {
      const vehicleResult = await fetchVehicleArchiveDetail(vehicleId)
      if (vehicleResult.error || !vehicleResult.data) {
        notifyFriendlyError(vehicleResult.error, '关联车辆加载失败，请重试')
        return
      }
      recordTenantId.value = vehicleResult.data.tenantId ?? null
      form.value.tractorIds = [vehicleId]
      form.value.defaultTractorId = vehicleId
      selectedTractor.value = [
        {
          id: vehicleId,
          plateNo: vehicleResult.data.plateNo ?? '牵引车',
          vehicleType: vehicleResult.data.vehicleType ?? null,
          ownership: vehicleResult.data.vehicleOwnership ?? null,
          carrierName: vehicleResult.data.carrier?.companyName ?? null,
          driverName: vehicleResult.data.primaryDriver?.driverName ?? null,
          driverPhone: vehicleResult.data.primaryDriver?.phone ?? null,
          companyName: vehicleResult.data.companyName ?? null,
          isDefault: true
        }
      ]
    }
    if (!row) {
      try {
        const result = await fetchVmsAssetCompanyOptions({ tenantId: resourceTenantId.value })
        if (result.error) throw result.error
        const defaultCompany = result.data?.find((company) => company.isDefault)
        if (defaultCompany) {
          form.value.companyOrganizationId = defaultCompany.id
          form.value.companyName = defaultCompany.label
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
