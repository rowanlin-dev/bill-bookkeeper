async def run(context, messages, image=None, get_provider=None):
    """
    UtilityTracker: 水电记录解析
    
    解析用户的水电读数输入，计算用量和费用。
    示例：
    - "电表初始1234.5，单价0.6"
    - "今天电表1250.3"
    """
    
    provider = get_provider("deepseek") if get_provider else None
    
    system_prompt = """你是一个水电表记录助手。请解析用户的读数输入，计算用量和费用。

输入格式识别：
- "电表初始1234.5，单价0.6" → 设置初始读数和单价
- "今天电表1250.3" → 新读数，计算用量
- "水表89.2，单价3.5" → 水表记录

输出JSON格式：
{
  "type": "electric|water",
  "action": "init|record",
  "date": "2026-07-15",
  "current_reading": 1250.3,
  "previous_reading": 1234.5,
  "usage": 15.8,
  "price_per_unit": 0.6,
  "cost": 9.48,
  "daily_avg": 1.06,
  "monthly_estimate": 19.08,
  "advice": "用量正常/偏高/偏低"
}"""
    
    user_content = messages[-1]["content"] if messages else ""
    
    full_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请解析：{user_content}"}
    ]
    
    if provider:
        response = await provider.chat(full_messages)
    else:
        response = offline_utility_parse(user_content)
    
    return {
        "response": response,
        "actions": [{"type": "utility_record", "data": response}],
        "model_used": "deepseek-chat" if provider else "local",
        "tokens_used": 0,
    }

def offline_utility_parse(text: str) -> str:
    """离线水电解析"""
    import re
    import json
    from datetime import datetime
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    # 识别类型
    is_electric = '电' in text or '电费' in text
    is_water = '水' in text or '水费' in text
    utype = 'electric' if is_electric else 'water' if is_water else 'unknown'
    
    # 提取数字
    numbers = re.findall(r'(\d+(?:\.\d+)?)', text)
    
    if len(numbers) >= 2:
        # 假设第一个是初始/上次，第二个是单价或本次
        reading = float(numbers[0])
        price = float(numbers[1]) if len(numbers) > 1 else 0.6
        
        return json.dumps({
            "type": utype,
            "action": "init",
            "date": today,
            "current_reading": reading,
            "price_per_unit": price,
            "note": "请提供下次读数以计算用量"
        }, ensure_ascii=False, indent=2)
    
    return json.dumps({
        "error": "无法解析，请提供读数和单价",
        "example": "电表1234.5，单价0.6"
    }, ensure_ascii=False)
