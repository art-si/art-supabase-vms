<template>
  <ArtPageShell
    class="maintenance-record-detail min-h-full p-4 bg-[var(--default-box-color)]"
    :loading="page.loading"
    loading-mode="skeleton"
    :error="page.error"
    :empty="!detail.data"
    empty-text="暂无维修保养详情"
    empty-description="请返回维修保养列表重新选择，或刷新后重试。"
    @retry="loadDetail"
  >
    <ArtPageHeader
      :title="(canViewIdentifiers && detail.data?.maintenanceNo) || '维修保养详情'"
      :subtitle="
        [detail.data?.plateNo, detail.data?.companyName].filter(Boolean).join(' / ') || '--'
      "
      show-back
      @back="goBack"
    />

    <section
      class="maintenance-record-detail__summary art-card-xs mt-3 grid gap-4 p-4 min-[901px]:grid-cols-3"
    >
      <div class="maintenance-record-detail__summary-item flex min-w-0 flex-col gap-2">
        <span class="text-[var(--el-text-color-secondary)]">维修类型</span>
        <strong class="text-lg font-semibold wrap-anywhere">
          <ArtDictDisplay
            dict-code="vehicleMaintenanceType"
            :value="detail.data?.maintenanceType"
            display="auto"
          />
        </strong>
      </div>
      <div
        v-if="canViewTotalCost"
        class="maintenance-record-detail__summary-item flex min-w-0 flex-col gap-2"
      >
        <span class="text-[var(--el-text-color-secondary)]">总费用（元）</span>
        <strong class="text-lg font-semibold wrap-anywhere">{{
          formatSensitiveNumberWithAffix(detail.data?.costAmount, { suffix: ' 元' })
        }}</strong>
      </div>
      <div
        class="maintenance-record-detail__summary-item flex min-w-0 flex-col gap-2"
        v-if="canViewMaintenanceItems"
      >
        <span class="text-[var(--el-text-color-secondary)]">维修项目数</span>
        <strong class="text-lg font-semibold wrap-anywhere">{{
          detail.data?.items?.length ?? 0
        }}</strong>
      </div>
    </section>

    <div class="maintenance-record-detail__content art-card-xs mt-3 flex flex-col gap-6 p-5">
      <ArtPageSection
        v-if="canViewTotalCost"
        title="单车成本归集"
        class="maintenance-record-detail__section"
      >
        <ElSkeleton v-if="sourceCost.loading" :rows="2" animated />
        <div v-else-if="sourceCost.error" class="flex flex-wrap items-center gap-3">
          <span class="text-sm text-[var(--el-color-danger)]">{{ sourceCost.error }}</span>
          <ElButton type="primary" link @click="loadCostSource(String(detail.data?.id || ''))"
            >重试</ElButton
          >
        </div>
        <div
          v-else-if="sourceCost.data"
          class="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--el-fill-color-light)] px-4 py-3"
        >
          <ElTag
            :type="sourceCost.data.recognitionStatus === 'approved' ? 'success' : 'warning'"
            effect="light"
          >
            {{ sourceCostStatusLabel }}
          </ElTag>
          <span class="text-sm text-[var(--el-text-color-regular)]">
            {{
              sourceCost.data.recognitionStatus === 'unlinked'
                ? '维保费用已记录，等待关联并审核费用单。'
                : sourceCost.data.recognitionStatus === 'pending_review'
                  ? '费用单已关联，待审核通过后计入单车成本。'
                  : '费用单已审核，计入单车成本。'
            }}
          </span>
          <ElButton
            v-if="sourceCost.data.linkedCostId && canViewFinanceCost"
            type="primary"
            link
            @click="openLinkedCost"
          >
            查看关联费用单{{
              sourceCost.data.linkedCostNo ? ` · ${sourceCost.data.linkedCostNo}` : ''
            }}
          </ElButton>
        </div>
        <p v-else class="text-sm text-[var(--el-text-color-secondary)]">暂无可归集的维保费用。</p>
      </ArtPageSection>
      <ArtPageSection title="基础信息" class="maintenance-record-detail__section">
        <ArtDescriptions
          :data="descriptionData"
          :items="descriptionItems"
          :columns="2"
          :label-width="128"
        />
      </ArtPageSection>

      <ArtPageSection
        title="维修项目"
        v-if="canViewMaintenanceItems"
        class="maintenance-record-detail__section"
      >
        <ArtTable
          :data="detail.data?.items ?? []"
          :columns="itemColumns"
          :pagination="undefined"
          :show-table-header="false"
          empty-height="180px"
        />
      </ArtPageSection>

      <ArtPageSection title="备注" class="maintenance-record-detail__section">
        <div
          class="maintenance-record-detail__remark min-h-12 rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-lighter)] px-3.5 py-3 leading-relaxed text-[var(--el-text-color-regular)] wrap-anywhere whitespace-pre-wrap"
          >{{ formatArtValue(detail.data?.remark) }}</div
        >
      </ArtPageSection>

      <ArtPageSection
        title="维修附件"
        class="maintenance-record-detail__section"
        v-if="canViewDocuments"
      >
        <ArtTable
          :data="detail.data?.attachments ?? []"
          :columns="attachmentColumns"
          :pagination="undefined"
          :show-table-header="false"
          empty-height="180px"
        />
      </ArtPageSection>
    </div>
  </ArtPageShell>
