async def run(context, messages, image=None, get_provider=None):
    """
    DashboardGen: Web看板数据生成
    
    从交易数据生成看板所需的JSON数据。
    """
    
    transactions = context.get("transactions", [])
    liabilities = context.get("liabilities", [])
    fixed_expenses = context.get("fixed_expenses", [])
    
    # 计算核心指标
    actual_income = sum(t["amount"] for t in transactions if t.get("type") == "收入" and t.get("source") != "预计")
    actual_expense = sum(t["amount"] for t in transactions if t.get("type") == "支出" and t.get("source") != "预计")
    current_cash = actual_income - actual_expense
    
    # 分类统计
    cat_exp = {}
    for t in transactions:
        if t.get("type") == "支出" and t.get("source") != "预计":
            cat = t.get("category", "其他")
            cat_exp[cat] = cat_exp.get(cat, 0) + t["amount"]
    
    # 日统计
    daily = {}
    for t in transactions:
        if t.get("source") == "预计":
            continue
        d = t.get("date", "")[:10]
        if d not in daily:
            daily[d] = {"income": 0, "expense": 0}
        if t.get("type") == "收入":
            daily[d]["income"] += t["amount"]
        else:
            daily[d]["expense"] += t["amount"]
    
    # 现金流预测（简化版）
    monthly_fixed = sum(f.get("amount", 0) for f in fixed_expenses)
    
    dashboard_data = {
        "kpi": {
            "current_cash": round(current_cash, 2),
            "total_income": round(actual_income, 2),
            "total_expense": round(actual_expense, 2),
            "monthly_fixed": monthly_fixed,
        },
        "category_expense": cat_exp,
        "daily_stats": daily,
        "liabilities": liabilities,
        "fixed_expenses": fixed_expenses,
    }
    
    return {
        "response": json.dumps(dashboard_data, ensure_ascii=False, indent=2),
        "actions": [{"type": "update_dashboard", "data": dashboard_data}],
        "model_used": "local",
        "tokens_used": 0,
    }

import json
