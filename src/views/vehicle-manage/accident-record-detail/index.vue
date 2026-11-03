<template>
  <ArtPageShell
    class="accident-record-detail min-h-full p-4 bg-[var(--default-box-color)]"
    :loading="page.loading"
    loading-mode="skeleton"
    :error="page.error"
    :empty="!detail.data"
    empty-text="暂无事故记录详情"
    empty-description="请返回事故记录列表重新选择，或刷新后重试。"
    @retry="loadDetail"
  >
    <ArtPageHeader
      :title="detail.data?.plateNo || '事故记录详情'"
      :subtitle="detail.data?.companyName || '--'"
      show-back
      @back="goBack"
    />

    <section
      class="accident-record-detail__summary art-card-xs mt-3 grid gap-4 p-4 min-[901px]:grid-cols-3"
    >
      <div class="accident-record-detail__summary-item flex min-w-0 flex-col gap-2">
        <span class="text-[var(--el-text-color-secondary)]">事故时间</span>
        <strong class="text-lg font-semibold wrap-anywhere">{{
          formatArtValue(detail.data?.accidentTime, 'datetime')
        }}</strong>
      </div>
      <div class="accident-record-detail__summary-item flex min-w-0 flex-col gap-2">
        <span class="text-[var(--el-text-color-secondary)]">{{
          canViewLossAmounts ? '经济损失' : '事故等级'
        }}</span>
        <strong class="text-lg font-semibold wrap-anywhere">
          {{
            canViewLossAmounts
              ? formatSensitiveNumberWithAffix(detail.data?.economicLoss, { suffix: ' 元' })
              : formatArtValue(detail.data?.damageLevel)
          }}
        </strong>
      </div>
      <div class="accident-record-detail__summary-item flex min-w-0 flex-col gap-2">
        <span class="text-[var(--el-text-color-secondary)]">处理状态</span>
        <strong class="text-lg font-semibold wrap-anywhere">
          <ArtDictDisplay
            dict-code="vehicleRecordProcessed"
            :value="getBooleanDictValue(detail.data?.processed)"
            display="auto"
          />
        </strong>
      </div>
    </section>

    <div class="accident-record-detail__content art-card-xs mt-3 flex flex-col gap-6 p-5">
      <ArtPageSection title="基础信息" class="accident-record-detail__section">
        <ArtDescriptions
          :data="descriptionData"
          :items="basicItems"
          :columns="2"
          :label-width="128"
        />
      </ArtPageSection>

      <ArtPageSection title="责任及处理" class="accident-record-detail__section">
        <ArtDescriptions
          :data="descriptionData"
          :items="responsibilityItems"
          :columns="2"
          :label-width="128"
        />
      </ArtPageSection>

      <ArtPageSection title="备注" v-if="canViewNarrative" class="accident-record-detail__section">
        <div
          class="accident-record-detail__remark min-h-12 rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-lighter)] px-3.5 py-3 leading-relaxed text-[var(--el-text-color-regular)] wrap-anywhere whitespace-pre-wrap"
          >{{ formatArtValue(detail.data?.remark) }}</div
        >
      </ArtPageSection>

      <ArtPageSection
        title="事故附件"
        v-if="canViewDocuments"
        class="accident-record-detail__section"
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
  import { formatCoordinateValue } from '@/utils/ui/coordinates'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import { formatArtValue, formatPercentValue } from '@/utils/ui/format'
  import { isNil } from 'lodash-es'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPageSection from '@/components/core/layouts/art-page-section/index.vue'
  import VehicleAttachmentTable from '../vehicle-attachment-table.vue'
  import { fetchVehicleAccidentDetail } from '@vms/api'
  import { canViewField, formatSensitiveNumberWithAffix } from '@/utils/field-permission'

  defineOptions({ name: 'VehicleAccidentDetail' })

  type AccidentRecord = Api.Vms.VehicleManage.VehicleAccidentRecord

  const route = useRoute()
  const router = useRouter()
  const page = reactive<{ loading: boolean; error: Error | null }>({ loading: false, error: null })
  const detail = reactive<{ data?: AccidentRecord }>({ data: undefined })
  const canViewDriverContact = computed(() =>
    canViewField(detail.data?.fieldAccess, 'driverContact')
  )
  const canViewLocation = computed(() => canViewField(detail.data?.fieldAccess, 'accidentLocation'))
  const canViewNarrative = computed(() =>
    canViewField(detail.data?.fieldAccess, 'accidentNarrative')
  )
  const canViewLossAmounts = computed(() => canViewField(detail.data?.fieldAccess, 'lossAmounts'))
  const canViewDocuments = computed(() => canViewField(detail.data?.fieldAccess, 'documents'))
  const descriptionData = computed<Partial<AccidentRecord>>(() => detail.data ?? {})
  const basicItems = computed<ArtDescriptionItem<Partial<AccidentRecord>>[]>(() => [
    { key: 'plateNo', label: '车牌号', field: 'plateNo' },
    { key: 'companyName', label: '所属公司', field: 'companyName' },
    ...(canViewDriverContact.value
      ? [
          { key: 'driverName', label: '驾驶员', field: 'driverName' },
          { key: 'driverPhone', label: '联系方式', field: 'driverPhone' }
        ]
      : []),
    { key: 'accidentTime', label: '事故时间', field: 'accidentTime', format: 'datetime' },
    ...(canViewLocation.value
      ? [
          { key: 'accidentLocation', label: '事故地点', field: 'accidentLocation' },
          {
            key: 'accidentCoordinate',
            label: '事故坐标',
            value: (data: Partial<AccidentRecord>) =>
              formatCoordinateValue(data.accidentLongitude, data.accidentLatitude, {
                fractionDigits: 7
              })
          }
        ]
      : []),
    { key: 'damageLevel', label: '事故等级', field: 'damageLevel' },
    ...(canViewNarrative.value
      ? [{ key: 'accidentSummary', label: '事故概述', field: 'accidentSummary', span: 2 }]
      : [])
  ])
  const responsibilityItems = computed<ArtDescriptionItem<Partial<AccidentRecord>>[]>(() => [
    {
      key: 'responsibilityType',
      label: '责任类型',
      field: 'responsibilityType',
      dictCode: 'vehicleAccidentResponsibility',
      dictDisplay: 'text'
    },
    {
      key: 'responsibilityPercent',
      label: '责任比例',
      field: 'responsibilityPercent',
      formatter: (value) =>
        formatPercentValue(value, {
          numberFormat: { useGrouping: false, maximumFractionDigits: 20 }
        })
    },
    ...(canViewLossAmounts.value
      ? [
          {
            key: 'economicLoss',
            label: '经济损失',
            field: 'economicLoss',
            formatter: (value: unknown) =>
              formatSensitiveNumberWithAffix(value as number | string | null | undefined, {
                suffix: ' 元'
              })
          },
          {
            key: 'companyBearAmount',
            label: '公司承担',
            field: 'companyBearAmount',
            formatter: (value: unknown) =>
              formatSensitiveNumberWithAffix(value as number | string | null | undefined, {
                suffix: ' 元'
              })
          }
        ]
      : []),
    ...(['reported', 'insuranceReported', 'processed'] as const).map((field) => ({
      key: field,
      label: { reported: '是否报案', insuranceReported: '保险报案', processed: '已处理' }[field],
      field,
      value: (data: Partial<AccidentRecord>) => getBooleanDictValue(data[field]),
      dictCode: field === 'processed' ? 'vehicleRecordProcessed' : 'commonBoolean',
      dictDisplay: field === 'processed' ? ('auto' as const) : ('text' as const)
    })),
    {
      key: 'dataSource',
      label: '数据来源',
      field: 'dataSource',
      dictCode: 'vehicleAccidentDataSource',
      dictDisplay: 'text'
    }
  ])

  onMounted(() => {
    void loadDetail()
  })

  const loadDetail = async (): Promise<void> => {
    const id = String(route.params.id || '')
    if (!id) {
      page.error = new Error('缺少事故记录标识')
      return
    }
    page.loading = true
    page.error = null
    try {
      const { data, error } = await fetchVehicleAccidentDetail(id, { showErrorMessage: false })
      if (error) throw error
      detail.data = data ? { ...data, attachments: data.attachments ?? [] } : undefined
    } catch (error) {
      page.error =
        error instanceof Error
          ? error
          : new Error(getFriendlySupabaseErrorMessage(error, '事故记录详情加载失败'), {
              cause: error
            })
    } finally {
      page.loading = false
    }
  }

  const goBack = (): void => {
    void router.push('/vms/vehicle-manage/accident-record')
  }

  const getBooleanDictValue = (value?: boolean | null): string | undefined =>
    isNil(value) ? undefined : String(value)
</script>
