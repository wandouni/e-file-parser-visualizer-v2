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
【登录页】
========================================
1 【登录表单区】
  包含品牌标识、标题与登录表单

1.1 【邮箱输入框】
    文本输入，类型为 email，必填，聚焦时高亮边框
1.2 【密码输入框】
    密码输入，必填，右侧有【显示/隐藏密码】切换按钮，聚焦时高亮边框
1.3 【错误提示】
    登录失败或账号封禁时显示错误信息，来自接口返回或 URL 参数
1.4 【登录按钮】
    提交表单，加载中状态下禁用并显示「登录中...」，成功后跳转至【案例列表页】或 redirect 参数指定的页面
1.5 【注册链接】
    点击跳转至【注册页】
========================================
`,
  },
]
