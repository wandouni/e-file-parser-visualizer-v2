import { createClient } from '@/lib/supabase/server'
import { ok, err } from '@/lib/utils'

async function getMyRole(supabase: any, caseId: string, userId: string) {
  const { data } = await supabase
    .from('case_members')
    .select('role')
    .eq('case_id', caseId)
    .eq('user_id', userId)
    .single()
  return data?.role as string | null
}

// GET /api/cases/:caseId/members
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('未登录', 401)

  const role = await getMyRole(supabase, caseId, user.id)
  if (!role) return err('无权访问', 403)

  const { data, error } = await supabase
    .from('case_members')
    .select(`
      id, case_id, user_id, role, joined_at,
      profile:profiles (username, display_name, avatar_url)
    `)
    .eq('case_id', caseId)
    .order('joined_at', { ascending: true })

  if (error) return err(error.message, 500)
  return ok(data)
}
