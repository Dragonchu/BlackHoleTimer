# LC-94 设计一个黑洞计时器

- 目标：基于 Vue 3（Vite）与 GSAP，打造科幻风格黑洞计时器交互页面。
- 规范：所有文档读写基于 /doc；清理过时、合并重复内容；避免提交生成产物。

## 项目结构（关键）
- `index.html`：Vite 入口。
- `src/main.ts`：挂载应用。
- `src/App.vue`：主视图与 GSAP 动画逻辑。
- `src/styles.css`：样式。
- `vite.config.ts`：Vite 配置。

## 本地运行
- 安装依赖：`npm i`
- 开发：`npm run dev`
- 构建：`npm run build`
- 预览：`npm run preview`

## 需求要点（实现同前）
- 实时钟 + 控件（开始计时 + 分钟滚轮）。
- 动画流程：分解粒子 → 黑洞出现 → 轨道运行与逐秒吸附 → 黑洞收缩 → UI 恢复。

## 技术细节
- 使用 `gsap` 与 `MotionPathPlugin` 创建圆形轨道；使用 Vue refs 操作 DOM。
- 粒子数量与倒计时秒数一致；逐秒吸附并销毁。

## 后续建议
- 音效、触摸支持、性能优化（粒子池/WebGL），国际化与可访问性增强。