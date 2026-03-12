// ─── 基础数据类型 ───────────────────────────────────────────────

export type Meta = { [key: string]: string }

export type Row = { [key: string]: string }

// ─── 可视化图表 ─────────────────────────────────────────────────

export interface VizFilter {
  field: string
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'
  value: string
}

export interface VizConfig {
  id: string
  title: string
  type: 'bar' | 'line' | 'area' | 'scatter'
  xField: string
  yFields: string[]
  filters: VizFilter[]
  _collapsed?: boolean
}

// ─── 历史记录 ───────────────────────────────────────────────────

export interface HistoryRecord {
  id: string
  caseId: string
  importTime: string
  importedBy: string           // user id
  importedByName?: string      // 显示名（join 查询带出）
  sectionTag: string
  meta: Meta
  fields: string[]
  labels: string[]
  rows: Row[]
  colConfig: Record<string, boolean>
  pageSize: number
  vizConfigs: VizConfig[]
  sortOrder: number
}

// ─── 权限角色 ───────────────────────────────────────────────────

export type CaseRole = 'owner' | 'editor' | 'viewer'

// ─── 案例成员 ───────────────────────────────────────────────────

export interface CaseMember {
  id: string
  caseId: string
  userId: string
  role: CaseRole
  joinedAt: string
  profile: {
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
}

// ─── 邀请链接 ───────────────────────────────────────────────────

export interface CaseInvite {
  id: string
  caseId: string
  role: CaseRole
  token: string
  expiresAt: string
  maxUses: number | null
  useCount: number
  createdAt: string
}

// ─── 工程案例 ───────────────────────────────────────────────────

export interface Case {
  id: string
  name: string
  ownerId: string
  createdAt: string
  updatedAt: string
  // 附加字段（API join 带出）
  myRole?: CaseRole
  memberCount?: number
  historyCount?: number
}

// ─── 用户 Profile ────────────────────────────────────────────────

export interface Profile {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  wechatOpenid: string | null
  isAdmin: boolean
  isBanned: boolean
  createdAt: string
  updatedAt: string
}

// ─── 多表关联 ───────────────────────────────────────────────────

export type JoinOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'

export interface JoinFilter {
  field: string
  op: JoinOp
  value: string
}

export interface JoinState {
  leftId: string
  rightId: string
  leftKey: string
  rightKey: string
  leftFields: string[]
  rightFields: string[]
  leftFilters: JoinFilter[]
  rightFilters: JoinFilter[]
  resultName: string
}

// ─── API 响应通用格式 ────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: { message: string; code?: string } | null
}

// ─── 解析结果 ───────────────────────────────────────────────────

export interface ParseResult {
  ok: boolean
  msg?: string
  record?: {
    sectionTag: string
    meta: Meta
    fields: string[]
    labels: string[]
    rows: Row[]
  }
}
