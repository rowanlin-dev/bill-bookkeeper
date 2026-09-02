async def run(context, messages, image=None, get_provider=None):
    """
    DebtOptimizer: 还款优化
    
    分析多笔负债，建议最优还款顺序。
    """
    liabilities = context.get("liabilities", [])
    
    # 简单排序：到期日近的优先，利率高的优先
    sorted_liabilities = sorted(
        liabilities,
        key=lambda x: (x.get("due_date", "9999"), -float(x.get("rate", "0").replace("%", "") or 0))
    )
    
    advice = "建议还款顺序（按优先级）：\n"
    for i, l in enumerate(sorted_liabilities, 1):
        advice += f"{i}. {l.get('name', '')}: ¥{l.get('amount', 0)} (到期: {l.get('due_date', '无')})\n"
    
    return {
        "response": advice,
        "actions": [{"type": "debt_optimize", "data": {"order": sorted_liabilities}}],
        "model_used": "local",
        "tokens_used": 0,
    }
