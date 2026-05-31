'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface RegisteredTeam {
  id: string
  name: string
  category: string
  gender: string
}

export default function TimesPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<RegisteredTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [gender, setGender] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    setLoading(true)
    const res = await fetch('/api/teams')
    if (res.status === 401) { router.push('/login'); return }
    if (res.ok) setTeams(await res.json())
    setLoading(false)
  }

  async function addTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ name, category, gender }]),
    })
    setName('')
    setCategory('')
    setGender('')
    await loadTeams()
    setAdding(false)
  }

  async function deleteTeam(id: string) {
    setTeams(t => t.filter(x => x.id !== id))
    await fetch('/api/teams', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  const filtered = teams.filter(t =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-blue-200 hover:text-white text-sm">← Início</Link>
          <span className="text-blue-500">|</span>
          <span className="font-bold">Times Cadastrados</span>
        </div>
        <span className="text-xs text-blue-200">{teams.length} time{teams.length !== 1 ? 's' : ''}</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Add form */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Adicionar time</h2>
          <form onSubmit={addTeam} className="flex flex-wrap gap-2">
            <input
              className="flex-1 min-w-36 border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Nome do time *"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
            <input
              className="w-28 border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Categoria"
              value={category}
              onChange={e => setCategory(e.target.value.toUpperCase())}
            />
            <select
              className="w-24 border rounded-xl px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={gender}
              onChange={e => setGender(e.target.value)}
            >
              <option value="">Naipe</option>
              <option>FEM</option>
              <option>MAS</option>
              <option>MISTO</option>
            </select>
            <button
              type="submit"
              disabled={adding}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {adding ? '...' : '+ Adicionar'}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Todos os times</h2>
            <input
              className="border rounded-xl px-3 py-1.5 text-sm w-44 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-10">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              {teams.length === 0
                ? 'Nenhum time cadastrado. Adicione acima.'
                : 'Nenhum time encontrado para essa busca.'}
            </p>
          ) : (
            <div className="divide-y">
              {filtered.map(t => (
                <div key={t.id} className="flex items-center gap-2 py-2.5">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{t.name}</span>
                    {t.category && (
                      <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">{t.category}</span>
                    )}
                    {t.gender && (
                      <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">{t.gender}</span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTeam(t.id)}
                    className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center pb-4">
          Times cadastrados aparecem como sugestão automática ao criar tabelas.
        </p>
      </main>
    </div>
  )
}
