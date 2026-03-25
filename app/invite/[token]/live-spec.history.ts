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
【邀请接受页】
========================================
1 【邀请处理区】
  通过 URL 中的 token 自动调用接口处理邀请，根据结果展示不同状态

1.1 【加载状态】
    页面挂载后自动请求接口，显示加载动画和「正在处理邀请链接...」提示
1.2 【成功状态】
    接口返回成功时显示确认图标及「已成功加入案例，正在跳转...」提示，1.5 秒后自动跳转至【工作区页】
1.3 【失败状态】
    接口返回错误时显示错误图标、「加入失败」标题及错误详情
    1.3.1 【返回案例列表】
        点击跳转至【案例列表页】
========================================
`,
  },
]