</template>

<script setup lang="tsx">
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import BusinessAttachmentRowActions from '@/components/business/business-attachment-row-actions/index.vue'
  import { formatArtValue } from '@/utils/ui/format'
  import { isNil } from 'lodash-es'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPageSection from '@/components/core/layouts/art-page-section/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    fetchVehicleMaintenanceCostSource,
    fetchVehicleMaintenanceDetail,
    type VehicleMaintenanceCostSource
  } from '@vms/api'
  import { getWaybillCostDetailPath } from '@/router/business-paths'
  import { useAuth } from '@/hooks/core/useAuth'
  import { attachmentTableLink } from '@/components/core/media/art-file-viewer/table-link'
  import { canViewField, formatSensitiveNumberWithAffix } from '@/utils/field-permission'

  defineOptions({ name: 'VehicleMaintenanceDetail' })

  type MaintenanceRecord = Api.Vms.VehicleManage.VehicleMaintenanceRecord
  type MaintenanceItem = Api.Vms.VehicleManage.VehicleMaintenanceItem
  type Attachment = Api.Vms.VehicleManage.VehicleAttachment

  const route = useRoute()
  const router = useRouter()
  const { hasAuth } = useAuth()
  const page = reactive<{ loading: boolean; error: Error | null }>({ loading: false, error: null })
  const detail = reactive<{ data?: MaintenanceRecord }>({ data: undefined })
  const sourceCost = reactive<{
    loading: boolean
    error: string
    data: VehicleMaintenanceCostSource | null
  }>({
    loading: false,
    error: '',
    data: null
  })
  const canViewFinanceCost = computed(() => hasAuth('FinanceWaybillCost:View'))
  const sourceCostStatusLabel = computed(() => {
    switch (sourceCost.data?.recognitionStatus) {
      case 'approved':
        return '已归集'
      case 'pending_review':
        return '待审批'
      default:
        return '待归集'
    }
  })
  const canViewIdentifiers = computed(() =>
    canViewField(detail.data?.fieldAccess, 'maintenanceIdentifiers')
  )
  const canViewTotalCost = computed(() => canViewField(detail.data?.fieldAccess, 'totalCost'))
  const canViewMaintenanceItems = computed(() =>
    canViewField(detail.data?.fieldAccess, 'maintenanceItems')
  )
  const canViewDocuments = computed(() => canViewField(detail.data?.fieldAccess, 'documents'))
  const descriptionData = computed<Partial<MaintenanceRecord>>(() => detail.data ?? {})
  const descriptionItems = computed<ArtDescriptionItem<Partial<MaintenanceRecord>>[]>(() => [
    { key: 'plateNo', label: '车牌号', field: 'plateNo' },
    { key: 'companyName', label: '所属公司', field: 'companyName' },
    ...(canViewIdentifiers.value
      ? [{ key: 'maintenanceNo', label: '维修单号', field: 'maintenanceNo', copyable: true }]
      : []),
    {
      key: 'maintenanceType',
      label: '维修类型',
      field: 'maintenanceType',
      dictCode: 'vehicleMaintenanceType',
      dictDisplay: 'text'
    },
    { key: 'initiator', label: '经办人', field: 'initiator' },
    { key: 'serviceDate', label: '保养维修日期', field: 'serviceDate', format: 'date' },
    { key: 'currentOdometerKm', label: '当前里程（公里）', field: 'currentOdometerKm' },
    {
      key: 'nextMaintenanceDate',
      label: '下次保养日期',
      field: 'nextMaintenanceDate',
      format: 'date'
    },
    { key: 'nextMaintenanceMileage', label: '下次保养里程', field: 'nextMaintenanceMileage' },
    { key: 'invoiceNo', label: '发票号', field: 'invoiceNo' },
    { key: 'workshop', label: '维修厂', field: 'workshop' },
    { key: 'startTime', label: '开始时间', field: 'startTime', format: 'datetime' },
    { key: 'endTime', label: '结束时间', field: 'endTime', format: 'datetime' },
    ...(canViewTotalCost.value
      ? [
          {
            key: 'costAmount',
            label: '总费用（元）',
            field: 'costAmount',
            formatter: (value: unknown) =>
              formatSensitiveNumberWithAffix(value as number | string | null | undefined, {
                suffix: ' 元'
              })
          }
        ]
      : []),
    {
      key: 'externalRepair',
      label: '外部维修',
      field: 'externalRepair',
      dictCode: 'commonBoolean',
      dictDisplay: 'text',
      value: (data: Partial<MaintenanceRecord>) => getBooleanDictValue(data.externalRepair)
    }
  ])

  const itemColumns: ColumnOption<MaintenanceItem>[] = [
    { type: 'globalIndex', label: '序号', width: 80 },
    { prop: 'itemName', label: '项目名称', minWidth: 180 },
    { prop: 'partName', label: '配件名称', minWidth: 160 },
    { prop: 'quantity', label: '数量', width: 100 },
    {
      prop: 'partPrice',
      label: '配件金额',
      width: 120,
      formatter: (row) => formatSensitiveNumberWithAffix(row.partPrice, { suffix: ' 元' })
    },
    {
      prop: 'laborAmount',
      label: '工时费',
      width: 120,
      formatter: (row) => formatSensitiveNumberWithAffix(row.laborAmount, { suffix: ' 元' })
    },
    {
      prop: 'totalAmount',
      label: '合计',
      width: 120,
      formatter: (row) => formatSensitiveNumberWithAffix(row.totalAmount, { suffix: ' 元' })
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
      width: 104,
      fixed: 'right',
      formatter: (row) => <BusinessAttachmentRowActions file={row} />
    }
  ]

  onMounted(() => {
    void loadDetail()
  })

  const loadDetail = async (): Promise<void> => {
    const id = String(route.params.id || '')
    if (!id) {
      page.error = new Error('缺少维修记录标识')
      return
    }
    page.loading = true
    page.error = null
    try {
      const { data, error } = await fetchVehicleMaintenanceDetail(id, { showErrorMessage: false })
      if (error) throw error
      detail.data = data
        ? { ...data, items: data.items ?? [], attachments: data.attachments ?? [] }
        : undefined
      if (detail.data && canViewTotalCost.value) void loadCostSource(id)
    } catch (error) {
      page.error =
        error instanceof Error
          ? error
          : new Error(getFriendlySupabaseErrorMessage(error, '维修保养详情加载失败'), {
              cause: error
            })
    } finally {
      page.loading = false
    }
  }

  const loadCostSource = async (id: string): Promise<void> => {
    if (!id) return
    sourceCost.loading = true
    sourceCost.error = ''
    try {
      sourceCost.data = await fetchVehicleMaintenanceCostSource(id)
    } catch (error) {
      sourceCost.error = getFriendlySupabaseErrorMessage(error, '成本归集状态加载失败，请重试')
    } finally {
      sourceCost.loading = false
    }
  }

  const openLinkedCost = (): void => {
    const costId = sourceCost.data?.linkedCostId
    if (!costId || !canViewFinanceCost.value) return
    void router.push(getWaybillCostDetailPath(costId))
  }

  const goBack = (): void => {
    void router.push('/vms/vehicle-manage/maintenance-record')
  }

  const getBooleanDictValue = (value?: boolean | null): string | undefined =>
    isNil(value) ? undefined : String(value)
</script>
