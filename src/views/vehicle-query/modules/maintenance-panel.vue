<template>
  <ArtPageSection title="维修保养记录">
    <template #actions>
      <ElSelect
        v-model="panel.maintenanceType"
        clearable
        placeholder="维修类型"
        class="w-45! max-w-full"
      >
        <ElOption
          v-for="option in maintenanceTypeOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </ElSelect>
    </template>
    <VehicleQueryTable
      :error="error"
      @retry="loadRecords"
      :data="filteredRecords"
      :columns="columns"
      :loading="loading"
    />
  </ArtPageSection>
</template>

<script setup lang="tsx">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { ElOption, ElSelect } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import { fetchVehicleMaintenanceList } from '@vms/api'
  import ArtPageSection from '@/components/core/layouts/art-page-section/index.vue'
  import VehicleQueryTable from './vehicle-query-table.vue'
  import type { VehicleArchive, VehicleMaintenanceRecord } from './types'
  import { formatDateTime } from './query-format'
  import { useVehiclePanelList } from './use-vehicle-panel-list'
  import {
    canViewField,
    mergeFieldAccessMaps,
    formatSensitiveNumberWithAffix
  } from '@/utils/field-permission'

  const maintenanceTypeOptions = useDictionaryOptions('vehicleMaintenanceType')

  defineOptions({ name: 'VehicleQueryMaintenancePanel' })

  const props = defineProps<{
    vehicle: VehicleArchive
  }>()

  const vehicle = toRef(props, 'vehicle')
  const panel = reactive({
    maintenanceType: ''
  })

  const { loading, records, error, loadRecords } = useVehiclePanelList<VehicleMaintenanceRecord>(
    vehicle,
    async (current) => {
      const { data, error: requestError } = await fetchVehicleMaintenanceList(
        {
          vehicleId: current.id,
          from: 0,
          to: 9999
        },
        { showErrorMessage: false }
      )
      if (requestError) throw requestError
      return data ?? []
    }
  )

  const filteredRecords = computed(() =>
    panel.maintenanceType
      ? records.value.filter((item) => item.maintenanceType === panel.maintenanceType)
      : records.value
  )

  const effectiveFieldAccess = computed(() =>
    mergeFieldAccessMaps(...records.value.map((record) => record.fieldAccess))
  )

  const columns = computed<ColumnOption<VehicleMaintenanceRecord>[]>(() => [
    { type: 'globalIndex', label: '序号', width: 80 },
    ...(canViewField(effectiveFieldAccess.value, 'maintenanceIdentifiers')
      ? [{ prop: 'maintenanceNo', label: '维修单号', minWidth: 160 }]
      : []),
    {
      prop: 'maintenanceType',
      label: '维修类别',
      minWidth: 130,
      dict: { code: 'vehicleMaintenanceType', display: 'auto' }
    },
    { prop: 'initiator', label: '经办人', minWidth: 130 },
    {
      prop: 'serviceDate',
      label: '保养维修日期',
      minWidth: 145,
      formatter: (row) => row.serviceDate || '—'
    },
    {
      prop: 'currentOdometerKm',
      label: '当前里程（公里）',
      minWidth: 165,
      formatter: (row) => (row.currentOdometerKm == null ? '—' : String(row.currentOdometerKm))
    },
    {
      prop: 'nextMaintenanceDate',
      label: '下次保养日期',
      minWidth: 145,
      formatter: (row) => row.nextMaintenanceDate || '—'
    },
    {
      prop: 'nextMaintenanceMileage',
      label: '下次保养里程',
      minWidth: 145,
      formatter: (row) =>
        row.nextMaintenanceMileage == null ? '—' : String(row.nextMaintenanceMileage)
    },
    {
      prop: 'startTime',
      label: '维修保养时间',
      minWidth: 180,
      formatter: (row) => formatDateTime(row.startTime)
    },
    {
      prop: 'endTime',
      label: '结束时间',
      minWidth: 180,
      formatter: (row) => formatDateTime(row.endTime)
    },
    ...(canViewField(effectiveFieldAccess.value, 'totalCost')
      ? [
          {
            prop: 'costAmount',
            label: '费用',
            minWidth: 130,
            formatter: (row: VehicleMaintenanceRecord) =>
              formatSensitiveNumberWithAffix(row.costAmount, { suffix: ' 元' })
          }
        ]
      : [])
  ])
</script>
