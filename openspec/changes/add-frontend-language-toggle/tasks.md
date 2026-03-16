1. [ ] 创建轻量级 i18n 模块（语言上下文/Provider + 翻译表），从 `localStorage` 读取/写入语言偏好，在没有记录时默认为 zh-CN。
   - 验证：为 Provider Hook 编写单元测试，确认它能加载默认值、更新状态并写入 `localStorage`。
2. [ ] 更新登录相关组件（`frontend/src/features/auth/pages.tsx`）以消费 i18n 上下文、翻译所有可见文案，并提供即时生效的语言切换按钮。
   - 验证：在浏览器中手动 QA，确认切换语言会更新全部登录文案并在刷新后保持。
3. [ ] 更新登录后的头部（`frontend/src/components/layout/app-shell.tsx`），加入同样的切换按钮，翻译头部和退出相关文案，并保持导航文本与所选语言一致。
   - 验证：手动 QA，确认登录后的导航在切换路由及退出/重新登录后依然保持选定语言。
