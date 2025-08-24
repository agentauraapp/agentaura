// frontend/src/composables/useSubmissions.ts
import { supabase } from '@/lib/supabase'

export async function trackClick(requestId: number, platform: 'google'|'facebook'|'zillow'|'realtor'|'internal') {
  const { error } = await supabase
    .from('review_submissions')
    .upsert(
      {
        review_request_id: Number(requestId),      // BIGINT in DB → ensure number
        platform,
        clicked_at: new Date().toISOString()
      },
      { onConflict: 'review_request_id,platform' }
    )
  if (error) throw error
}

export async function claimPosted(requestId: number, platform: 'google'|'facebook'|'zillow'|'realtor'|'internal', externalUrl?: string) {
  const { error } = await supabase
    .from('review_submissions')
    .upsert(
      {
        review_request_id: Number(requestId),
        platform,
        posted_claimed_at: new Date().toISOString(),
        external_url: externalUrl ?? null
      },
      { onConflict: 'review_request_id,platform' }
    )
  if (error) throw error
}

export async function markVerified(submissionId: string, externalUrl?: string) {
  const { error } = await supabase
    .from('review_submissions')
    .update({
      verification_status: 'verified',
      verification_method: 'manual',
      external_url: externalUrl ?? null
    })
    .eq('id', submissionId)
  if (error) throw error
}
