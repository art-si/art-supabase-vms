import { normalizeNullableText } from '@/utils/form/normalize'
import type { TrailerWritePayload } from '@vms/types/trailer'

/** Cleared optional relations must be SQL NULL before the RPC populates UUID columns. */
export function normalizeTrailerRelationIds(payload: TrailerWritePayload): TrailerWritePayload {
  return {
    ...payload,
    defaultTractorId: normalizeNullableText(payload.defaultTractorId),
    companyOrganizationId: normalizeNullableText(payload.companyOrganizationId)
  }
}
