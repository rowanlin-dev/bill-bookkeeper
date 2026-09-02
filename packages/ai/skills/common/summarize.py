async def run(context, messages, image=None, get_provider=None):
    """文本摘要技能"""
    provider = get_provider("deepseek") if get_provider else None
    
    system_prompt = "你是一个文本摘要助手。请将用户提供的内容提炼为简洁的要点，保留关键数字和结论。"
    
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    
    if provider:
        response = await provider.chat(full_messages)
    else:
        response = "[AI服务未配置]"
    
    return {
        "response": response,
        "actions": [],
        "model_used": "deepseek-chat",
        "tokens_used": 0,
    }
