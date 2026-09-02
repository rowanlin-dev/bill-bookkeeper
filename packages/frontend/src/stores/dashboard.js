import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'

export const useDashboardStore = defineStore('dashboard', () => {
  const data = ref(null)
  const loading = ref(false)
  const error = ref('')

  async function fetchDashboard() {
    loading.value = true
    error.value = ''
    try {
      const result = await api.get('/dashboard')
      data.value = result.data
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, fetchDashboard }
})
