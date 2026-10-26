<template>
  <ArtDialog ref="dialogRef" size="lg" :show-fullscreen-button="false">
    <template #subtitle>先录入车辆身份和车型，保存后可继续完善证照、司机与运营资料。</template>
    <div class="grid gap-6 sm:grid-cols-[120px_minmax(0,1fr)]">
      <div class="flex flex-col gap-3">
        <span class="text-sm text-[var(--el-text-color-regular)]">车辆图片</span>
        <ArtUploadImage
          v-model="form.vehiclePhotoUrl"
          :resource-tenant-id="form.tenantId"
          title="车辆图片"
          :size="120"
          :limit="1"
          :readonly="!form.tenantId"
        />
      </div>
      <ArtForm
        ref="formRef"
        :model-value="form"
        @update:model-value="replaceReactiveModel(form, $event)"
        :items="formItems"
        :rules="rules"
        :span="12"
        :gutter="20"
        label-width="110px"
        :show-reset="false"
        :show-submit="false"
        tenant-scope-mode="manual"
      >
        <template #vehicleTypeProfileId>
          <ElButton
            class="w-full justify-start!"
            :disabled="!form.tenantId"
            @click="openVehicleTypePicker"
          >
            <span class="min-w-0 flex-1 truncate text-left">{{
              form.vehicleTypeProfileId
                ? `${form.vehicleType} · ${form.specLengthM ?? form.loadTons}${form.specLengthM == null ? ' 吨' : ' 米'}`
                : '参选车型与规格'
            }}</span>
            <ArtSvgIcon icon="ri:arrow-right-s-line" aria-hidden="true" />
          </ElButton>
        </template>
      </ArtForm>
    </div>
    <div
      class="grid grid-cols-1 gap-3 rounded-[var(--art-control-radius)] bg-[var(--el-fill-color-light)] p-4 text-sm sm:grid-cols-3"
    >
      <div
        ><span class="text-[var(--el-text-color-secondary)]">规格 / 车长</span
        ><strong class="mt-1 block">{{ metric(form.specLengthM, '米') }}</strong></div
      >
      <div
        ><span class="text-[var(--el-text-color-secondary)]">容积</span
        ><strong class="mt-1 block">{{ metric(form.volumeM3, '立方米') }}</strong></div
      >
      <div
        ><span class="text-[var(--el-text-color-secondary)]">载重</span
        ><strong class="mt-1 block">{{ metric(form.loadTons, '吨') }}</strong></div
      >
    </div>
    <VehicleTypePicker ref="vehicleTypePickerRef" @selected="handleVehicleTypeSelected" />
  </ArtDialog>
</template>

