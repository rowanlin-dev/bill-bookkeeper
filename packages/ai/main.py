from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from skills.registry import execute_skill
from providers.deepseek import DeepseekProvider

app = FastAPI(title="Bill Bookkeeper AI Service", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 配置
MASTER_KEY = os.getenv("AI_MASTER_KEY", "bill-local-key")
# 数据目录按项目结构推导（packages/ai → 项目根/data），可用 BILL_DATA_DIR 覆盖
DATA_DIR = os.getenv(
    "BILL_DATA_DIR",
    os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")),
)

# 模型提供商实例缓存
_providers = {}

def get_provider(name: str, provider_config: Dict[str, Any] = None):
    """获取或创建模型提供商实例"""
    api_key = None
    if provider_config and provider_config.get('apiKey'):
        api_key = provider_config['apiKey']
    elif name == 'deepseek':
        api_key = os.getenv('DEEPSEEK_API_KEY', '')
    
    if not api_key:
        return None
    
    cache_key = name
    if provider_config and provider_config.get('apiKey'):
        cache_key = f"{name}_{provider_config['apiKey'][:8]}"
    
    if cache_key not in _providers:
        if name == 'deepseek':
            _providers[cache_key] = DeepseekProvider(config=provider_config)
    
    return _providers.get(cache_key)

# ========== 数据模型 ==========

class ProviderConfig(BaseModel):
    provider: str = "deepseek"
    apiKey: str = ""
    baseUrl: str = "https://api.deepseek.com/v1"
    model: str = "deepseek-chat"

class Message(BaseModel):
    role: str
    content: str

class AgentRequest(BaseModel):
    project: str = "bill"
    skill: str = "Chat"
    context: Dict[str, Any] = {}
    messages: List[Message]
    image: Optional[str] = None
    provider_config: Optional[ProviderConfig] = None

class AgentResponse(BaseModel):
    project: str
    skill: str
    response: str
    actions: List[Dict[str, Any]] = []
    model_used: str
    tokens_used: int = 0

class AnalyzeRequest(BaseModel):
    project: str = "bill"
    image: Optional[str] = None
    text: Optional[str] = None
    provider_config: Optional[ProviderConfig] = None

# ========== 中间件 ==========

def verify_key(x_api_key: str = Header(...)):
    if x_api_key != MASTER_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return x_api_key

# ========== API 路由 ==========

@app.get("/health")
async def health():
    return {"status": "ok", "service": "bill-ai", "version": "0.1.0"}

@app.post("/agent", response_model=AgentResponse)
async def agent(req: AgentRequest, x_api_key: str = Header(...)):
    verify_key(x_api_key)
    
    try:
        pc = req.provider_config.model_dump() if req.provider_config else None
        result = await execute_skill(
            project=req.project,
            skill_name=req.skill,
            context=req.context,
            messages=[m.model_dump() for m in req.messages],
            image=req.image,
            get_provider=lambda name: get_provider(name, pc),
        )
        return AgentResponse(**result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e) or "Unknown error")

@app.post("/analyze")
async def analyze(req: AnalyzeRequest, x_api_key: str = Header(...)):
    verify_key(x_api_key)
    
    pc = req.provider_config.model_dump() if req.provider_config else None
    provider = get_provider("deepseek", pc)
    if not provider:
        raise HTTPException(status_code=500, detail="No AI provider available")
    
    try:
        prompt = f"请分析以下内容。项目: {req.project}\n"
        if req.text:
            prompt += f"\n文本: {req.text}"
        
        messages = [
            {"role": "system", "content": "你是一个财务分析助手。请从用户提供的图片或文本中提取收支信息、金额、日期等，用结构化格式输出。"},
            {"role": "user", "content": prompt}
        ]
        
        if req.image:
            response = await provider.chat_with_vision(messages, image_data=req.image)
        else:
            response = await provider.chat(messages)
        
        return {
            "project": req.project,
            "analysis": response,
            "model_used": provider.model,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
