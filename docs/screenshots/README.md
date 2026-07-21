# 界面截图存放目录

本目录用于存放 README「界面预览与核心流程」章节引用的真实界面截图。

## 计划补充的截图（对应 README 占位清单）

| 文件名 | 内容 |
|--------|------|
| `dual-mode-entry.png` | 员工后台「预审单」入口 + 访客扫码自助预约页（`/public/appointment`） |
| `host-review.png` | 被访人（员工）在「我的预约 / 待审核」中审批访客 |
| `guard-checkin.png` | 门卫搜索访客、黑名单拦截、按类型自动匹配通行牌颜色并签到 |

## 提交后如何生效

把图片放入本目录后，到 `README.md` 的「界面预览与核心流程」章节，将对应清单项改为：

```md
![双模式登记入口](docs/screenshots/dual-mode-entry.png)
```

即可在 GitHub 上正常渲染。
