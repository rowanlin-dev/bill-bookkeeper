import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'

export const useUtilityStore = defineStore('utility', () => {
  const readings = ref([])
  const loading = ref(false)

  async function fetchReadings() {
    loading.value = true
    try {
      const data = await api.get('/utility')
      readings.value = data.data
    } finally {
      loading.value = false
    }
  }

  async function addReading(reading) {
    return api.post('/utility', reading)
  }

  return { readings, loading, fetchReadings, addReading }
})
