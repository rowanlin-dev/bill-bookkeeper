async def run(context, messages, image=None, get_provider=None):
    """
    ExcelStyler: Excel美化
    
    对Excel进行轻度美化。
    """
    return {
        "response": "Excel美化功能：\n- 表头样式\n- 条件格式\n- 自动列宽\n- 货币格式\n- 分类色标",
        "actions": [{"type": "style_excel", "data": {}}],
        "model_used": "local",
        "tokens_used": 0,
    }
