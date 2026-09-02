async def run(context, messages, image=None, get_provider=None):
    """
    VisionParser: 图片记账
    
    识别账单截图，提取交易信息。
    """
    provider = get_provider("deepseek") if get_provider else None
    
    if image and provider:
        response = await provider.chat_with_vision([
            {"role": "system", "content": "请识别这张账单截图中的交易信息，包括日期、商户、金额、类型。"},
            {"role": "user", "content": "分析这张账单"}
        ], image)
    else:
        response = "请上传账单截图，AI将自动识别交易信息。"
    
    return {
        "response": response,
        "actions": [{"type": "vision_parse", "data": {}}],
        "model_used": "deepseek-chat" if provider else "local",
        "tokens_used": 0,
    }
