# content/sentences/ — 句子精背数据

500 句精选地道句子，切成 5 册 × 100 句（每册 10 天 × 10 句）。规格见 [specs/009](../../specs/009-sentence-packs/spec.md)。

| 文件 | 内容 |
|---|---|
| `index.json` | 册索引：`[{ id, title, subtitle, count, days }]` |
| `level-1.json` … `level-5.json` | 每册全部句子 |

## 单句结构

```json
{
  "d": 1,              // 册内天 1–10
  "n": 1,              // 册内序号 1–100
  "cat": "think",      // 主题：think 思辨 / work 职场 / daily 日常
  "zh": "中文翻译",
  "seg": [             // 英文按语块切分
    "普通文本 ",
    { "t": "英文语块", "g": "中文注释", "c": "col" }
  ]
}
```

语块类别 `c`：`adv` 高级词 / `col` 固定搭配 / `idi` 习语 / `phr` 短语动词。前端配色见 `frontend/src/lib/sentences.ts` 的 `CHUNK_STYLE`。

改动这些 JSON 后无需重启后端（每次请求现读文件）。
