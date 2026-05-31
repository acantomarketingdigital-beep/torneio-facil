import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Verify Asaas webhook token
  const token = request.headers.get('asaas-access-token') ?? ''
  if (process.env.ASAAS_WEBHOOK_TOKEN && token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { event, payment } = body

  if (!payment?.subscription) {
    return NextResponse.json({ ok: true })
  }

  const supabase = await createClient()

  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
    // Activate subscription for the user with this subscription ID
    await supabase
      .from('profiles')
      .update({ subscription_status: 'active' })
      .eq('asaas_subscription_id', payment.subscription)
  }

  if (event === 'PAYMENT_OVERDUE' || event === 'SUBSCRIPTION_INACTIVATED') {
    await supabase
      .from('profiles')
      .update({ subscription_status: 'expired' })
      .eq('asaas_subscription_id', payment.subscription)
  }

  return NextResponse.json({ ok: true })
}
