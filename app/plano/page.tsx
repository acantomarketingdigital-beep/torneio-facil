'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  subscription_status: string
  trial_ends_at: string | null
}

export default function PlanoPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('YEARLY')
  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string } } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUser(data.user)
      const { data: p } = await supabase
        .from('profiles')
        .select('subscription_status, trial_ends_at')
        .eq('id', data.user.id)
        .single()
      setProfile(p)
    })
  }, [])

  const daysLeft = profile?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(profile.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null

  async function handleCheckout() {
    const doc = cpfCnpj.replace(/\D/g, '')
    if (doc.length !== 11 && doc.length !== 14) {
      setError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/asaas/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpfCnpj: doc, cycle }),
      })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        setError(data.error ?? 'Erro ao gerar link de pagamento.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const isActive = profile?.subscription_status === 'active'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 px-4 py-12">
      <div className="max-w-md mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-700">
            <img src="/images/logoprincipal.png" alt="TabelaPro" className="mx-auto w-full max-w-65 h-auto object-contain" />
          </Link>
        </div>

        {/* Trial status */}
        {profile && !isActive && daysLeft !== null && (
          <div className={`mb-4 text-center text-sm font-medium px-4 py-2 rounded-xl ${
            daysLeft > 0
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {daysLeft > 0
              ? `⏳ Seu período de teste termina em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`
              : '❌ Seu período de teste expirou'}
          </div>
        )}

        {/* Plan card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-700 text-white px-6 py-6 text-center">
            <p className="text-sm text-blue-200 uppercase tracking-wide font-medium">Plano TabelaPro</p>

            {/* Toggle mensal / anual */}
            <div className="mt-4 inline-flex rounded-xl overflow-hidden border border-blue-500">
              <button
                onClick={() => setCycle('MONTHLY')}
                className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                  cycle === 'MONTHLY' ? 'bg-white text-blue-700' : 'text-blue-200 hover:text-white'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setCycle('YEARLY')}
                className={`px-4 py-1.5 text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  cycle === 'YEARLY' ? 'bg-white text-blue-700' : 'text-blue-200 hover:text-white'
                }`}
              >
                Anual
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  cycle === 'YEARLY' ? 'bg-green-500 text-white' : 'bg-green-400 text-white'
                }`}>-30%</span>
              </button>
            </div>

            {cycle === 'YEARLY' ? (
              <>
                <div className="mt-3 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-black">R$ 249</span>
                  <span className="text-blue-200 text-sm">/ano</span>
                </div>
                <p className="text-green-300 text-xs mt-1 font-medium">≈ R$ 20,75/mês · Economize R$ 109,80</p>
              </>
            ) : (
              <>
                <div className="mt-3 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-black">R$ 29</span>
                  <span className="text-2xl font-bold">,90</span>
                  <span className="text-blue-200 text-sm">/mês</span>
                </div>
                <p className="text-blue-200 text-xs mt-1">Cancele quando quiser</p>
              </>
            )}
          </div>

          {/* Features */}
          <div className="px-6 py-5 space-y-3">
            {[
              'Geração ilimitada de tabelas',
              'Múltiplas datas por torneio',
              'Banco de times com autocomplete',
              'Regulamento impresso na tabela',
              'Mínimo de jogos configurável',
              'Download em PDF',
              'Suporte via email',
            ].map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                <span className="text-green-500 font-bold text-base">✓</span>
                {f}
              </div>
            ))}
          </div>

          <div className="px-6 pb-6">
            {isActive ? (
              <div className="text-center py-3 bg-green-50 text-green-700 rounded-xl font-semibold text-sm">
                ✓ Assinatura ativa
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    CPF ou CNPJ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    value={cpfCnpj}
                    onChange={e => setCpfCnpj(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Necessário para emissão da cobrança.</p>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 text-base"
                >
                  {loading ? 'Aguarde...' : cycle === 'YEARLY' ? 'Assinar agora — R$ 249/ano' : 'Assinar agora — R$ 29,90/mês'}
                </button>
                {error && (
                  <p className="text-red-600 text-sm text-center mt-2">{error}</p>
                )}
                <p className="text-xs text-gray-400 text-center mt-3">
                  Pagamento seguro via Asaas · Cartão, PIX ou boleto
                </p>
              </>
            )}
          </div>
        </div>

        {/* Support */}
        <div className="mt-6 bg-white rounded-2xl shadow p-5 text-center">
          <p className="text-sm font-semibold text-gray-900 mb-1">Falar com suporte</p>
          <p className="text-xs text-gray-500 mb-3">Dúvidas sobre planos, pagamentos ou uso do sistema</p>
          <a
            href="mailto:suporte.tabelapro@gmail.com?subject=Suporte TabelaPro"
            className="inline-flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            📧 suporte.tabelapro@gmail.com
          </a>
        </div>

        <div className="text-center mt-4">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Voltar ao início</Link>
        </div>
      </div>
    </div>
  )
}
