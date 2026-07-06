# content/ — 入库的静态学习内容

与 `history/`（运行时缓存，不入库）不同，这里是**产品自带**的内容，随仓库分发。

| 目录 | 内容 |
|---|---|
| `sentences/` | 句子精背的 500 句精选（5 册 × 100 句），见 [sentences/README](./sentences/README.md) |

新增内容类型时：在此建子目录 + README，后端在 `routes_content.py` 加只读路由（参考 sentences 的做法），并写对应规格。
