<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 顶部导航 -->
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex items-center justify-between h-14">
          <div class="flex items-center gap-2">
            <span class="text-xl">💰</span>
            <span class="font-bold text-gray-800">记账管家</span>
          </div>
          <div class="flex items-center gap-1">
            <router-link
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              :class="[
                'px-3 py-1.5 rounded-lg text-sm transition-colors',
                $route.path === item.path
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              ]"
            >
              {{ item.icon }} {{ item.name }}
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主内容 -->
    <main class="max-w-7xl mx-auto px-4 py-6">
      <router-view />
    </main>
  </div>
</template>

<script setup>
const navItems = [
  { path: '/dashboard', name: '看板', icon: '📊' },
  { path: '/ledger', name: '账本', icon: '📒' },
  { path: '/chat', name: 'AI记账', icon: '🤖' },
  { path: '/cashflow', name: '现金流', icon: '💹' },
  { path: '/utility', name: '水电', icon: '⚡' },
  { path: '/settings', name: '设置', icon: '⚙️' },
]
</script>
