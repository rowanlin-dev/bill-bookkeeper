import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import Dashboard from './views/Dashboard.vue'
import Ledger from './views/Ledger.vue'
import ChatInput from './views/ChatInput.vue'
import CashFlow from './views/CashFlow.vue'
import UtilityTracker from './views/UtilityTracker.vue'
import Settings from './views/Settings.vue'

const isOffline = import.meta.env.VITE_OFFLINE === 'true'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: Dashboard, name: 'Dashboard' },
  { path: '/ledger', component: Ledger, name: 'Ledger' },
  { path: '/chat', component: ChatInput, name: 'Chat' },
  { path: '/cashflow', component: CashFlow, name: 'CashFlow' },
  { path: '/utility', component: UtilityTracker, name: 'Utility' },
  { path: '/settings', component: Settings, name: 'Settings' },
]

// 离线模式（file:// 双击打开）使用 hash 路由，避免 history 模式在 file:// 下 404
export default createRouter({
  history: isOffline ? createWebHashHistory() : createWebHistory(),
  routes,
})
