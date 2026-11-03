import type { PartUnitOption } from '@/api/mdm-material-select'

export interface PartImportMaterial {
  id: string
  tenantId: string
  materialCode: string
  materialName: string
  baseUnitId: string | null
  status: 'enabled' | 'disabled'
}

/** Resolve a legacy Excel unit against the tenant's enabled MDM units. */
export function resolvePartImportUnit(
  row: Pick<Api.Vms.BasicInfo.Parts, 'unit' | 'unitId'>,
  material: PartImportMaterial,
  units: PartUnitOption[]
): PartUnitOption | undefined {
  if (row.unitId) return units.find((unit) => unit.id === row.unitId)
  const requested = row.unit?.trim()
  if (requested) {
    const byCode = units.find((unit) => unit.unitCode.toLowerCase() === requested.toLowerCase())
    if (byCode) return byCode
    const byName = units.filter((unit) => unit.unitName === requested)
    if (byName.length === 1) return byName[0]
    if (byName.length > 1) return byName.find((unit) => unit.id === material.baseUnitId)
    return undefined
  }
  return units.find((unit) => unit.id === material.baseUnitId)
}
