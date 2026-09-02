import json


async def run(context, messages, image=None, get_provider=None):
    """
    NLPParser: 自然语言记账解析（操作列表版）

    不止解析新增流水，还能识别：账户间转账、余额校准、
    取消预计/固定支出、待生效（先用后付）等高级操作。
    """

    provider = get_provider("deepseek") if get_provider else None

    system_prompt = """你是一个财务记账解析助手。把用户的自然语言解析为【操作列表】，只输出 JSON。

支持的操作（op 字段）：
1. add —— 普通收支流水
   {op, date, type(收入/支出), name, category, amount, account, status, note}
2. transfer —— 账户间转账/充值（钱从一个账户搬到另一个账户，不是消费！）
   {op, date, name, amount, account(转出), to_account(转入), note}
3. calibrate —— 用户报告某账户当前余额（如"现在微信剩2156"）
   {op, account, balance, date, note}
4. delete_planned —— 取消某项目未来的预计流水（如"酷狗以后不每月扣了"）
   {op, name, from_date, note}
5. delete_fixed —— 从固定支出中移除某项目
   {op, name, note}
6. add_fixed —— 新增每月固定支出
   {op, name, amount, cycle(月付/年付), method, note}

解析规则：
- 日期缺省用今天；用户说"7.12"指 2026-07-12
- 分类：餐饮、交通、购物、娱乐、住房、教育、通讯、工具/会员、医疗、人情、其他支出、其他收入、家庭资助、家庭借款、奖学金、工资
- "充值岭南通/充话费到某卡"等账户间搬钱 = transfer（账户→岭南通），**不要再生成对应的支出流水**
- 刷岭南通乘车/消费 = 普通支出，account 记为"岭南通"
- "先用后付/还没扣钱/可能退货" = add，status 记"待生效"；其余默认"已到账"
- **分期付款**（如"119块分3期付款/免息分期"）：不要记成一笔！展开为 N 条 add：
  * 第 1 期：购买日，status"已到账"（首付已扣）
  * 第 2~N 期：日期逐月 +1，status"待生效"（平台届时自动扣，用户看到扣款后转正）
  * name 带期数，如"多功能电炒锅（分期1/3）"；note 记"分3期免息，共119，每期39.67"
  * 每期金额 = 总额/N 保留两位小数，**最后一期兜底零头，各期之和必须精确等于总额**（如 119 分 3 期 = 39.67 + 39.67 + 39.66）
  * 若用户说明了不同的首付金额或手续费：首付按实际记第 1 期（手续费并入第 1 期），剩余金额均分到后续各期
- "借款"类同时给 add（收入，分类 家庭借款）和负债说明放在 note
- "预计/下个月要..." = add，source 字段记"预计"，**status 字段必须记"待生效"**（预计代表尚未发生，由用户在账本中点击「确认」才转为"已到账"计入现金；默认"已到账"是错的）
- 用户报告余额（"现在XX剩YY"）= calibrate，不要生成收支流水
- 账户名从上下文识别：微信、银行卡、现金、支付宝、岭南通；未指明时用"微信"

输出格式（只输出 JSON，不要任何解释）：
{
  "operations": [ ... ],
  "summary": "一句话概括解析结果"
}"""

    user_content = messages[-1]["content"] if messages else ""

    full_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请解析以下记账内容：\n\n{user_content}"}
    ]

    if provider:
        response = await provider.chat(full_messages)
        model_used = "deepseek-chat"
    else:
        response = offline_parse(user_content)
        model_used = "local-offline"

    return {
        "response": response,
        "actions": [{"type": "parse_operations", "data": response}],
        "model_used": model_used,
        "tokens_used": 0,
    }


def offline_parse(text: str) -> str:
    """离线简单解析（无AI时回退）"""
    import re
    from datetime import datetime

    today = datetime.now().strftime("%Y-%m-%d")
    operations = []

    amounts = re.findall(r'(\d+(?:\.\d+)?)\s*(?:元|块|￥|¥)?', text)
    for amt in amounts:
        operations.append({
            "op": "add",
            "date": today,
            "type": "支出",
            "name": "未命名",
            "category": "其他支出",
            "amount": float(amt),
            "account": "微信",
            "status": "已到账",
            "note": text[:50],
        })

    return json.dumps({
        "operations": operations,
        "summary": f"离线解析：提取到 {len(operations)} 笔交易，请核对",
    }, ensure_ascii=False, indent=2)
