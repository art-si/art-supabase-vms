<template>
  <div class="vehicle-query-archive-panel [&_.el-tabs__content]:pt-2">
    <ElTabs v-model="panel.activeTab">
      <ElTabPane v-if="hasAuth('VehicleQuery:TabBasic')" label="基础信息" name="basic">
        <ArtPageSection title="基础信息">
          <ArtDescriptions
            :data="descriptionData"
            :items="basicDescriptionItems"
            :label-width="128"
          />
        </ArtPageSection>
      </ElTabPane>
      <ElTabPane v-if="hasAuth('VehicleQuery:TabBody')" label="车身参数" name="body">
        <ArtPageSection title="车身参数">
          <ArtDescriptions
            :data="descriptionData"
            :items="bodyDescriptionItems"
            :label-width="128"
          />
        </ArtPageSection>
      </ElTabPane>
      <ElTabPane v-if="hasAuth('VehicleQuery:TabEngine')" label="发动机参数" name="engine">
        <ArtPageSection title="发动机参数">
          <ArtDescriptions
            :data="descriptionData"
            :items="engineDescriptionItems"
            :label-width="128"
          />
        </ArtPageSection>
      </ElTabPane>
      <ElTabPane v-if="hasAuth('VehicleQuery:TabOther')" label="其他信息" name="other">
        <ArtPageSection title="其他信息">
          <ArtDescriptions
            :data="descriptionData"
            :items="otherDescriptionItems"
            :label-width="128"
          />
        </ArtPageSection>
      </ElTabPane>
    </ElTabs>
    <ArtEmptyState
      v-if="!availableTabNames.length"
      title="暂无可访问的页签"
      description="请联系管理员在角色权限中授权车辆查询页签。"
    />
  </div>
</template>

