/**
 * zod schema：结构化输出（Q5），替代旧的 extractJson(response) 文本抠取。
 * NLPParser 与 VisionParser 复用同一份 OpsSchema，
 * 保证图片识别结果与文字记账结果形状一致，前端渲染与确认流程零改动。
 */
const { z } = require('zod');

// 单个记账操作：6 种 op
const OperationSchema = z.object({
  op: z.enum(['add', 'transfer', 'calibrate', 'delete_planned', 'delete_fixed', 'add_fixed']),
  date: z.string().optional(),
  type: z.enum(['收入', '支出']).optional(),
  name: z.string().optional(),
  category: z.string().optional(),
  amount: z.number().optional(),
  account: z.string().optional(),
  to_account: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(['已到账', '待生效', '已取消']).optional(),
  cycle: z.string().optional(),
  method: z.string().optional(),
  note: z.string().optional(),
});

const OpsSchema = z.object({
  operations: z.array(OperationSchema),
  summary: z.string(),
});

module.exports = { OperationSchema, OpsSchema };
