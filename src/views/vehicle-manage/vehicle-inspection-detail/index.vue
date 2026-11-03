<template>
  <ArtPageShell
    class="vehicle-inspection-detail min-h-full p-4 bg-[var(--default-box-color)]"
    :loading="page.loading"
    loading-mode="skeleton"
    :error="page.error"
    :empty="!detail.data"
    empty-text="暂无车辆年检详情"
    empty-description="请返回车辆年检列表重新选择，或刷新后重试。"
    @retry="loadDetail"
  >
    <ArtPageHeader
      :title="(canViewIdentifiers && detail.data?.inspectionNo) || '车辆年检详情'"
      :subtitle="
        [detail.data?.plateNo, detail.data?.companyName].filter(Boolean).join(' / ') || '--'
      "
      show-back
      @back="goBack"
    />

    <section
      class="vehicle-inspection-detail__summary art-card-xs mt-3 grid gap-4 p-4 grid-cols-2 min-[721px]:grid-cols-4"
    >
      <div class="vehicle-inspection-detail__summary-item flex min-w-0 flex-col gap-2">
        <span class="text-[var(--el-text-color-secondary)]">年检日期</span>
        <strong class="text-lg font-semibold wrap-anywhere">{{
          detail.data?.inspectionDate || '--'
        }}</strong>
      </div>
      <div class="vehicle-inspection-detail__summary-item flex min-w-0 flex-col gap-2">
        <span class="text-[var(--el-text-color-secondary)]">到期日期</span>
        <strong class="text-lg font-semibold wrap-anywhere">{{
          detail.data?.expireDate || '--'
        }}</strong>
      </div>
      <div
        class="vehicle-inspection-detail__summary-item flex min-w-0 flex-col gap-2"
        v-if="canViewAmounts"
      >
        <span class="text-[var(--el-text-color-secondary)]">年检金额</span>
        <strong class="text-lg font-semibold wrap-anywhere">{{
          formatSensitiveNumberWithAffix(detail.data?.inspectionAmount, { suffix: ' 元' })
        }}</strong>
      </div>
      <div
        class="vehicle-inspection-detail__summary-item flex min-w-0 flex-col gap-2"
        v-if="canViewDocuments"
      >
        <span class="text-[var(--el-text-color-secondary)]">附件数量</span>
        <strong class="text-lg font-semibold wrap-anywhere">{{
          detail.data?.attachments?.length ?? 0
        }}</strong>
      </div>
    </section>

    <div class="vehicle-inspection-detail__content art-card-xs mt-3 flex flex-col gap-6 p-5">
      <ArtPageSection title="年检信息" class="vehicle-inspection-detail__section">
        <ArtDescriptions
          :data="descriptionData"
          :items="descriptionItems"
          :columns="2"
          :label-width="128"
        />
      </ArtPageSection>

      <ArtPageSection
        title="年检附件"
        class="vehicle-inspection-detail__section"
        v-if="canViewDocuments"
      >
        <VehicleAttachmentTable
          :attachments="detail.data?.attachments ?? []"
          :name-min-width="180"
          :removable="false"
          empty-height="180px"
        />
      </ArtPageSection>
    </div>
  </ArtPageShell>
</template>

<script setup lang="ts">
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtPageSection from '@/components/core/layouts/art-page-section/index.vue'
  import VehicleAttachmentTable from '../vehicle-attachment-table.vue'
  import { fetchVehicleInspectionDetail } from '@vms/api'
  import { canViewField, formatSensitiveNumberWithAffix } from '@/utils/field-permission'

  defineOptions({ name: 'VehicleInspectionDetail' })

  type VehicleInspection = Api.Vms.VehicleManage.VehicleInspection

  const route = useRoute()
  const router = useRouter()
  const page = reactive<{ loading: boolean; error: Error | null }>({ loading: false, error: null })
  const detail = reactive<{ data?: VehicleInspection }>({ data: undefined })
  const canViewIdentifiers = computed(() =>
    canViewField(detail.data?.fieldAccess, 'inspectionIdentifiers')
  )
  const canViewAmounts = computed(() => canViewField(detail.data?.fieldAccess, 'monetaryAmounts'))
  const canViewDocuments = computed(() => canViewField(detail.data?.fieldAccess, 'documents'))
  const descriptionData = computed<Partial<VehicleInspection>>(() => detail.data ?? {})
  const descriptionItems = computed<ArtDescriptionItem<Partial<VehicleInspection>>[]>(() => [
    { key: 'plateNo', label: '车牌号', field: 'plateNo' },
    { key: 'companyName', label: '所属公司', field: 'companyName' },
    { key: 'inspectionDate', label: '年检日期', field: 'inspectionDate', format: 'date' },
    ...(canViewIdentifiers.value
      ? [{ key: 'inspectionNo', label: '年检号', field: 'inspectionNo', copyable: true }]
      : []),
    ...(canViewAmounts.value
      ? [
          {
            key: 'inspectionAmount',
            label: '年检金额',
            field: 'inspectionAmount',
            formatter: (value: unknown) =>
              formatSensitiveNumberWithAffix(value as number | string | null | undefined, {
                suffix: ' 元'
              })
          }
        ]
      : []),
    { key: 'vehicleOffice', label: '车管所', field: 'vehicleOffice' },
    { key: 'expireDate', label: '到期日期', field: 'expireDate', format: 'date' },
    { key: 'remark', label: '备注', field: 'remark' }
  ])

  onMounted(() => {
    void loadDetail()
  })

  const loadDetail = async (): Promise<void> => {
    const id = String(route.params.id || '')
    if (!id) {
      page.error = new Error('缺少年检记录标识')
      return
    }
    page.loading = true
    page.error = null
    try {
      const { data, error } = await fetchVehicleInspectionDetail(id, { showErrorMessage: false })
      if (error) throw error
      detail.data = data ? { ...data, attachments: data.attachments ?? [] } : undefined
    } catch (error) {
      page.error =
        error instanceof Error
          ? error
          : new Error(getFriendlySupabaseErrorMessage(error, '车辆年检详情加载失败'), {
              cause: error
            })
    } finally {
      page.loading = false
    }
  }

  const goBack = (): void => {
    void router.push('/vms/vehicle-manage/vehicle-inspection')
  }
</script>
