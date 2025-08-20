import { defineStore } from 'pinia'

export const useAgentStore = defineStore('agent', {
  state: () => ({
    name: 'Avery Collins',
    brokerage: 'Shoreline Realty',
    location: 'Charleston, SC',
    avatarUrl: 'https://i.pravatar.cc/150?img=3',
    stats: {
      reviews: 128,
      avgRating: 4.9,
      transactionsYTD: 36,
      responseTimeHrs: 1.2
    },
    specialties: ['Waterfront', 'First-time buyers', 'Relocations'],
    recentReviews: [
      { id: 1, client: 'The Sandie Family', rating: 5, text: 'Zero-pressure, all clarity. Smoothest sale we’ve had.' , date: '2025-08-14'},
      { id: 2, client: 'J. Morales', rating: 5, text: 'Knew the market cold and negotiated like a pro.', date: '2025-08-11' },
      { id: 3, client: 'R. Patel', rating: 4, text: 'Great guidance and fast responses every step.', date: '2025-08-05' }
    ]
  })
})
