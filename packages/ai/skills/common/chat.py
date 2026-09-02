async def run(context, messages, image=None, get_provider=None):
    """通用聊天技能"""
    provider = get_provider("deepseek") if get_provider else None
    
    if provider:
        response = await provider.chat(messages)
    else:
        response = "[AI服务未配置] 请配置API Key后使用。"
    
    return {
        "response": response,
        "actions": [],
        "model_used": "deepseek-chat",
        "tokens_used": 0,
    }
