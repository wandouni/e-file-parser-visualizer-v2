import { getUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
