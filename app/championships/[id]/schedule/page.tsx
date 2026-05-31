'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { AvailableSlot, Venue, Championship, ChampionshipBreak } from '@/types'
import { formatDate, formatTime } from '@/lib/utils'

export default function SchedulePage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [breaks, setBreaks] = useState<ChampionshipBreak[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [championship, setChampionship] = useState<Championship | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSlotForm, setShowSlotForm] = useState(false)
  const [showBreakForm, setShowBreakForm] = useState(false)

  const [slotForm, setSlotForm] = useState({ slot_date: '', start_time: '08:00', end_time: '22:00', venue_id: '' })
  const [breakForm, setBreakForm] = useState({ name: 'Almoço', start_time: '13:00', end_time: '14:00', applies_to_all_dates: true, slot_date: '' })

  const load = useCallback(async () => {
    const [{ data: c }, { data: v }, { data: s }, { data: b }] = await Promise.all([
      supabase.from('championships').select('*').eq('id', id).single(),
      supabase.from('venues').select('*').eq('championship_id', id).eq('is_active', true).order('name'),
      supabase.from('available_slots').select('*, venue:venues(*)').eq('championship_id', id).order('slot_date').order('start_time'),
      supabase.from('championship_breaks').select('*').eq('championship_id', id).order('start_time'),
    ])
    setChampionship(c)
    setVenues(v ?? [])
    setSlots(s ?? [])
    setBreaks(b ?? [])
    if (c) {
      setSlotForm(f => ({ ...f, start_time: c.default_start_time ?? '08:00', end_time: c.default_end_time ?? '22:00' }))
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleAddSlot() {
    if (!slotForm.slot_date) return
    setSaving(true)
    await supabase.from('available_slots').insert({
      championship_id: id,
      slot_date: slotForm.slot_date,
      start_time: slotForm.start_time,
      end_time: slotForm.end_time,
      venue_id: slotForm.venue_id || null,
    })
    setShowSlotForm(false)
    setSlotForm(f => ({ ...f, slot_date: '' }))
    await load()
    setSaving(false)
  }

  async function handleDeleteSlot(slotId: string) {
    await supabase.from('available_slots').delete().eq('id', slotId)
    await load()
  }

  async function handleAddBreak() {
    if (!breakForm.start_time || !breakForm.end_time) return
    setSaving(true)
    await supabase.from('championship_breaks').insert({
      championship_id: id,
      name: breakForm.name.trim() || 'Pausa',
      start_time: breakForm.start_time,
      end_time: breakForm.end_time,
      applies_to_all_dates: breakForm.applies_to_all_dates,
      slot_date: breakForm.applies_to_all_dates ? null : breakForm.slot_date || null,
    })
    setShowBreakForm(false)
    setBreakForm({ name: 'Almoço', start_time: '13:00', end_time: '14:00', applies_to_all_dates: true, slot_date: '' })
    await load()
    setSaving(false)
  }

  async function handleDeleteBreak(breakId: string) {
    await supabase.from('championship_breaks').delete().eq('id', breakId)
    await load()
  }

  async function handleUpdateSafetyMargin(value: number) {
    await supabase.from('championships').update({ safety_margin_minutes: value }).eq('id', id)
    await load()
  }

  const grouped = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    if (!acc[slot.slot_date]) acc[slot.slot_date] = []
    acc[slot.slot_date].push(slot)
    return acc
  }, {})

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href={`/championships/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← {championship?.name}</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium">Agenda da Rodada</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Dates section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Datas da Rodada</h2>
              <p className="text-xs text-gray-400">Defina os dias e horários em que os jogos podem ocorrer</p>
            </div>
            <button onClick={() => setShowSlotForm(true)} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700">
              + Adicionar data
            </button>
          </div>

          {championship && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
              <p className="text-xs text-blue-700">
                <span className="font-semibold">Padrão:</span> {championship.default_start_time} às {championship.default_end_time} ·
                {' '}{championship.courts_count} quadra(s) · {championship.game_duration} min/jogo
              </p>
            </div>
          )}

          {showSlotForm && (
            <div className="bg-white rounded-2xl border border-blue-200 p-5 mb-3 space-y-3">
              <h3 className="font-medium text-gray-900">Nova data</h3>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
                <input type="date" value={slotForm.slot_date} onChange={e => setSlotForm(f => ({ ...f, slot_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Início</label>
                  <input type="time" value={slotForm.start_time} onChange={e => setSlotForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fim *</label>
                  <input type="time" value={slotForm.end_time} onChange={e => setSlotForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Quadra específica (opcional)</label>
                <select value={slotForm.venue_id} onChange={e => setSlotForm(f => ({ ...f, venue_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Todas as quadras</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowSlotForm(false)} className="flex-1 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button onClick={handleAddSlot} disabled={saving || !slotForm.slot_date}
                  className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          )}

          {Object.keys(grouped).length === 0 && !showSlotForm ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
              <p className="text-sm">Nenhuma data cadastrada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(grouped).map(([date, daySlots]) => (
                <div key={date} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="font-medium text-sm text-gray-900">{formatDate(date, 'EEEE, dd/MM/yyyy')}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {daySlots.map(slot => (
                      <div key={slot.id} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-blue-600">{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</span>
                          {slot.venue ? (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{slot.venue.name}</span>
                          ) : (
                            <span className="text-xs text-gray-400">Todas as quadras</span>
                          )}
                        </div>
                        <button onClick={() => handleDeleteSlot(slot.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 text-xs">🗑️</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Breaks section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Pausas da Rodada</h2>
              <p className="text-xs text-gray-400">Almoço, intervalo de árbitros e outros bloqueios obrigatórios</p>
            </div>
            <button onClick={() => setShowBreakForm(true)} className="px-3 py-2 bg-orange-500 text-white text-sm rounded-xl font-medium hover:bg-orange-600">
              + Adicionar pausa
            </button>
          </div>

          {/* Safety margin config */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Margem de segurança antes das pausas (min)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number" min={0} max={60}
                defaultValue={championship?.safety_margin_minutes ?? 0}
                onBlur={e => handleUpdateSafetyMargin(Number(e.target.value))}
                className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400">
                Tempo extra considerado antes de uma pausa. Ex: 20 min = o sistema garante que o jogo + 20 min terminam antes da pausa.
              </p>
            </div>
          </div>

          {showBreakForm && (
            <div className="bg-white rounded-2xl border border-orange-200 p-5 mb-3 space-y-3">
              <h3 className="font-medium text-gray-900">Nova pausa</h3>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome da pausa</label>
                <input value={breakForm.name} onChange={e => setBreakForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Almoço, Intervalo árbitros"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Início da pausa</label>
                  <input type="time" value={breakForm.start_time} onChange={e => setBreakForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fim da pausa</label>
                  <input type="time" value={breakForm.end_time} onChange={e => setBreakForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="all_dates" checked={breakForm.applies_to_all_dates}
                  onChange={e => setBreakForm(f => ({ ...f, applies_to_all_dates: e.target.checked }))}
                  className="w-4 h-4 text-orange-500 rounded" />
                <label htmlFor="all_dates" className="text-sm text-gray-700">Aplicar em todas as datas da rodada</label>
              </div>
              {!breakForm.applies_to_all_dates && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data específica</label>
                  <input type="date" value={breakForm.slot_date} onChange={e => setBreakForm(f => ({ ...f, slot_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowBreakForm(false)} className="flex-1 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button onClick={handleAddBreak} disabled={saving}
                  className="flex-1 py-2 text-sm bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Adicionar pausa'}
                </button>
              </div>
            </div>
          )}

          {breaks.length === 0 && !showBreakForm ? (
            <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
              <p className="text-sm">Nenhuma pausa configurada.</p>
              <p className="text-xs mt-1">Recomendado: adicionar pausa de almoço das 13:00 às 14:00.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {breaks.map(brk => (
                <div key={brk.id} className="bg-white rounded-xl border border-orange-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-orange-500 text-sm">⏸️</span>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{brk.name}</div>
                      <div className="text-xs text-gray-500">
                        {formatTime(brk.start_time)} às {formatTime(brk.end_time)} ·{' '}
                        {brk.applies_to_all_dates ? 'Todas as datas' : `Apenas ${brk.slot_date ? formatDate(brk.slot_date) : '—'}`}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteBreak(brk.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 text-xs">🗑️</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex gap-3 pb-8">
          <Link href={`/championships/${id}`} className="flex-1 py-3 text-center text-sm border border-gray-300 rounded-xl hover:bg-gray-50">← Voltar</Link>
          <Link href={`/championships/${id}/matches`} className="flex-1 py-3 text-center text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">Gerar Tabela →</Link>
        </div>
      </main>
    </div>
  )
}
