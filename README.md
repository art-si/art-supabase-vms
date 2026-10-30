<div align="center">
  <h1>亿企工场 VMS</h1>
  <p><strong>围绕“一车一档”的车辆全生命周期管理应用</strong></p>
  <p>统一车辆档案、证照合规、维修保养、事故违章、零部件、里程与风险提醒。</p>

  <p>
    <a href="https://gitee.com/art-si/art-supabase-vms">Gitee</a>
    ·
    <a href="https://github.com/art-si/art-supabase-vms">GitHub</a>
    ·
    <a href="https://gitee.com/art-si/art-supabase-pro">主平台</a>
    ·
    <a href="https://art-si.github.io/art-supabase-doc/modules/vms">使用文档</a>
  </p>
</div>

## 项目定位

亿企工场 VMS 是亿企工场的车辆管理业务应用。它以车辆档案为主线，聚合司机、证照、保险、年检、维修、事故、违章、例检、里程、零部件与设备信息，支持从建档审核到退役提醒的连续治理。

本仓只维护 VMS 页面、业务 API、领域类型、车辆规则与专属 Edge Function。认证、租户、菜单、权限、布局、路由、公共组件、Store 和 Supabase 公共客户端由 [`art-supabase-pro`](https://gitee.com/art-si/art-supabase-pro) 统一提供。

![车辆全生命周期档案](screenshots/vehicle-lifecycle.png)

## 核心能力

| 领域       | 已覆盖能力                                                   |
| ---------- | ------------------------------------------------------------ |
| 档案与查询 | 车辆建档、车型规格、编辑、审核、详情聚合、综合查询与状态管理 |
| 证照与合规 | 保险、年检、违章、事故、证照附件与到期治理                   |
| 运行与维护 | 维修保养、日常例检、里程记录、车辆设备与历史追踪             |
| 零部件     | 配件分类、配件资料、供应商、领用安装、替换与寿命跟踪         |
| 风险提醒   | 保险、年检、保养、配件和车辆使用寿命提醒与处置工单           |
| 智能分析   | 车队健康概览、单车风险聚合与 AI 车辆健康建议                 |

## 一车一档

```text
车辆基础档案
  ├─ 司机与归属
  ├─ 保险 / 年检 / 违章 / 事故
  ├─ 维修 / 例检 / 里程
  ├─ 配件 / 设备 / 附件
  └─ 到期提醒 / 风险工单 / 健康分析
```

AI 健康建议用于汇总现有档案、解释风险和辅助排查，不替代人工检查、法定检验或专业维修判断。

## 车型规格与车辆档案

车型分类来自 `vehicleTypeCategory` 字典；每个租户在 `vehicle_type_profile` 中维护车长、容积、载重、状态、排序和可选图片。车长通常必填（按载重分类除外），容积与载重可留空。车辆档案保存所选规格 ID，数据库在写入时校验规格处于同一租户且已启用，并带入车型分类和三项参数；表单不直接提交这些派生参数。车辆归属来自 `vehicleOwnership` 字典，默认自营。

列表、保存、删除分别调用 `vms_list_vehicle_type_profiles_secure`、`vms_save_vehicle_type_profile_secure`、`vms_delete_vehicle_type_profile_secure`。这三个 RPC 按车辆档案按钮权限和当前租户读取范围校验，支持平台全租户模式下显式选定目标租户。2026-09-27 已验证普通用户本租户读取与写入、伪造跨租户查询拒绝、数据库带入车型参数；浏览器完成新增、修改、删除规格及车辆参选带入流程。演示租户保留半挂车 13 米、高栏车 8 米两条启用规格。

2026-09-28 将 `vehicle_type_profile.volume_m3`、`load_tons` 和保存 RPC 对应校验改为允许留空。先在事务内验证空值规格可保存并回滚，再确认两列均允许 `NULL`、保存函数只要求车型分类。车型参选仅展示已启用的现有规格；所选车长与同一规格记录中的容积、载重一起带入车辆档案。

车型分类、规格参选和默认插画复用主仓库 `src/components/business/vehicle-type-profile-picker`；VMS 车辆/挂车与 TMS 司机提成使用同一套视觉组件，TMS 开单复用其中的车型插画。各模块继续通过自身的安全 API 加载租户内启用规格。上传的规格图片只覆盖该规格的默认展示。

## 证件作废与换证门禁（2026-10-29）

- `vehicle_certificate` 将作废时间、上海时区作废日期、操作人和原因分别记录为 `revoked_at`、`revoked_on`、`revoked_by`、`revoked_reason`。作废保留原证和提醒历史；`handled_at` 仍只表示续证处置，两种状态不能混用。作废的当前证件停止后续提醒，待补证风险在证件中心和车辆档案中单独呈现。
- 作废经 `CertificateCenter:Revoke` 按钮及 `vms_revoke_certificate_secure` 执行，服务端复核按钮权限、当前租户和当前证件。只有通过 `renewal_of_id` 关联、已生效且仍有效的新证才能解除作废派车拦截；作废旧证可换发有效期更短的新证，未作废证件的常规续证仍要求新证截止日更晚。
- 本次变更在 Supabase 项目 `ckbftoopuyophiebamwy` 先以事务回滚验证，再直接执行。执行前函数、菜单与列的快照为主仓忽略目录 `.artifacts/before-certificate-revocation.json`，SHA-256：`60DCEE76DBFF714C5466E63204236FC7911ED1F76D82574BDFD8F22EBF10207A`。部署回归在事务内生成作废记录并回滚，原有 10 条证件记录未作废。
- `app_private.vms_revoked_certificate_blockers` 对 `anon`、`authenticated` 均无直接执行权限；公开的作废 RPC 只允许已登录用户调用，并在函数内部检查 `CertificateCenter:Revoke` 和租户范围。部署后安全顾问提示该公开 `SECURITY DEFINER` RPC 可由已登录用户执行，这是受控入口的预期权限；性能顾问提示新审计人外键缺索引后已补 `vehicle_certificate_revoked_by_idx`。部署时尚无作废记录，当时该索引被报告未使用。
- `tests/integration/vms-certificate-revocation.sql` 已通过平台全部、平台选定、普通本租户及伪造跨租户四种范围，以及旧提醒待发/失败投递跳过、后续不再生成、车辆实际派车触发器拦截、关联新证恢复。原有 `vms-certificate-unified-reminder.sql`、`vms-driver-certificate-three-months.sql`、`vms-certificate-legacy-fallback-read.sql`、`vms-dashboard-unified-certificate-counts.sql` 回归通过。浏览器视觉验收由主仓会话继续记录；线下办理窗口地址尚未确定，页面不填假地址。

2026-10-30 在“FMS应收验收租户”另行保留两组明确标记的合成样例：`QA-REV-LIC-001/002` 作废后，分别由 `QA-REV-LIC-001-R1/002-R1` 通过 `renewal_of_id` 替代。新证截止日 2027-01-30 短于原证 2027-10-30；两名自营司机作废期间被门禁阻断，登记新证后均无作废门禁。新证当前为“3 个月内到期”，目前可派车。旧证保留作废审计和已关闭提醒，`handled_at` 仍为空。此流程由受控 RPC 执行，不能作为 GUI 流程通过的证据。写入前快照为 `.artifacts/qa-certificate-revocation-prewrite-2026-10-30.json`。

证件中心的补证与临期指标只统计服务端标为当前版本的证件；已有有效替代证的历史旧证继续显示作废状态，但不再增加当前补证风险。未知版本标识的旧台账仍按原有规则计数。内部浏览器按 `QA-REV-LIC` 筛出四行：两张历史证保持作废、两张新证为临期；待补证 0、临期 2，旧证作废原因可通过标题查看。证据为主仓忽略目录 `.artifacts/vms-certificate-lifecycle-two-1024.jpg`、`.artifacts/vms-certificate-lifecycle-status-two-1024.jpg`。作废与续证的 GUI 提交仍未验证。

同日进一步在真实 GUI 检查司机档案：QA 甲、乙的证件页各正确显示作废旧证 `001/002` 和当前临期新证 `R1`。甲从“管理证件”进入中心时自动带入甲主体，仅显示两行，待补证 0、临期 1；旧历史证没有操作按钮，新 `R1` 提供登记续证、标记已处理和作废。续证表单中主体与证件类型不可修改，证号及日期留空，随后取消，未写入。乙首次从档案进入中心时曾错误沿用甲的两行且无加载提示，修复前截图为主仓 `.artifacts/vms-certificate-subject-switch-stale-before-1280.jpg`。现已在主体切换时按路由主体重建表格、取消旧请求并清理指标及筛选状态，同时收紧旧历史证续证入口与处理器校验；六项策略测试及格式、ESLint、VMS 类型检查、UI 审计和差异检查通过。内部浏览器恢复平台全部租户登录后，完成甲→乙→甲自动切换复验：乙中心自动显示 `002` 两行、待补证 0、临期 2，按 `002-R1` 查询一行后重置仍显示乙两行且关键词清空；返回甲中心自动显示 `001` 两行、待补证 0。乙的旧证无按钮、新 `R1` 菜单可用；已阅读作废确认的中文后果并以 Esc 取消。1024 宽度下页面无横向溢出。新增截图证据为主仓 `.artifacts/vms-certificate-context-qa002-reset-1280.jpg`、`.artifacts/vms-certificate-context-return-qa001-1280.jpg`、`.artifacts/vms-certificate-context-return-qa001-1024.jpg`。作废和续证的 GUI 提交均未执行；OCR 图片与字段权限的进一步验收仍待授权。原有截图包括 `.artifacts/tms-driver-certificate-history-qa001-1280.jpg`、`.artifacts/tms-driver-certificate-history-qa002-1280.jpg`、`.artifacts/vms-certificate-renewal-current-only-qa001-1280.jpg`、`.artifacts/vms-certificate-renewal-current-only-qa002-1280.jpg`、`.artifacts/vms-certificate-renewal-form-qa001-1280.jpg`。

2026-10-30 获明确授权后，在内部浏览器分别为两笔合成 `TEST ONLY` 油卡流水 `QA-CONSUME-001/002` 补传并保存一张现场凭证；列表各显示 1 张，两张明细中的图片均完整显示为 720×840。补传窗口现显示业务凭证号以区分同卡流水，窗口与保存后的证据见主仓忽略目录 `.artifacts/vms-fuel-voucher-upload-target-qa001-1280.jpg`、`.artifacts/vms-fuel-voucher-two-saved-focus-1280.jpg`、`.artifacts/vms-fuel-voucher-001-detail-1024.jpg`、`.artifacts/vms-fuel-voucher-002-detail-1280.jpg`、`.artifacts/vms-fuel-voucher-001-saved-detail-crop.jpg`。1024 视口无页面横向溢出，图片区域可滚动；焦点模式可进入并通过退出按钮或 Esc 恢复。两笔保存前均完成正式 RPC 的事务回滚演练；保存后完整 JSON 对比仅两条流水的 `voucher_paths` 改变，新增审计 2 条、私有对象 2 个，金额、流水余额、两张卡完整记录及最新余额流水未变，卡余额仍为 1615 元与 1185 元。备份及 SHA-256 见主仓 `.artifacts/qa-fuel-card-voucher-20261030-before.json`（`9CCEF925494303A92B4EF2226333D9C85D0851801166E13019A3CA710A792805`）、`.artifacts/qa-fuel-card-voucher-20261030-before-002.json`（`002B92DD9423D4FAED20692E09B2CA09A644A3E968F9A1F41BFDAB7C9558BAFE`）、`.artifacts/qa-fuel-card-voucher-20261030-after.json`（`9BEA76927003375A4EA62C34ECDD11A4A507252EF2AC7AB8BB0A630BD5410481`）。现场图片新标签页标题为 720×840，但该非 HTML 标签页的 DOM 与截图读取超时，尚不能据此声称已完成独立大图视觉验收。

## 独立运行

环境要求：Node.js `>= 22.0.0`、pnpm `>= 11.9.0`。

```powershell
pnpm install
pnpm dev
```

默认访问 `http://localhost:3015`。

```powershell
pnpm check
pnpm build
pnpm preview
```

生产构建输出到 `docs/`，默认公共路径为 `/art-supabase-vms/`，可作为 Pages 发布目录。

## 与主仓协作

VMS 业务修改在本仓提交并推送，随后在主仓更新 `modules/art-supabase-vms` 子模块指针。数据库菜单继续使用稳定的 `/vms/...` 路由前缀；HR/TMS 数据通过租户隔离、字段最小化的安全 RPC 读取，本仓不直接导入其他业务仓源码。

## 安全原则

- 车辆档案新增、编辑、提交、审核和删除分别受精确按钮权限与服务端规则控制。
- 跨模块只读取用途所需的最小字段，业务写入仍由 VMS 自己的 API/provider 负责。
- 页面可见不代表后端授权，数据库 RLS 和 RPC 校验是最终安全边界。

## 许可证

本项目采用 [MulanPSL-2.0](LICENSE) 许可证。
