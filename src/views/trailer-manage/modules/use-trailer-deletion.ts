import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
import { useAuth } from '@/hooks/core/useAuth'
import type { MasterDataDeleteGuardOpenOptions } from '@/components/business/master-data-delete-guard/index.vue'
import { deleteTrailer, fetchTrailerDeleteDependencies } from '@vms/api'
import type { TrailerRecord } from '@vms/types/trailer'

export function useTrailerDeletion() {
  const { hasAuth } = useAuth()
  const { deleteRecords } = useRecordDeleteGuard('vehicle_trailer', '挂车档案')
  const deleteGuardRef = ref<{
    inspect: (options: MasterDataDeleteGuardOpenOptions) => Promise<boolean>
  }>()

  const remove = async (row: TrailerRecord, onDeleted: () => Promise<unknown>) => {
    await deleteRecords({
      resources: [{ id: row.id, label: row.plateNo }],
      permission: 'TrailerManage:Delete',
      inspectReferences: async (resources) => {
        if (!deleteGuardRef.value) throw new Error('关联检查尚未就绪，请刷新后重试')
        return await deleteGuardRef.value.inspect({
          resourceLabel: '挂车档案',
          resources,
          dependencyMeta: {
            vehicle_trailer_tractor: {
              label: '关联牵引车',
              unit: '辆',
              statusDictCode: 'vehicleOperationStatus',
              description: '请先编辑挂车，解除与牵引车的关联后再删除。',
              actionLabel: '查看牵引车',
              routePath: '/vms/vehicle-archive-manage',
              routeQuery: (record) => ({ recordId: record.targetId, fromMasterDelete: '1' }),
              canNavigate: () => hasAuth('VehicleArchive:View'),
              order: 1
            }
          },
          fetchDependencies: async (ids) => {
            const result = await fetchTrailerDeleteDependencies(ids)
            if (result.error || !result.data)
              throw new Error('挂车关联检查失败，请重试', { cause: result.error })
            return result.data
          }
        })
      },
      remove: async () => {
        const result = await deleteTrailer(row.id)
        if (result.error) throw result.error
      },
      onDeleted,
      failureMessage: '挂车删除失败，请核对牵引关系后重试',
      successMessage: '挂车档案已删除'
    })
  }
  return { deleteGuardRef, remove }
}
