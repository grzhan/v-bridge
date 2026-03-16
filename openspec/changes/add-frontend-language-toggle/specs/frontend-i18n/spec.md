## ADDED Requirements
### Requirement: 语言偏好持久化
前端 MUST 管理一个适用于 zh-CN 与 en 的共享语言偏好，并存入 `localStorage`，以便在刷新或导航时保持。

#### Scenario: 无存储时的默认语言
- **GIVEN** `localStorage` 中没有语言键
- **WHEN** 应用加载
- **THEN** 默认选择 zh-CN
- **AND** 所有消费方（登录页、头部）都会渲染中文，直到用户切换语言。

#### Scenario: 持久化语言选择
- **GIVEN** 用户在任一语言切换器中选择 en
- **WHEN** 页面刷新或跳转到其他路由
- **THEN** UI 立即使用英文渲染
- **AND** 存储的偏好会保持为 en，直到用户手动切回 zh-CN。

### Requirement: 登录页语言切换
登录体验 MUST 提供一个切换器，在认证前利用共享语言状态切换界面语言。

#### Scenario: 登录前即可切换
- **GIVEN** 登录页已渲染
- **WHEN** 用户点击语言切换按钮
- **THEN** 登录标题、标签、按钮文案、辅助说明和静态错误信息会在 zh-CN 与 en 间切换，且无需刷新页面。

### Requirement: 登录后头部语言切换
用户登录后，头部 MUST 提供相同的切换器，让用户在壳层内随时更改语言。

#### Scenario: 切换器更新头部文本
- **GIVEN** 已登录用户正在查看头部（如 `frontend/src/components/layout/app-shell.tsx`）
- **WHEN** 用户通过头部切换器切换语言
- **THEN** 头部文案（系统描述、退出按钮文字、切换提示）会以所选语言重新渲染
- **AND** 该偏好在全局更新，后续页面及再次登录时沿用同一语言。
