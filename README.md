# AI 风险情绪异质性研究

本仓库用于构建 AI 风险语料库，并微调 `google-bert/bert-base-chinese` 输出：

`P = [P(anger), P(fear)]`

两个标签相互独立，允许一条文本同时包含愤怒与恐惧，也允许两者均不包含。这样不会把中性、悲伤、讽刺等文本强制归入 Anger/Fear。

## 协作规则与交接 Prompt

主分支 `main` 保存经审查的共享版本。本次同步后，项目发起人在 `codex/huangyt-work` 工作；其他成员使用各自的 `codex/<姓名>-<任务>` 分支。后续不直接向 main 推送，通过 Pull Request 审查后合并，不强制推送、不覆盖他人改动。分支保护需要仓库管理员在 GitHub 设置中启用，本文不代表已启用。

开始工作先 `git fetch origin`，确认工作区状态；个人分支通过 `git merge origin/main` 同步。提交只包含本任务文件；推送个人分支后创建以 main 为目标的 PR，写明修改范围、数据增量、验证结果、遗留问题与断点。合并后再次同步 main。

Excel 是二进制文件，禁止两人同时修改同一工作簿。采集者提交独立且不重名的 `data/observed/e12_batch_*.json`，由本轮指定的一名汇总者串行执行追加脚本并提交工作簿。发生冲突时保留双方观察批次，由最新 main 表重放新增批次和去重核验，不能简单选 ours/theirs。合并前核对批次是否已入表。

可复制给协作者或 AI 的 Prompt：

```text
你正在协作 AI 风险情绪异质性研究。先读 README、docs 和现有脚本，检查 git status 与 origin/main；在自己的 codex/<姓名>-<任务> 分支工作，不直接推送 main，不覆盖其他人的未提交修改。
本轮只完成明确分配的事件和根帖。第三事件以 outputs/e12_verified_20261026/韩国Deepfake_已核验采集表.xlsx 为已核验基线，不把旧表或未经核实的记录混入。先检查采集断点和已有节点，优先补根帖发布后6小时数据。
只记录平台实际可见的正文、时间、互动和关系；缺失不写0，不虚构节点，不将引用链等同已验证父子边。保留线程归属，未知直接父节点留空。纯表情、纯标点和默认转发排除但记录原因，含实质文字的表情文本保留。保留来源与采集时间，匿名化作者和@用户名。Cookie、密码、令牌、浏览器会话、依赖目录与备份不得提交；不绕过验证码或访问限制。
采集以小批次进行，失败等待后有限重试，登录失效请用户操作。使用独立观察JSON保留证据，再由指定汇总者串行追加工作簿。核验唯一性、正文、时间窗口、根帖归属及线程关联，报告新增和累计数量、早期6小时数量、可见与标称数量差额及剩余任务。不得把部分采集声称完整，不得将帖子观点称为已证实事实。
代码变更执行相关测试；数据变更执行追加与审计脚本。提交并推送自己的分支，通过PR合并main；交接写清文件、验证、断点和下一步。BERT按根帖分组切分，禁止训练测试泄漏，当前不得宣称已完成正式训练。
```

## 最新进度（2026-11-18）

第三事件已核验表包含37条候选根帖、72条评论、170条回复、118条转发及48条排除记录；360条有效传播文本，仍在采集，非完整事件样本。OuDxv8Uef早期6小时61条，Ouy72x6Cb为37条。下一步继续两帖未完回复与更早转发，随后扩展其他根帖。历史正式表保留供追溯，不与已核验表自动混合。观察批次与追加/审计脚本位于 data/observed 和 tools。

## 历史研究状态（2026-10-11，以下为当时计划）

已完成：

- OpenClaw 安全预警事件的候选根帖、评论、回复和转发可见数据整理；
- AI 照片获得摄影比赛第一名事件的 37 条根帖逐帖检查；
- 两个事件的正式实验工作簿，均区分标称互动量与平台实际可见节点；
- 面向多标签 Anger/Fear 的清洗、人工标注、分组切分、BERT 微调、概率推理和传播指标计算代码。

当前尚未训练正式模型。下一步按 [`docs/next_steps.md`](docs/next_steps.md) 执行：先从两个事件抽取统一标注批次，完成双人标注和一致性检验，再进行第一次 BERT 微调；随后采集韩国 Deepfake 性暴力事件并训练跨事件最终模型。

## 研究流程

1. 按 `data/raw/schema.csv` 组织匿名化原始文本，保留来源、事件、时间和互动指标。
2. 运行清洗与去重，生成待标注样本。
3. 两名标注者独立标注 `anger`、`fear`，冲突样本交由第三人仲裁。
4. 按 `root_post_id` 分组切分 train/validation/test，禁止同一根帖下文本泄漏到不同集合。
5. 微调 BERT，报告每类 Precision、Recall、F1、Macro-F1 与概率校准结果。

## 环境

建议直接使用 Google Colab（无本地 NVIDIA GPU 时更省时），或安装 Python 3.10/3.11 后执行：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## 目录说明

- `data/raw/`：已匿名化的原始采集数据与字段模式；
- `data/interim/`、`data/processed/`：清洗、汇总及建模中间数据；
- `outputs/`：OpenClaw 和 AI 摄影比赛两份正式实验工作簿；
- `src/ai_risk_emotion/`：数据清洗、标注、BERT 训练、预测与传播分析代码；
- `docs/`：采集规范、标注指南、事件与关键词表、后续计划；
- `tools/`：工作簿构建、增量写入和核验脚本；
- `notebooks/`：可直接在 Google Colab 运行的流程样例。

## 数据格式

训练文件至少包含：

- `text`：清洗后的文本；
- `anger`：0/1；
- `fear`：0/1；
- `event_id`：事件编号，用于防止事件泄漏。

原始采集表还应保存 `platform`、`post_id`、`parent_id`、`created_at`、`like_count`、`comment_count`、`repost_count`、`url_hash` 等字段。公开研究数据中不要保存用户名、手机号或原始 Cookie。

## 运行

```powershell
python -m src.ai_risk_emotion.normalize_collection --posts data/raw/openclaw_topic_posts_ranked.csv --nodes data/raw/openclaw_rank01_comments_visible.csv --output-dir data/interim/openclaw
python -m src.ai_risk_emotion.annotation prepare --input data/interim/openclaw/nodes.csv --output data/annotations/batch_001.csv --sample-size 500
python -m src.ai_risk_emotion.split_data --input data/processed/labeled.csv --output-dir data/processed/splits --group-column root_post_id
python -m src.ai_risk_emotion.train --train data/processed/train.csv --validation data/processed/validation.csv --output outputs/bert-base-chinese
python -m src.ai_risk_emotion.batch_predict --input data/interim/openclaw/nodes.csv --model outputs/bert-base-chinese --output data/processed/predictions.csv
python -m src.ai_risk_emotion.analyze --posts data/interim/openclaw/posts.csv --nodes data/interim/openclaw/nodes.csv --predictions data/processed/predictions.csv --output-dir outputs/analysis
```

零基础操作顺序、字段解释和验收点见 [`docs/implementation_guide.md`](docs/implementation_guide.md)。Colab 可直接运行版本见 [`notebooks/ai_risk_pipeline_colab.ipynb`](notebooks/ai_risk_pipeline_colab.ipynb)。

## 合规边界

优先使用平台开放接口、公开数据集或用户自行导出的数据。不要把 Cookie 提交到仓库；如后续确需登录态，只通过本机环境变量或忽略的 `.env` 注入，并遵守平台条款、频率限制、个人信息保护与研究伦理要求。
