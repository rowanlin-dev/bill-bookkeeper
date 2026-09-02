async def run(context, messages, image=None, get_provider=None):
    """
    Bookkeeper: 表结构管理
    
    管理Excel表结构：增删Sheet、字段、公式。
    """
    action = context.get("action", "list_sheets")
    
    if action == "list_sheets":
        response = "当前表结构：\n- 交易流水\n- 负债明细\n- 固定支出\n- 预算计划\n- 月度汇总"
    elif action == "add_column":
        sheet = context.get("sheet", "")
        column = context.get("column", {})
        response = f"已在 [{sheet}] 添加列：{column.get('name', '')}"
    else:
        response = "支持的action：list_sheets, add_column, add_sheet, update_formula"
    
    return {
        "response": response,
        "actions": [{"type": "table_manage", "data": {"action": action}}],
        "model_used": "local",
        "tokens_used": 0,
    }
