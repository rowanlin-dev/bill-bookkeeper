async def run(context, messages, image=None, get_provider=None):
    """
    Advisor: 支出分析与建议
    
    分析用户支出模式，给出控制建议。
    """
    
    provider = get_provider("deepseek") if get_provider else None
    
    transactions = context.get("transactions", [])
    liabilities = context.get("liabilities", [])
    
    # 统计本周支出
    from datetime import datetime, timedelta
    today = datetime.now()
    week_ago = today - timedelta(days=7)
    
    week_expenses = [t for t in transactions 
                     if t.get("type") == "支出" 
                     and t.get("date", "") >= week_ago.strftime("%Y-%m-%d")
                     and t.get("source") != "预计"]
    
    week_total = sum(t["amount"] for t in week_expenses)
    week_daily_avg = week_total / 7 if week_expenses else 0
    
    # 构建分析数据
    analysis_data = {
        "week_total": round(week_total, 2),
        "week_daily_avg": round(week_daily_avg, 2),
        "expense_count": len(week_expenses),
        "top_categories": sorted(
            [(cat, sum(t["amount"] for t in week_expenses if t.get("category") == cat))
             for cat in set(t.get("category") for t in week_expenses)],
            key=lambda x: x[1], reverse=True
        )[:3],
        "upcoming_liabilities": [l for l in liabilities if l.get("status") != "已还"],
    }
    
    system_prompt = """你是一个温和的财务顾问。请基于用户的支出数据给出洞察和建议。

原则：
1. 只展示积极面，不指责
2. 建议要具体可操作
3. 语气像朋友聊天
4. 如果数据不足，诚实说明"""
    
    user_prompt = f"""请分析我的本周支出：

本周支出：¥{analysis_data['week_total']}（{analysis_data['expense_count']}笔）
日均：¥{analysis_data['week_daily_avg']}

主要分类：
{chr(10).join(f"- {cat}: ¥{amt:.2f}" for cat, amt in analysis_data['top_categories'])}

待还负债：
{chr(10).join(f"- {l.get('name', '')}: ¥{l.get('amount', 0)}" for l in analysis_data['upcoming_liabilities'])}

请给出建议。"""
    
    if provider:
        response = await provider.chat([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ])
    else:
        response = generate_offline_advice(analysis_data)
    
    return {
        "response": response,
        "actions": [{"type": "advice", "data": analysis_data}],
        "model_used": "deepseek-chat" if provider else "local",
        "tokens_used": 0,
    }

def generate_offline_advice(data: dict) -> str:
    """离线建议生成"""
    lines = ["📊 本周支出分析", ""]
    lines.append(f"本周共支出 ¥{data['week_total']:.2f}，日均 ¥{data['week_daily_avg']:.2f}")
    
    if data['top_categories']:
        lines.append(f"\n主要支出：{data['top_categories'][0][0]} ¥{data['top_categories'][0][1]:.2f}")
    
    if data['upcoming_liabilities']:
        lines.append(f"\n⚠️ 待还负债 {len(data['upcoming_liabilities'])} 笔")
    
    lines.append("\n💡 建议：")
    if data['week_daily_avg'] > 100:
        lines.append("- 日均支出偏高，建议控制非必要消费")
    else:
        lines.append("- 支出控制在合理范围，继续保持")
    
    lines.append("- 记录每笔支出，养成记账习惯")
    
    return "\n".join(lines)
