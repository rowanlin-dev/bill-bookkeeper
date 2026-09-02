import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'

export const useAccountStore = defineStore('accounts', () => {
  const accounts = ref([])
  const loading = ref(false)

  async function fetchAccounts() {
    loading.value = true
    try {
      const res = await api.get('/accounts')
      accounts.value = res.data
    } finally {
      loading.value = false
    }
  }

  async function addAccount(payload) {
    return api.post('/accounts', payload)
  }

  // 余额校准：以 reportDate 为锚点日期，把账户余额锚定为 balance
  async function calibrate(id, balance, reportDate) {
    return api.put(`/accounts/${id}`, { anchor_balance: balance, anchor_date: reportDate })
  }

  async function removeAccount(id) {
    return api.del(`/accounts/${id}`)
  }

  return { accounts, loading, fetchAccounts, addAccount, calibrate, removeAccount }
})
