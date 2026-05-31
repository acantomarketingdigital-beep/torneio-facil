import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ASAAS_API_KEY = process.env.ASAAS_API_KEY ?? ''
const ASAAS_BASE = process.env.ASAAS_SANDBOX === 'true'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3'

export async function POST() {
  if (!ASAAS_API_KEY) {
    return NextResponse.json({ error: 'Pagamento não configurado ainda.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, asaas_customer_id, subscription_status')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_status === 'active') {
    return NextResponse.json({ error: 'Você já possui uma assinatura ativa.' }, { status: 400 })
  }

  const headers = {
    'Content-Type': 'application/json',
    access_token: ASAAS_API_KEY,
  }

  // Create or reuse Asaas customer
  let customerId = profile?.asaas_customer_id ?? ''

  if (!customerId) {
    const customerRes = await fetch(`${ASAAS_BASE}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: profile?.full_name || user.email,
        email: user.email,
        notificationDisabled: false,
      }),
    })
    const customer = await customerRes.json()
    if (!customer.id) {
      return NextResponse.json({ error: 'Erro ao criar cliente no Asaas.' }, { status: 500 })
    }
    customerId = customer.id
    await supabase.from('profiles').update({ asaas_customer_id: customerId }).eq('id', user.id)
  }

  // Create subscription (monthly R$29.90)
  const nextBilling = new Date()
  nextBilling.setDate(nextBilling.getDate() + 1)
  const nextBillingStr = nextBilling.toISOString().split('T')[0]

  const subRes = await fetch(`${ASAAS_BASE}/subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customer: customerId,
      billingType: 'UNDEFINED', // allows PIX, credit card, boleto
      value: 29.90,
      nextDueDate: nextBillingStr,
      cycle: 'MONTHLY',
      description: 'TabelaPro — Gerador de Tabelas Esportivas',
    }),
  })

  const sub = await subRes.json()
  if (!sub.id) {
    return NextResponse.json({ error: 'Erro ao criar assinatura no Asaas.' }, { status: 500 })
  }

  // Save subscription ID
  await supabase.from('profiles').update({ asaas_subscription_id: sub.id }).eq('id', user.id)

  // Get payment link for first charge
  const paymentsRes = await fetch(
    `${ASAAS_BASE}/subscriptions/${sub.id}/payments`,
    { headers }
  )
  const payments = await paymentsRes.json()
  const firstPayment = payments?.data?.[0]

  const paymentUrl: string = firstPayment?.invoiceUrl
    ?? (firstPayment?.id ? `https://www.asaas.com/c/${firstPayment.id}` : '')

  return NextResponse.json({ url: paymentUrl, subscriptionId: sub.id })
}
