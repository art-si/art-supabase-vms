import dayjs from 'dayjs'
import { isNil } from 'lodash-es'
import { normalizeNullableNumber } from '@/utils/form/normalize'
import type { VehicleQuerySummaryRecords } from '@vms/api'
import { getLatestByDate } from './query-format'
import type { VehicleMaintenanceRecord, VehicleQuerySummary } from './types'

export interface VehicleQueryCoverage {
  insuranceReady: boolean
  inspectionReady: boolean
  maintenanceReady: boolean
}

export interface LoadedVehicleQuerySummary {
  summary: VehicleQuerySummary
  coverage: VehicleQueryCoverage
}

export function buildVehicleQuerySummary(
  records: VehicleQuerySummaryRecords
): LoadedVehicleQuerySummary {
  const latestInsurance = getLatestByDate(records.insurance, (item) => item.createTime)
  const latestInspection = getLatestByDate(records.inspection, (item) => item.expireDate)
  const latestMaintenance = getLatestByDate(
    records.maintenance,
    (item) => item.serviceDate || item.startTime
  )
  const latestMileage = getLatestByDate(records.mileage, (item) => item.endTime || item.startTime)

  const summary: VehicleQuerySummary = {
    commercialExpireDate: latestInsurance?.commercialExpireDate,
    compulsoryExpireDate: latestInsurance?.compulsoryExpireDate,
    inspectionExpireDate: latestInspection?.expireDate,
    runningMileage:
      normalizeNullableNumber(latestMileage?.endMileage) ??
      normalizeNullableNumber(latestMileage?.runningMileage),
    nextMaintenanceDate:
      latestMaintenance?.reminderMode != null
        ? (latestMaintenance.nextMaintenanceDate ?? null)
        : getNextMaintenanceDate(latestMaintenance),
    nextMaintenanceMileage:
      latestMaintenance?.reminderMode != null
        ? normalizeNullableNumber(latestMaintenance.nextMaintenanceMileage)
        : getNextMaintenanceMileage(latestMaintenance, records.mileage)
  }

  return {
    summary,
    coverage: {
      insuranceReady: Boolean(summary.commercialExpireDate || summary.compulsoryExpireDate),
      inspectionReady: Boolean(summary.inspectionExpireDate),
      maintenanceReady: Boolean(latestMaintenance?.serviceDate || latestMaintenance?.startTime)
    }
  }
}

function getNextMaintenanceDate(
  record?: Pick<VehicleMaintenanceRecord, 'startTime'>
): string | null {
  if (!record?.startTime) return null
  const start = new Date(record.startTime)
  if (Number.isNaN(start.getTime())) return null
  start.setMonth(start.getMonth() + 6)
  return start.toISOString().slice(0, 10)
}

function getNextMaintenanceMileage(
  maintenance: Pick<VehicleMaintenanceRecord, 'startTime'> | undefined,
  mileageRecords: VehicleQuerySummaryRecords['mileage']
): number | null {
  if (!maintenance?.startTime) return null
  const maintenanceTime = dayjs(maintenance.startTime)
  if (!maintenanceTime.isValid()) return null

  const mileageAtMaintenance = getLatestByDate(
    mileageRecords.filter((record) => {
      const recordedAt = record.endTime || record.startTime
      if (!recordedAt) return false
      const recordedTime = dayjs(recordedAt)
      return recordedTime.isValid() && !recordedTime.isAfter(maintenanceTime)
    }),
    (record) => record.endTime || record.startTime
  )
  const baseline =
    normalizeNullableNumber(mileageAtMaintenance?.endMileage) ??
    normalizeNullableNumber(mileageAtMaintenance?.runningMileage) ??
    normalizeNullableNumber(mileageAtMaintenance?.startMileage)
  return isNil(baseline) ? null : baseline + 5000
}
