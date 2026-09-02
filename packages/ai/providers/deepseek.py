import os
import json
from typing import Dict, Any, List
import httpx

class DeepseekProvider:
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.api_key = self.config.get('apiKey') or os.getenv('DEEPSEEK_API_KEY', '')
        self.base_url = self.config.get('baseUrl', 'https://api.deepseek.com/v1')
        self.model = self.config.get('model', 'deepseek-chat')
    
    async def chat(self, messages: List[Dict[str, str]]) -> str:
        """普通文本对话"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": 0.7,
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    async def chat_with_vision(self, messages: List[Dict[str, str]], image_data: str) -> str:
        """带图片的对话（如果模型支持）"""
        # Deepseek目前不支持vision，回退到文本描述
        # 实际使用时可以接入支持vision的模型
        messages_with_image = messages.copy()
        messages_with_image.append({
            "role": "user",
            "content": f"[图片数据: {image_data[:100]}...] 请分析这张图片中的财务信息。"
        })
        return await self.chat(messages_with_image)
