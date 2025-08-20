<script setup>
import { computed } from 'vue'
import { useAgentStore } from '../stores/agent'

// PrimeVue components
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Avatar from 'primevue/avatar'
import Rating from 'primevue/rating'
import ProgressBar from 'primevue/progressbar'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const agent = useAgentStore()

const ratingPercent = computed(() => (agent.stats.avgRating / 5) * 100)
</script>

<template>
  <div class="p-4 md:p-5 lg:p-6">
    <!-- Header / hero -->
    <div class="grid grid-nogutter surface-card p-4 md:p-5 border-round-2xl shadow-2">
      <div class="col-12 md:col-8 flex align-items-center">
        <Avatar :image="agent.avatarUrl" class="mr-3" size="large" shape="circle" />
        <div>
          <div class="text-2xl font-bold text-900">{{ agent.name }}</div>
          <div class="text-600">{{ agent.brokerage }} • {{ agent.location }}</div>
          <div class="mt-2 flex align-items-center gap-2">
            <Rating :modelValue="agent.stats.avgRating" readonly :cancel="false" />
            <span class="text-700 font-medium">{{ agent.stats.avgRating.toFixed(1) }}/5</span>
            <Tag severity="success" :value="agent.stats.reviews + ' reviews'" rounded />
          </div>
        </div>
      </div>
      <div class="col-12 md:col-4 flex justify-content-end align-items-center gap-2 mt-3 md:mt-0">
        <Button label="Request Review" icon="pi pi-star" class="p-button-rounded p-button-success" />
        <Button label="Share Profile" icon="pi pi-share-alt" class="p-button-rounded p-button-secondary" />
      </div>
    </div>

    <!-- KPI cards -->
    <div class="grid mt-4">
      <div class="col-12 md:col-3">
        <Card class="h-full shadow-1 border-round-2xl">
          <template #title>Transactions (YTD)</template>
          <template #content>
            <div class="text-4xl font-bold text-900">{{ agent.stats.transactionsYTD }}</div>
            <div class="text-600 mt-2">Goal: 48</div>
            <ProgressBar :value="(agent.stats.transactionsYTD/48)*100" class="mt-3" />
          </template>
        </Card>
      </div>
      <div class="col-12 md:col-3">
        <Card class="h-full shadow-1 border-round-2xl">
          <template #title>Avg Rating</template>
          <template #content>
            <div class="flex align-items-center gap-2">
              <Rating :modelValue="agent.stats.avgRating" readonly :cancel="false" />
              <span class="text-2xl font-bold text-900">{{ agent.stats.avgRating.toFixed(1) }}</span>
            </div>
            <ProgressBar :value="ratingPercent" class="mt-3" />
          </template>
        </Card>
      </div>
      <div class="col-12 md:col-3">
        <Card class="h-full shadow-1 border-round-2xl">
          <template #title>Response Time</template>
          <template #content>
            <div class="text-4xl font-bold text-900">{{ agent.stats.responseTimeHrs }}</div>
            <div class="text-600">hrs avg</div>
          </template>
        </Card>
      </div>
      <div class="col-12 md:col-3">
        <Card class="h-full shadow-1 border-round-2xl">
          <template #title>Specialties</template>
          <template #content>
            <div class="flex flex-wrap gap-2">
              <Tag v-for="s in agent.specialties" :key="s" :value="s" rounded />
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- Recent reviews -->
    <div class="grid mt-3">
      <div class="col-12 lg:col-8">
        <Card class="shadow-1 border-round-2xl">
          <template #title>Recent Reviews</template>
          <template #content>
            <DataTable :value="agent.recentReviews" class="p-datatable-sm">
              <Column field="client" header="Client">
                <template #body="{ data }">
                  <div class="flex align-items-center gap-2">
                    <Avatar icon="pi pi-user" shape="circle" />
                    <span class="font-medium text-900">{{ data.client }}</span>
                  </div>
                </template>
              </Column>
              <Column header="Rating" style="width: 10rem">
                <template #body="{ data }">
                  <Rating :modelValue="data.rating" readonly :cancel="false" />
                </template>
              </Column>
              <Column field="text" header="Comment" />
              <Column field="date" header="Date" style="width: 10rem" />
            </DataTable>
          </template>
        </Card>
      </div>
      <div class="col-12 lg:col-4">
        <Card class="shadow-1 border-round-2xl">
          <template #title>Quick Actions</template>
          <template #content>
            <div class="flex flex-column gap-2">
              <Button icon="pi pi-star" label="Send Review Link" class="p-button-success p-button-rounded" />
              <Button icon="pi pi-whatsapp" label="Text Review Request" class="p-button-rounded" />
              <Button icon="pi pi-google" label="Open Google Profile" class="p-button-rounded p-button-secondary" />
              <Button icon="pi pi-cog" label="Profile Settings" class="p-button-rounded p-button-help" />
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.surface-card { background: #ffffff; }
</style>
