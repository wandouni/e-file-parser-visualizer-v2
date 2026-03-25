// 由 live-spec skill 自动生成，请勿手动编辑

export interface SpecVersion {
  version: string
  label: string
  note: string
  createdAt: string
  spec: string
}

export const history: SpecVersion[] = [
  {
    version: 'v1',
    label: 'v1 · 2026-03-25 14:00',
    note: '',
    createdAt: '2026-03-25T14:00:00.000Z',
    spec: `
【管理后台 - 系统总览】
========================================
1 【页面标题】
  显示「系统总览」标题

2 【统计卡片组】
  展示系统核心数据指标，共4张卡片

2.1 【注册用户】
    显示系统总注册用户数，附带近7天新增数量
2.2 【案例总数】
    显示系统内案例总数，附带近7天新增数量
2.3 【数据集总数】
    显示所有案例下数据集总数
2.4 【封禁用户】
    显示当前处于封禁状态的用户数量
========================================
`,
  },
]