<script setup lang="ts">
  import { ElTabPane, ElTabs } from 'element-plus'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import ArtPageSection from '@/components/core/layouts/art-page-section/index.vue'
  import type { InfoItem, VehicleArchive } from './types'
  import { createDescriptionItems } from './query-format'
  import { formatArtValue } from '@/utils/ui/format'
  import { canViewField } from '@/utils/field-permission'

  defineOptions({ name: 'VehicleQueryArchivePanel' })

  const props = defineProps<{
    vehicle: VehicleArchive
  }>()
  const { hasAuth } = useAuth()

  const panel = reactive({
    activeTab: 'basic'
  })
  const tabPermissions = {
    basic: 'VehicleQuery:TabBasic',
    body: 'VehicleQuery:TabBody',
    engine: 'VehicleQuery:TabEngine',
    other: 'VehicleQuery:TabOther'
  } as const
  const availableTabNames = computed(() =>
    Object.entries(tabPermissions)
      .filter(([, code]) => hasAuth(code))
      .map(([name]) => name)
  )
  watch(
    availableTabNames,
    (names) => {
      if (!names.includes(panel.activeTab)) panel.activeTab = names[0] ?? 'basic'
    },
    { immediate: true }
  )
  const descriptionData = Object.freeze({})

  const basicDescriptionItems = computed(() =>
    createDescriptionItems([
      { label: '车牌号', value: props.vehicle.plateNo },
      { label: '所属公司', value: props.vehicle.companyName },
      { label: '自编号', value: props.vehicle.selfNo },
      { label: '车型', value: props.vehicle.vehicleType, dictCode: 'vehicleType' },
      { label: '国产/进口', value: props.vehicle.originType, dictCode: 'vehicleOriginType' },
      ...(canViewField(props.vehicle.fieldAccess, 'vehicleIdentifiers')
        ? [{ label: '车架号（VIN）', value: props.vehicle.vin }]
        : []),
      { label: '车辆厂商', value: props.vehicle.manufacturer },
      { label: '厂牌型号', value: props.vehicle.brandModel },
      { label: '车身颜色', value: props.vehicle.vehicleColor, dictCode: 'vehicleColor' },
      ...(canViewField(props.vehicle.fieldAccess, 'vehicleIdentifiers')
        ? [
            { label: '底盘号', value: props.vehicle.chassisNo },
            { label: '波箱系列号', value: props.vehicle.gearboxSerialNo }
          ]
        : []),
      ...(canViewField(props.vehicle.fieldAccess, 'deviceIdentity')
        ? [{ label: '空调号码', value: props.vehicle.acCode }]
        : []),
      { label: '购入开票日期', value: props.vehicle.invoiceDate },
      { label: '启用日期', value: props.vehicle.startUseDate },
      { label: '使用年限', value: props.vehicle.serviceYears, suffix: '年' },
      { label: '核定乘员数（人）', value: props.vehicle.approvedPassengerCount },
      { label: '座位数', value: props.vehicle.seatCount },
      { label: '业务类型', value: props.vehicle.businessType, dictCode: 'vehicleBusinessType' },
      { label: '使用性质', value: props.vehicle.usageNature, dictCode: 'vehicleUsageNature' },
      { label: '是否空调车', value: formatArtValue(props.vehicle.isAirConditioned, 'boolean') },
      {
        label: '营运状态',
        value: props.vehicle.operationStatus,
        dictCode: 'vehicleOperationStatus'
      },
      { label: '营运状态变更', value: props.vehicle.operationStatusChangeDate },
      { label: '购置状态', value: props.vehicle.purchaseStatus, dictCode: 'vehiclePurchaseStatus' },
      { label: '购置状态变更', value: props.vehicle.purchaseStatusChangeDate },
      { label: '例检启用日期', value: props.vehicle.inspectionStartDate },
      { label: '车辆等级', value: props.vehicle.vehicleLevel, dictCode: 'vehicleLevel' },
      { label: '是否新能源车', value: formatArtValue(props.vehicle.isNewEnergy, 'boolean') },
      { label: '整车三包里程', value: props.vehicle.threeGuaranteeMileage, suffix: '公里' },
      { label: '整车三包时长', value: props.vehicle.threeGuaranteeDuration, suffix: '个月' },
      { label: '整车包修里程', value: props.vehicle.warrantyMileage, suffix: '公里' },
      { label: '整车包修时长', value: props.vehicle.warrantyDuration, suffix: '个月' },
      { label: '备注', value: props.vehicle.remark }
    ] satisfies InfoItem[])
  )

  const bodyDescriptionItems = computed(() =>
    createDescriptionItems([
      { label: '满载总质量', value: props.vehicle.grossMass, suffix: 'kg' },
      { label: '整备质量', value: props.vehicle.curbWeight, suffix: 'kg' },
      { label: '核定载质量', value: props.vehicle.approvedLoadMass, suffix: 'kg' },
      { label: '外廓长度', value: props.vehicle.overallLength, suffix: 'mm' },
      { label: '外廓宽度', value: props.vehicle.overallWidth, suffix: 'mm' },
      { label: '外廓高度', value: props.vehicle.overallHeight, suffix: 'mm' },
      { label: '标台', value: props.vehicle.platform },
      { label: '前轮距', value: props.vehicle.frontTrack, suffix: 'mm' },
      { label: '后轮距', value: props.vehicle.rearTrack, suffix: 'mm' },
      { label: '轴距', value: props.vehicle.wheelbase },
      { label: '车轴数', value: props.vehicle.axleCount },
      { label: '轮胎数', value: props.vehicle.tireCount },
      { label: '钢板弹簧数', value: props.vehicle.leafSpringCount, suffix: '片' },
      { label: '是否双层', value: formatArtValue(props.vehicle.isDoubleDeck, 'boolean') }
    ] satisfies InfoItem[])
  )

  const engineDescriptionItems = computed(() =>
    createDescriptionItems([
      ...(canViewField(props.vehicle.fieldAccess, 'vehicleIdentifiers')
        ? [{ label: '发动机号', value: props.vehicle.engineNo }]
        : []),
      { label: '发动机型号', value: props.vehicle.engineModel },
      { label: '燃油类型', value: props.vehicle.fuelType, dictCode: 'vehicleFuelType' },
      { label: '发动机排量', value: props.vehicle.displacement, suffix: 'L' },
      {
        label: '排放标准',
        value: props.vehicle.emissionStandard,
        dictCode: 'vehicleEmissionStandard'
      },
      { label: '发动机功率', value: props.vehicle.enginePower, suffix: 'KW' },
      { label: '额定扭矩转速', value: props.vehicle.ratedTorqueSpeed, suffix: 'r/min' },
      { label: '发动机扭矩', value: props.vehicle.engineTorque, suffix: 'N-M' }
    ] satisfies InfoItem[])
  )

  const otherDescriptionItems = computed(() =>
    createDescriptionItems([
      { label: '车牌颜色', value: props.vehicle.plateColor, dictCode: 'vehicleColor' },
      {
        label: '运输行业',
        value: props.vehicle.transportIndustry,
        dictCode: 'vehicleTransportIndustry'
      },
      { label: '营运类型', value: props.vehicle.operationType, dictCode: 'vehicleOperationType' },
      ...(canViewField(props.vehicle.fieldAccess, 'ownerIdentity')
        ? [
            { label: '业户ID', value: props.vehicle.ownerId },
            { label: '业户名称', value: props.vehicle.ownerName },
            { label: '车主性别', value: props.vehicle.ownerGender, dictCode: 'sex' },
            { label: '身份证号码', value: props.vehicle.idCardNo }
          ]
        : []),
      ...(canViewField(props.vehicle.fieldAccess, 'contactPhones')
        ? [{ label: '业户联系电话', value: props.vehicle.ownerPhone }]
        : []),
      ...(canViewField(props.vehicle.fieldAccess, 'deviceIdentity')
        ? [{ label: '车载终端电话', value: props.vehicle.terminalPhone }]
        : []),
      ...(canViewField(props.vehicle.fieldAccess, 'mailingAddress')
        ? [{ label: '通讯地址', value: props.vehicle.mailingAddress }]
        : []),
      { label: '吨位/座位', value: props.vehicle.tonnageOrSeat },
      { label: '主司机姓名', value: props.vehicle.primaryDriver?.driverName },
      ...(canViewField(props.vehicle.primaryDriver?.fieldAccess, 'contactPhone')
        ? [{ label: '主司机电话', value: props.vehicle.primaryDriver?.phone }]
        : []),
      {
        label: '备用司机',
        value:
          props.vehicle.backupDrivers?.map((driver) => driver.driverName).join('、') ||
          props.vehicle.secondaryDriver?.driverName
      },
      {
        label: '备用司机电话',
        value:
          props.vehicle.backupDrivers
            ?.filter((driver) => canViewField(driver.fieldAccess, 'contactPhone'))
            .map((driver) => driver.phone)
            .filter(Boolean)
            .join('、') ||
          (canViewField(props.vehicle.secondaryDriver?.fieldAccess, 'contactPhone')
            ? props.vehicle.secondaryDriver?.phone
            : undefined)
      },
      ...(canViewField(props.vehicle.fieldAccess, 'operationRoute')
        ? [{ label: '营运线路', value: props.vehicle.operationRoute }]
        : []),
      ...(canViewField(props.vehicle.fieldAccess, 'vehicleIdentifiers')
        ? [{ label: '车籍地代码', value: props.vehicle.licensePlateCode }]
        : []),
      { label: '服务开始时间', value: props.vehicle.serviceStartTime },
      { label: '服务结束时间', value: props.vehicle.serviceEndTime },
      { label: '支持拍照', value: formatArtValue(props.vehicle.supportPhoto, 'boolean') }
    ] satisfies InfoItem[])
  )
</script>