<script setup lang="ts">
  import type { FormRules } from 'element-plus'
  import { ElButton } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { replaceReactiveModel } from '@/utils/form/model'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { addVehicleArchive } from '@vms/api'
  import VehicleTypePicker from '../../vehicle-archive-edit/modules/vehicle-type-picker.vue'
  import type { VehicleTypeProfile } from '../../vehicle-archive-edit/modules/vehicle-type-catalog'

  interface QuickCreateForm {
    tenantId: string
    plateNo: string
    plateColor: string
    vehicleOwnership: string
    vehicleType: string
    vehicleTypeProfileId: string
    vehiclePhotoUrl: string
    specLengthM: number | null
    volumeM3: number | null
    loadTons: number | null
  }

  const emit = defineEmits<{ created: [id: string] }>()
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const dialogRef = ref<ArtDialogExpose<QuickCreateForm>>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: (key?: string) => void }>()
  const vehicleTypePickerRef = ref<{
    handleOpen: (data: { tenantId?: string; selectedId?: string | null }) => Promise<void>
  }>()
  const createForm = (): QuickCreateForm => ({
    tenantId: tenantScopeStore.effectiveTenantId ?? userStore.getUserInfo.tenantId ?? '',
    plateNo: '',
    plateColor: '',
    vehicleOwnership: 'self_operated',
    vehicleType: '',
    vehicleTypeProfileId: '',
    vehiclePhotoUrl: '',
    specLengthM: null,
    volumeM3: null,
    loadTons: null
  })
  const form = reactive<QuickCreateForm>(createForm())
  const ownershipOptions = useDictionaryOptions('vehicleOwnership')
  const plateColorOptions = useDictionaryOptions('vehiclePlateColor')
  const tenantOptions = computed(() => [
    {
      label: userStore.getUserInfo.tenant?.tenantName ?? '平台租户',
      value: userStore.getUserInfo.tenantId ?? ''
    },
    ...tenantScopeStore.tenantOptions
      .filter((tenant) => tenant.id !== userStore.getUserInfo.tenantId)
      .map((tenant) => ({ label: tenant.tenantName, value: tenant.id }))
  ])
  const formItems = computed<FormItem[]>(() => [
    {
      label: '车牌号码',
      key: 'plateNo',
      type: 'input',
      props: { maxlength: 20, clearable: true, placeholder: '请输入车牌号码' }
    },
    {
      label: '车牌颜色',
      key: 'plateColor',
      type: 'select',
      props: { options: plateColorOptions, placeholder: '请选择车牌颜色' }
    },
    {
      label: '车辆归属',
      key: 'vehicleOwnership',
      type: 'select',
      props: { options: ownershipOptions, placeholder: '请选择车辆归属' }
    },
    {
      label: '所属租户',
      key: 'tenantId',
      type: 'select',
      props: {
        options: tenantOptions.value,
        filterable: true,
        disabled: tenantOptions.value.length < 2,
        onChange: clearVehicleType
      }
    },
    { label: '车辆类型', key: 'vehicleTypeProfileId', type: 'input', span: 24 }
  ])
  const rules: FormRules<QuickCreateForm> = {
    tenantId: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
    plateNo: [{ required: true, message: '请输入车牌号码', trigger: 'blur' }],
    plateColor: [{ required: true, message: '请选择车牌颜色', trigger: 'change' }],
    vehicleOwnership: [{ required: true, message: '请选择车辆归属', trigger: 'change' }],
    vehicleTypeProfileId: [{ required: true, message: '请选择车辆类型与规格', trigger: 'change' }]
  }

  const metric = (value: number | null, unit: string): string =>
    value == null ? '参选后带入' : `${value} ${unit}`
  const clearVehicleType = (): void => {
    form.vehicleType = ''
    form.vehicleTypeProfileId = ''
    form.specLengthM = null
    form.volumeM3 = null
    form.loadTons = null
  }
  const openVehicleTypePicker = (): void => {
    void vehicleTypePickerRef.value?.handleOpen({
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
    formRef.value?.clearValidate('vehicleTypeProfileId')
  }
  const handleOpen = async (): Promise<void> => {
    Object.assign(form, createForm())
    await Promise.all([
      userStore.ensureDictLoaded('vehicleOwnership'),
      userStore.ensureDictLoaded('vehiclePlateColor'),
      tenantScopeStore.loadTenantOptions()
    ])
    await dialogRef.value?.handleOpen(form, {
      title: '新增车辆档案',
      confirmText: '保存并完善资料',
      onConfirm: async () => {
        if (!(await formRef.value?.validate().catch(() => false))) return false
        const result = await addVehicleArchive(
          {
            tenantId: form.tenantId,
            plateNo: form.plateNo.trim(),
            plateColor: form.plateColor,
            vehicleOwnership: form.vehicleOwnership,
            vehicleType: form.vehicleType,
            vehicleTypeProfileId: form.vehicleTypeProfileId,
            vehiclePhotoUrl: form.vehiclePhotoUrl,
            operationStatus: 'operating'
          },
          { showMessage: false }
        )
        if (!result.data?.id) throw new Error('车辆档案创建成功，但未返回档案 ID')
        emit('created', result.data.id)
        return true
      }
    })
  }

  defineExpose({ handleOpen })
</script>
