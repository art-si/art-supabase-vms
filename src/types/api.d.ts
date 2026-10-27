export {}

declare global {
  declare namespace Api {
    namespace Vms {
      /** VMS 消费 TMS 只读 RPC 时使用的最小集成契约。 */
      namespace Integration {
        type CarrierFieldKey =
          'contactPhone' | 'addressDetail' | 'taxNo' | 'bankAccount' | 'attachments'
        type CarrierFieldAccessMap = Partial<Record<CarrierFieldKey, Api.Common.FieldAccessLevel>>

        interface CarrierReference {
          id: string
          carrierCode?: string
          companyName: string
          enabled?: boolean
          contactName?: string
          contactPhone?: string
          fieldAccess?: CarrierFieldAccessMap
          isRecordOwner?: boolean
        }

        type DriverFieldKey =
          'contactPhone' | 'idCardNo' | 'homeAddress' | 'emergencyContact' | 'identityDocuments'
        type DriverFieldAccessMap = Partial<Record<DriverFieldKey, Api.Common.FieldAccessLevel>>

        interface DriverReference {
          id: string
          carrierId?: string | null
          driverName: string
          phone?: string
          driverType?: 'primary' | 'secondary'
          licenseType?: string
          licenseExpireDate?: string | null
          enabled?: boolean
          fieldAccess?: DriverFieldAccessMap
          isRecordOwner?: boolean
        }
      }

      namespace ArchiveManage {
        type AuditStatus = 'draft' | 'pending' | 'approved' | 'rejected'
        type VehicleArchiveFieldKey =
          | 'vehicleIdentifiers'
          | 'ownerIdentity'
          | 'contactPhones'
          | 'mailingAddress'
          | 'operationRoute'
          | 'documents'
          | 'deviceIdentity'
        type VehicleArchiveFieldAccessMap = Partial<
          Record<VehicleArchiveFieldKey, Api.Common.FieldAccessLevel>
        >

        interface VehicleAttachment {
          name: string
          url: string
          fileType?: string
          fileSize?: string
        }

        type VehicleArchiveAttachment = VehicleAttachment

        interface VehicleArchive {
          id?: string
          tenantId?: string
          plateNo: string
          carrierId?: string | null
          carrier?: Api.Vms.Integration.CarrierReference | null
          companyName?: string
          selfNo?: string
          vehicleType: string
          vehicleTypeProfileId?: string | null
          vehicleOwnership?: 'self_operated' | 'franchise' | 'third_party'
          specLengthM?: number | null
          volumeM3?: number | null
          loadTons?: number | null
          originType?: string
          vin?: string
          manufacturer?: string
          brandModel?: string
          operationCertNo?: string
          purchaseCertNo?: string
          registrationCertNo?: string
          vehicleColor?: string
          chassisNo?: string
          acCode?: string
          gearboxSerialNo?: string
          registerDate?: string
          issueDate?: string
          invoiceDate?: string
          purchaseDate?: string
          startUseDate?: string
          serviceYears?: number | null
          approvedPassengerCount?: number | null
          seatCount?: number | null
          businessType?: string
          usageNature?: string | null
          isAirConditioned?: boolean
          operationStatus?: string
          certificateRisk?: 'expired' | 'renewal_due' | 'valid' | 'none'
          certificateRiskExpiresOn?: string | null
          certificateRiskType?: import('./certificate').CertificateType | null
          operationStatusChangeDate?: string
          purchaseStatus?: string
          purchaseStatusChangeDate?: string
          inspectionStartDate?: string
          vehicleLevel?: string
          isNewEnergy?: boolean
          threeGuaranteeMileage?: number | null
          threeGuaranteeDuration?: number | null
          warrantyMileage?: number | null
          warrantyDuration?: number | null
          remark?: string

          grossMass?: number | null
          curbWeight?: number | null
          approvedLoadMass?: number | null
          overallLength?: number | null
          overallWidth?: number | null
          overallHeight?: number | null
          platform?: string
          frontTrack?: number | null
          rearTrack?: number | null
          wheelbase?: number | null
          axleCount?: number | null
          tireCount?: number | null
          leafSpringCount?: number | null
          isDoubleDeck?: boolean

          engineNo?: string
          engineModel?: string
          fuelType?: string
          displacement?: number | null
          emissionStandard?: string
          enginePower?: number | null
          ratedTorqueSpeed?: number | null
          engineTorque?: number | null

          plateColor?: string
          transportIndustry?: string
          operationType?: string
          ownerId?: string
          ownerName?: string
          ownerPhone?: string
          terminalPhone?: string
          ownerGender?: string
          idCardNo?: string
          mailingAddress?: string
          tonnageOrSeat?: string
          primaryDriverId?: string | null
          primaryDriver?: Api.Vms.Integration.DriverReference | null
          secondaryDriverId?: string | null
          secondaryDriver?: Api.Vms.Integration.DriverReference | null
          backupDriverIds?: string[]
          backupDrivers?: Api.Vms.Integration.DriverReference[]
          driverOneName?: string
          driverOnePhone?: string
          driverTwoName?: string
          driverTwoPhone?: string
          operationRoute?: string
          licensePlateCode?: string
          serviceStartTime?: string
          serviceEndTime?: string
          supportPhoto?: boolean

          vehiclePhotoUrl?: string
          drivingLicenseFrontUrl?: string
          drivingLicenseBackUrl?: string
          drivingLicenseBackReverseUrl?: string
          personVehiclePhotoUrl?: string
          vehicleHeadPhotoUrl?: string
          operationLicenseUrl?: string
          attachments?: VehicleAttachment[]

          auditStatus?: AuditStatus
          auditRemark?: string
          auditBy?: string
          auditTime?: string
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
          fieldAccess?: VehicleArchiveFieldAccessMap
          isRecordOwner?: boolean
        }

        type VehicleArchiveSearchParams = Partial<
          Pick<
            VehicleArchive,
            | 'carrierId'
            | 'plateNo'
            | 'companyName'
            | 'vehicleType'
            | 'manufacturer'
            | 'vin'
            | 'operationStatus'
            | 'auditStatus'
          > &
            Api.Common.CommonSearchParams & {
              createTimeRange?: string[]
              auditStatuses?: AuditStatus[]
              recordId?: string
            }
        >
      }

      namespace VehicleManage {
        type VehicleAttachment = Api.Vms.ArchiveManage.VehicleAttachment

        interface VehicleOption {
          id?: string
          carrierId?: string | null
          plateNo: string
          companyName?: string
          vin?: string
          selfNo?: string
          vehicleType?: string
          fieldAccess?: Api.Vms.ArchiveManage.VehicleArchiveFieldAccessMap
          isRecordOwner?: boolean
        }

        interface InsuranceCompanyOption {
          id?: string
          companyName: string
          contactPerson?: string
          contactPhone?: string
        }

        type VehicleInsuranceFieldKey = 'policyNumbers' | 'premiumAmounts' | 'documents'
        type VehicleInsuranceFieldAccessMap = Partial<
          Record<VehicleInsuranceFieldKey, Api.System.FieldPermissionAccessLevel>
        >

        interface VehicleInsurance {
          id?: string
          tenantId?: string
          vehicleId?: string | null
          plateNo: string
          companyName?: string
          commercialPolicyNo?: string
          commercialCompanyId?: string | null
          commercialCompanyName?: string
          commercialInsureDate?: string
          commercialPremium?: number | string | null
          commercialExpireDate?: string
          compulsoryPolicyNo?: string
          compulsoryCompanyId?: string | null
          compulsoryCompanyName?: string
          compulsoryInsureDate?: string
          compulsoryPremium?: number | string | null
          compulsoryExpireDate?: string
          remark?: string
          attachments?: VehicleAttachment[]
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
          fieldAccess?: VehicleInsuranceFieldAccessMap
          isRecordOwner?: boolean
        }

        type VehicleInsuranceSearchParams = Partial<
          Pick<
            VehicleInsurance,
            'vehicleId' | 'companyName' | 'plateNo' | 'commercialPolicyNo' | 'compulsoryPolicyNo'
          > &
            Api.Common.CommonSearchParams & {
              commercialExpireDateRange?: string[]
              compulsoryExpireDateRange?: string[]
              createTimeRange?: string[]
            }
        >

        type VehicleInspectionFieldKey = 'inspectionIdentifiers' | 'monetaryAmounts' | 'documents'
        type VehicleInspectionFieldAccessMap = Partial<
          Record<VehicleInspectionFieldKey, Api.System.FieldPermissionAccessLevel>
        >

        interface VehicleInspection {
          id?: string
          tenantId?: string
          vehicleId?: string | null
          plateNo: string
          companyName?: string
          inspectionNo?: string
          inspectionDate?: string
          inspectionAmount?: number | string | null
          vehicleOffice?: string
          expireDate?: string
          compulsoryPolicyNo?: string
          compulsoryCompanyId?: string | null
          compulsoryCompanyName?: string
          compulsoryInsureDate?: string
          compulsoryPremium?: number | string | null
          compulsoryExpireDate?: string
          remark?: string
          attachments?: VehicleAttachment[]
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
          fieldAccess?: VehicleInspectionFieldAccessMap
          isRecordOwner?: boolean
        }

        type VehicleInspectionSearchParams = Partial<
          Pick<VehicleInspection, 'vehicleId' | 'companyName' | 'plateNo' | 'inspectionNo'> &
            Api.Common.CommonSearchParams & {
              expireDateRange?: string[]
              createTimeRange?: string[]
            }
        >

        type VehicleRoutineInspectionType = 'daily' | 'monthly'
        type VehicleRoutineInspectionResult = 'qualified' | 'unqualified'
        type VehicleRoutineInspectionFieldKey =
          'responsiblePeople' | 'inspectionFindings' | 'remediationDetails' | 'documents'
        type VehicleRoutineInspectionFieldAccessMap = Partial<
          Record<VehicleRoutineInspectionFieldKey, Api.System.FieldPermissionAccessLevel>
        >

        interface VehicleRoutineInspectionRecord {
          id?: string
          tenantId?: string
          vehicleId?: string | null
          plateNo: string
          companyName?: string
          routineInspectionNo?: string
          inspectionType: VehicleRoutineInspectionType | string
          inspectionTime: string
          inspector?: string
          driverName?: string
          driverId?: string | null
          checkCondition?: string
          checkResult?: VehicleRoutineInspectionResult | string
          handlingMethod?: string
          remark?: string
          attachments?: VehicleAttachment[]
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
          fieldAccess?: VehicleRoutineInspectionFieldAccessMap
          isRecordOwner?: boolean
          attachmentsMasked?: boolean
        }

        type VehicleRoutineInspectionSearchParams = Partial<
          Pick<
            VehicleRoutineInspectionRecord,
            'vehicleId' | 'companyName' | 'plateNo' | 'inspectionType' | 'checkResult'
          > &
            Api.Common.CommonSearchParams & {
              inspectionTimeRange?: string[]
              createTimeRange?: string[]
            }
        >

        type VehicleMileageFieldKey = 'tripTimeline' | 'mileageValues'
        type VehicleMileageFieldAccessMap = Partial<
          Record<VehicleMileageFieldKey, Api.System.FieldPermissionAccessLevel>
        >

        interface VehicleMileageRecord {
          id?: string
          tenantId?: string
          vehicleId?: string | null
          plateNo: string
          companyName?: string
          runningMileage?: number | string | null
          startTime?: string
          startMileage?: number | string | null
          endTime?: string | null
          endMileage?: number | string | null
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
          fieldAccess?: VehicleMileageFieldAccessMap
          isRecordOwner?: boolean
        }

        type VehicleMileageSearchParams = Partial<
          Pick<VehicleMileageRecord, 'vehicleId' | 'companyName' | 'plateNo'> &
            Api.Common.CommonSearchParams & {
              drivingTimeRange?: string[]
            }
        >

        interface VehicleViolationRecord {
          id?: string
          tenantId?: string
          vehicleId?: string | null
          driverId?: string | null
          linkedDriverName?: string | null
          plateNo: string
          companyName?: string
          driverName?: string
          violationBehavior: string
          violationTime: string
          violationLocation?: string
          penaltyPoints?: number | string | null
          fineAmount?: number | string | null
          processed: boolean
          remark?: string
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
          fieldAccess?: VehicleViolationFieldAccessMap
          isRecordOwner?: boolean
        }

        type VehicleViolationFieldKey =
          'driverIdentity' | 'violationLocation' | 'violationNarrative' | 'penaltyAmounts'
        type VehicleViolationFieldAccessMap = Partial<
          Record<VehicleViolationFieldKey, Api.System.FieldPermissionAccessLevel>
        >

        type VehicleViolationSearchParams = Partial<
          Pick<
            VehicleViolationRecord,
            | 'vehicleId'
            | 'companyName'
            | 'plateNo'
            | 'driverName'
            | 'violationBehavior'
            | 'processed'
          > &
            Api.Common.CommonSearchParams & {
              violationTimeRange?: string[]
            }
        >

        type VehicleAccidentResponsibility = 'primary' | 'secondary' | 'equal' | 'none' | 'full'
        type VehicleAccidentDataSource = 'self' | 'external'

        type VehicleAccidentFieldKey =
          'driverContact' | 'accidentLocation' | 'accidentNarrative' | 'lossAmounts' | 'documents'
        type VehicleAccidentFieldAccessMap = Partial<
          Record<VehicleAccidentFieldKey, Api.System.FieldPermissionAccessLevel>
        >

        interface VehicleAccidentRecord {
          id?: string
          tenantId?: string
          vehicleId?: string | null
          plateNo: string
          companyName?: string
          driverName?: string
          driverId?: string | null
          driverPhone?: string
          accidentTime: string
          accidentLocation?: string
          accidentLongitude?: number | null
          accidentLatitude?: number | null
          accidentSummary: string
          damageLevel?: string
          responsibilityType?: VehicleAccidentResponsibility | string
          responsibilityPercent?: number | null
          companyBearAmount?: number | string | null
          economicLoss?: number | string | null
          reported: boolean
          insuranceReported: boolean
          processed: boolean
          dataSource: VehicleAccidentDataSource | string
          remark?: string
          attachments?: VehicleAttachment[]
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
          fieldAccess?: VehicleAccidentFieldAccessMap
          isRecordOwner?: boolean
        }

        type VehicleAccidentSearchParams = Partial<
          Pick<
            VehicleAccidentRecord,
            'vehicleId' | 'companyName' | 'plateNo' | 'driverName' | 'processed' | 'dataSource'
          > &
            Api.Common.CommonSearchParams & {
              accidentTimeRange?: string[]
              createTimeRange?: string[]
            }
        >

        type VehicleMaintenanceType = 'repair' | 'maintenance'

        type VehicleMaintenanceFieldKey =
          'maintenanceIdentifiers' | 'totalCost' | 'maintenanceItems' | 'documents'
        type VehicleMaintenanceFieldAccessMap = Partial<
          Record<VehicleMaintenanceFieldKey, Api.System.FieldPermissionAccessLevel>
        >

        interface VehicleMaintenanceItem {
          itemName: string
          totalAmount?: number | null
          laborAmount?: number | null
          partName?: string
          partPrice?: number | null
          quantity?: number | null
        }

        interface VehicleMaintenanceRecord {
          id?: string
          tenantId?: string
          vehicleId?: string | null
          plateNo: string
          companyName?: string
          maintenanceNo: string
          maintenanceType: VehicleMaintenanceType | string
          initiator?: string
          initiatorEmployeeId?: string | null
          mileageRecordId?: string | null
          tripStartTime?: string | null
          tripEndTime?: string | null
          driverName?: string | null
          waybillNo?: string | null
          departureMileage?: number | string | null
          arrivalMileage?: number | string | null
          drivingMileage?: number | string | null
          startTime: string
          endTime?: string | null
          costAmount?: number | string | null
          workshop?: string
          externalRepair: boolean
          remark?: string
          items?: VehicleMaintenanceItem[]
          attachments?: VehicleAttachment[]
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
          fieldAccess?: VehicleMaintenanceFieldAccessMap
          isRecordOwner?: boolean
        }

        type VehicleMaintenanceSearchParams = Partial<
          Pick<
            VehicleMaintenanceRecord,
            'vehicleId' | 'companyName' | 'plateNo' | 'maintenanceNo' | 'maintenanceType'
          > &
            Api.Common.CommonSearchParams & {
              createTimeRange?: string[]
            }
        >

        type VehiclePartType = 'original' | 'replacement'
        type VehiclePartUsageStatus = 'normal' | 'reused' | 'scrapped'
        type VehiclePartEnableMode = 'vehicle' | 'date'
        type VehiclePartWarrantyMode = 'vehicle' | 'self'
        type VehiclePartUsageFieldKey =
          'supplierDetails' | 'traceabilityTag' | 'lifecycleLimits' | 'dispositionNotes'
        type VehiclePartUsageFieldAccessMap = Partial<
          Record<VehiclePartUsageFieldKey, Api.System.FieldPermissionAccessLevel>
        >

        interface VehiclePartUsage {
          id?: string
          tenantId?: string
          vehicleId?: string | null
          plateNo: string
          companyName?: string
          partId?: string | null
          partType: VehiclePartType
          partName: string
          partCode: string
          categoryId?: string | null
          categoryName?: string
          brand?: string
          model?: string
          unit?: string
          qualityCategory?: string
          manufacturer?: string
          supplierId?: string | null
          supplierName?: string
          supplierContact?: string
          isConsumable: boolean
          rfidEnabled: boolean
          rfidTag?: string
          enableMode: VehiclePartEnableMode
          enableDate?: string | null
          warrantyMode: VehiclePartWarrantyMode
          warrantyMileage?: number | null
          warrantyDuration?: number | null
          serviceMileageEnabled: boolean
          serviceMileage?: number | null
          serviceYearsEnabled: boolean
          serviceYears?: number | null
          usedMileage?: number | null
          status: VehiclePartUsageStatus
          scrapReason?: string
          remark?: string
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
          fieldAccess?: VehiclePartUsageFieldAccessMap
          isRecordOwner?: boolean
          lifecycleLimitsMasked?: boolean
        }

        type VehiclePartUsageSearchParams = Partial<
          Pick<
            VehiclePartUsage,
            | 'vehicleId'
            | 'companyName'
            | 'plateNo'
            | 'partType'
            | 'partName'
            | 'categoryId'
            | 'rfidTag'
            | 'status'
          > &
            Api.Common.CommonSearchParams & {
              createTimeRange?: string[]
            }
        >

        type VehicleHealthSignalType =
          | 'insurance_expired'
          | 'insurance_expiring'
          | 'inspection_expired'
          | 'inspection_expiring'
          | 'maintenance_overdue'
          | 'maintenance_history_missing'
          | 'repair_frequency_high'
          | 'unresolved_accident'
          | 'routine_inspection_failed'
          | 'part_service_due'
          | 'mileage_data_stale'

        type VehicleHealthSeverity = 'critical' | 'high' | 'medium'
        type VehicleHealthRiskLevel = VehicleHealthSeverity | 'low'

        interface VehicleHealthSignal {
          type: VehicleHealthSignalType
          severity: VehicleHealthSeverity
          title: string
          detail: string
          evidence: string[]
        }

        interface VehicleHealthAssessment {
          vehicleId: string
          plateNo: string
          vehicleType: string
          operationStatus: string
          riskLevel: VehicleHealthRiskLevel
          riskScore: number
          healthScore: number
          confidence: number
          summary: string
          signals: VehicleHealthSignal[]
          recommendedActions: string[]
          limitations: string[]
          metrics: {
            currentMileage: number | null
            insuranceDaysRemaining: number | null
            inspectionDaysRemaining: number | null
            daysSinceMaintenance: number | null
            repairCount90Days: number
            unresolvedAccidentCount: number
            failedRoutineInspectionCount: number
            duePartCount: number
          }
        }

        interface VehicleHealthAdvisorResponse {
          runId: string
          ruleVersion: string
          generatedAt: string
          assessment: VehicleHealthAssessment
        }

        interface FleetHealthRecord {
          vehicleId: string
          plateNo: string
          companyName?: string | null
          vehicleType?: string | null
          operationStatus?: string | null
          riskLevel: VehicleHealthRiskLevel
          riskScore: number
          healthScore: number
          insuranceDaysRemaining: number | null
          inspectionDaysRemaining: number | null
          daysSinceMaintenance: number | null
          unresolvedAccidentCount: number
          failedInspectionCount: number
          openWorkOrderCount: number
          issueCount: number
          issues: string[]
          updateTime?: string | null
        }

        interface FleetHealthOverview {
          total: number
          critical: number
          high: number
          medium: number
          low: number
          openWorkOrders: number
        }

        interface FleetHealthSearchParams {
          keyword?: string
          riskLevel?: VehicleHealthRiskLevel | ''
          from?: number
          to?: number
        }
      }

      namespace ReminderManage {
        type ReminderKind = 'insurance' | 'inspection' | 'maintenance' | 'part' | 'vehicle'
        type WorkOrderStatus = 'pending' | 'in_progress' | 'resolved' | 'closed' | 'cancelled'
        type WorkOrderPriority = 'low' | 'normal' | 'high' | 'urgent'

        type InsuranceType = 'commercial' | 'compulsory'

        interface VehicleReminderRow {
          id: string
          sourceId?: string
          sourceVersion?: string
          vehicleId?: string | null
          companyName?: string
          plateNo: string
          insuranceType?: InsuranceType
          insuranceTypeName?: string
          expireDate?: string | null
          remainingDays?: number | null
          expired: boolean
          currentMaintenanceDate?: string | null
          currentMileage?: number | null
          nextMaintenanceMileage?: number | null
          nextMaintenanceDate?: string | null
          partType?: VehicleManage.VehiclePartType
          partName?: string
          categoryName?: string
          brand?: string
          model?: string
          rfidTag?: string
          usedMileage?: number | null
          serviceMileage?: number | null
          startUseDate?: string | null
          serviceYears?: number | null
          workOrder?: VehicleReminderWorkOrder | null
          workOrderStatus?: WorkOrderStatus | null
        }

        interface VehicleReminderRiskOverview {
          total: number
          overdue: number
          dueWithin7Days: number
          dueWithin30Days: number
          stable: number
        }

        type VehicleReminderRiskBand = 'all' | 'overdue' | 'due_7' | 'due_30'

        interface VehicleReminderWorkOrder {
          id: string
          tenantId: string
          sourceType: ReminderKind
          sourceKey: string
          sourceVersion: string
          sourceId?: string | null
          vehicleId: string
          plateNoSnapshot: string
          companyNameSnapshot?: string | null
          title: string
          status: WorkOrderStatus
          priority: WorkOrderPriority
          dueDate?: string | null
          remainingDaysSnapshot?: number | null
          assigneeName?: string | null
          resolution?: string | null
          evidence?: unknown[]
          startedAt?: string | null
          resolvedAt?: string | null
          closedAt?: string | null
          createBy?: string | null
          createTime: string
          updateBy?: string | null
          updateTime: string
        }

        interface VehicleReminderWorkOrderCreatePayload {
          sourceType: ReminderKind
          sourceKey: string
          sourceVersion: string
          sourceId?: string | null
          vehicleId: string
          plateNo: string
          companyName?: string | null
          title: string
          dueDate?: string | null
          remainingDays?: number | null
        }

        interface VehicleReminderWorkOrderTransitionPayload {
          workOrderId: string
          nextStatus: WorkOrderStatus
          resolution?: string | null
        }

        type VehicleReminderSearchParams = Partial<
          Pick<VehicleReminderRow, 'companyName' | 'plateNo' | 'expired'> &
            Api.Common.CommonSearchParams & {
              reminderDays?: number | null
              riskBand?: VehicleReminderRiskBand
              sourceKey?: string
              workOrderId?: string
            } & Api.Common.PaginationParams
        >
      }

      namespace BasicInfo {
        interface InsuranceCompany {
          id?: string
          tenantId?: string
          companyName: string
          contactPerson?: string
          contactPhone?: string
          region?: string
          addressDetail?: string
          remark?: string
          createTime?: string
          updateTime?: string
        }

        type InsuranceCompanySearchParams = Partial<
          Pick<InsuranceCompany, 'companyName' | 'contactPerson' | 'contactPhone'> &
            Api.Common.CommonSearchParams
        >

        interface Supplier {
          id?: string
          tenantId?: string
          supplierName: string
          contactPerson?: string
          contactPhone?: string
          region?: string
          addressDetail?: string
          remark?: string
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
          fieldAccess?: SupplierFieldAccessMap
          isRecordOwner?: boolean
        }

        type SupplierFieldKey = 'contactDetails' | 'addressDetails' | 'internalNotes'
        type SupplierFieldAccessMap = Partial<
          Record<SupplierFieldKey, Api.System.FieldPermissionAccessLevel>
        >

        type SupplierSearchParams = Partial<
          Pick<Supplier, 'supplierName' | 'contactPerson' | 'contactPhone'> &
            Api.Common.CommonSearchParams
        >

        interface PartsCategory {
          id?: string
          tenantId?: string
          parentId?: string | null
          categoryName: string
          categoryCode: string
          categoryLevel?: number
          sort?: number
          status?: Api.Common.EnableStatus
          remark?: string
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
          children?: PartsCategory[]
        }

        type PartsCategorySearchParams = Partial<
          Pick<PartsCategory, 'parentId' | 'categoryName' | 'categoryCode' | 'status'> &
            Api.Common.CommonSearchParams
        >

        interface Parts {
          id?: string
          tenantId?: string
          partName: string
          partCode: string
          categoryId?: string | null
          category?: Pick<PartsCategory, 'id' | 'categoryName'> | null
          brand?: string
          model?: string
          unit?: string
          supplierId?: string | null
          supplier?: Pick<Supplier, 'id' | 'supplierName' | 'contactPerson' | 'contactPhone'> | null
          manufacturer?: string
          supplierContact?: string
          isConsumable?: boolean
          warrantyMileage?: number | null
          warrantyDuration?: number | null
          serviceLife?: number | null
          serviceMileage?: number | null
          status?: Api.Common.EnableStatus
          remark?: string
          createBy?: string
          createTime?: string
          updateBy?: string
          updateTime?: string
        }

        type PartsSearchParams = Partial<
          Pick<
            Parts,
            'partName' | 'partCode' | 'categoryId' | 'brand' | 'model' | 'supplierId' | 'status'
          > &
            Api.Common.CommonSearchParams
        >
      }
    }

    /** TMS 运输管理系统 */
  }
}
