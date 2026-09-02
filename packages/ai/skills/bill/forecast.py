async def run(context, messages, image=None, get_provider=None):
    """
    Forecast: 现金流预测分析

    接收前端/后端传入的现金流数据快照，由 LLM 生成风险分析与建议。
    """
    provider = get_provider("deepseek") if get_provider else None

    system_prompt = """你是一位个人财务分析师。用户会给你他/她的现金流数据快照（当前现金、日均支出、每月固定支出、未来预测余额、预计收支事件、负债等）。

请输出：
1. 现金流健康状况判断（1 句话）
2. 未来风险点：按时间顺序指出具体日期和金额缺口；如果没有风险，明确说"未来 90 天无断粮风险"
3. 3 条可执行建议（具体、量化、贴合数据）

要求：简洁、用中文、用数字说话，不要空泛的套话。"""

    user_content = messages[-1]["content"] if messages else ""

    if provider:
        response = await provider.chat([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ])
        model_used = "deepseek-chat"
    else:
        response = "AI 未配置 API Key，请先在「设置」页配置后再使用现金流分析。"
        model_used = "local"

    return {
        "response": response,
        "actions": [{"type": "forecast", "data": {}}],
        "model_used": model_used,
        "tokens_used": 0,
    }
