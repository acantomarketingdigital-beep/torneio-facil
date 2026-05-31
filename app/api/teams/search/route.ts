import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? ''
  if (!q.trim()) return NextResponse.json([])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data } = await supabase
    .from('registered_teams')
    .select('id, name, category, gender')
    .eq('user_id', user.id)
    .ilike('name', `${q}%`)
    .order('name')
    .limit(8)

  return NextResponse.json(data ?? [])
}
