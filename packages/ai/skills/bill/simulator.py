async def run(context, messages, image=None, get_provider=None):
    """
    Simulator: 情景模拟
    
    模拟不同收入/支出情景下的资金走势。
    """
    provider = get_provider("deepseek") if get_provider else None
    
    system_prompt = """你是一个财务情景模拟器。请基于用户提供的参数，模拟未来资金走势。

参数：
- 当前资金
- 月收入
- 月支出
- 入职时间
- 特殊支出（学费、还款等）

输出：逐月资金预测表，标注风险点。"""
    
    user_content = messages[-1]["content"] if messages else ""
    
    if provider:
        response = await provider.chat([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ])
    else:
        response = "情景模拟功能：请输入参数，如'如果8月入职月薪8000，资金走势如何？'"
    
    return {
        "response": response,
        "actions": [{"type": "simulate", "data": {}}],
        "model_used": "deepseek-chat" if provider else "local",
        "tokens_used": 0,
    }
