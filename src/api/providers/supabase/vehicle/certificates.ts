import { useSupabase } from '@/hooks/core/useSupabase'
import { withRequestOptions } from '@/api/providers/supabase/query'
import type { ApiRequestOptions } from '@/types/api/request'
import { normalizeNullableText } from '@/utils/form/normalize'
import { buildSupabaseRpcRange } from '@/utils/supabase/pagination'
import type {
  CertificateRecord,
  CertificateResponsibleOption,
  CertificateSearchParams,
  CertificateSubjectOption,
  CertificateSubjectType,
  CertificateWritePayload
} from '../../../../types/certificate'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

interface CertificatePage<T> {
  records: T[]
  total: number
}

export async function fetchCertificateList(
  params: CertificateSearchParams,
  options?: ApiRequestOptions
) {
  const result = await responseHandle<CertificatePage<CertificateRecord>>(
    () =>
      withRequestOptions(
        supabase.rpc('vms_list_certificates_secure', {
          ...buildSupabaseRpcRange(params.from ?? 0, params.to ?? 9),
          p_subject_type: params.subjectType || null,
          p_subject_id: params.subjectId || null,
          p_status: params.status || null,
          p_keyword: normalizeNullableText(params.keyword ?? '')
        }),
        options
      ),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error
  }
}

export async function fetchCertificateSubjectOptions(
  subjectType: CertificateSubjectType,
  keyword = '',
  from = 0,
  to = 9
) {
  const result = await responseHandle<CertificatePage<CertificateSubjectOption>>(
    () =>
      supabase.rpc('vms_list_certificate_subject_options_secure', {
        p_subject_type: subjectType,
        p_keyword: normalizeNullableText(keyword),
        ...buildSupabaseRpcRange(from, to)
      }),
    { showErrorMessage: true }
  )
  return { data: result.data?.records ?? [], total: result.data?.total ?? 0, error: result.error }
}

export async function fetchCertificateResponsibleOptions(
  subjectType: CertificateSubjectType,
  subjectId: string
) {
  return await responseHandle<CertificateResponsibleOption[]>(
    () =>
      supabase.rpc('vms_list_certificate_responsible_options_secure', {
        p_subject_type: subjectType,
        p_subject_id: subjectId
      }),
    { showErrorMessage: true }
  )
}

export async function saveCertificate(id: string | null, payload: CertificateWritePayload) {
  return await responseHandle<CertificateRecord>(
    () =>
      supabase.rpc('vms_save_certificate_secure', {
        p_id: id,
        p_payload: keysToSnakeDeep(payload)
      }),
    { showMessage: true, breakReturn: true }
  )
}

export async function markCertificateHandled(id: string) {
  return await responseHandle<CertificateRecord>(
    () => supabase.rpc('vms_mark_certificate_handled_secure', { p_id: id }),
    { showMessage: true, breakReturn: true }
  )
}
