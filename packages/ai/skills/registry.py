import importlib
from typing import Dict, Any, List, Callable

# Skill 注册表
SKILL_REGISTRY = {
    "bill": {
        "Bookkeeper": "skills.bill.bookkeeper",
        "NLPParser": "skills.bill.nlp_parser",
        "ExcelStyler": "skills.bill.excel_styler",
        "DashboardGen": "skills.bill.dashboard_gen",
        "Advisor": "skills.bill.advisor",
        "Forecast": "skills.bill.forecast",
        "VisionParser": "skills.bill.vision_parser",
        "Simulator": "skills.bill.simulator",
        "DebtOptimizer": "skills.bill.debt_optimizer",
        "UtilityTracker": "skills.bill.utility_tracker",
    },
    "common": {
        "Chat": "skills.common.chat",
        "Summarize": "skills.common.summarize",
    }
}

async def execute_skill(
    project: str,
    skill_name: str,
    context: Dict[str, Any],
    messages: List[Dict[str, str]],
    image: str = None,
    get_provider: Callable = None,
):
    """执行指定 Skill"""
    
    module_path = None
    if skill_name in SKILL_REGISTRY.get(project, {}):
        module_path = SKILL_REGISTRY[project][skill_name]
    elif skill_name in SKILL_REGISTRY.get("common", {}):
        module_path = SKILL_REGISTRY["common"][skill_name]
    else:
        available = list(SKILL_REGISTRY.get(project, {}).keys()) + list(SKILL_REGISTRY["common"].keys())
        raise ValueError(f"Unknown skill: '{skill_name}' for project '{project}'. Available: {available}")
    
    try:
        module = importlib.import_module(module_path)
    except ImportError as e:
        raise Exception(f"Skill module not found: {module_path}. Error: {e}")
    
    if not hasattr(module, 'run'):
        raise Exception(f"Skill {skill_name} does not have a run() function")
    
    result = await module.run(
        context=context,
        messages=messages,
        image=image,
        get_provider=get_provider,
    )
    
    return {
        "project": project,
        "skill": skill_name,
        "response": result.get("response", ""),
        "actions": result.get("actions", []),
        "model_used": result.get("model_used", "unknown"),
        "tokens_used": result.get("tokens_used", 0),
    }

def register_skill(project: str, skill_name: str, module_path: str):
    """动态注册新 Skill"""
    if project not in SKILL_REGISTRY:
        SKILL_REGISTRY[project] = {}
    SKILL_REGISTRY[project][skill_name] = module_path
