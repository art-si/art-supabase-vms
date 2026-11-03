import { omitNonEditableFieldGroups, omitWriteMetadata } from '@/utils/field-permission'
import dayjs from 'dayjs'

export type VehicleMaintenanceRecord = Api.Vms.VehicleManage.VehicleMaintenanceRecord
export type VehicleMaintenanceFieldKey = Api.Vms.VehicleManage.VehicleMaintenanceFieldKey

export function calculateMaintenanceReminder(
  mode: 'time' | 'mileage',
  serviceDate: string | null | undefined,
  currentOdometerKm: number | null | undefined
): { nextMaintenanceDate: string | null; nextMaintenanceMileage: number | null } {
  return {
    nextMaintenanceDate:
      mode === 'time' && serviceDate
        ? dayjs(serviceDate).add(3, 'month').format('YYYY-MM-DD')
        : null,
    nextMaintenanceMileage:
      mode === 'mileage' && currentOdometerKm != null ? currentOdometerKm + 10000 : null
  }
}

export const EDITABLE_VEHICLE_MAINTENANCE_ACCESS: Api.Vms.VehicleManage.VehicleMaintenanceFieldAccessMap =
  {
    maintenanceIdentifiers: 'edit',
    totalCost: 'edit',
    maintenanceItems: 'edit',
    documents: 'edit'
  }

type SensitivePayloadKey = 'maintenanceNo' | 'costAmount' | 'items' | 'attachments'

const SENSITIVE_PAYLOAD_KEYS: Record<VehicleMaintenanceFieldKey, SensitivePayloadKey[]> = {
  maintenanceIdentifiers: ['maintenanceNo'],
  totalCost: ['costAmount'],
  maintenanceItems: ['items'],
  documents: ['attachments']
}

export function sanitizeVehicleMaintenancePayload(
  params: VehicleMaintenanceRecord
): VehicleMaintenanceRecord {
  const payload = omitWriteMetadata(params)
  for (const key of [
    'tripStartTime',
    'tripEndTime',
    'driverName',
    'waybillNo',
    'departureMileage',
    'arrivalMileage',
    'drivingMileage'
  ] as const) {
    delete payload[key]
  }
  // 服务端仅在项目清单变更时重新核算；普通编辑保留历史费用。
  if (params.id) delete payload.costAmount
  return params.id
    ? omitNonEditableFieldGroups(payload, params.fieldAccess, SENSITIVE_PAYLOAD_KEYS)
    : payload
}
