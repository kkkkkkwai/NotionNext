import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Suspense } from 'react'
import { AuthForm } from '@/components/app/auth-form'

export const metadata = { title: '登录' }

export default async function LoginPage() {
  if (await getSession()) redirect('/dashboard')
  return <Suspense><AuthForm mode="login" /></Suspense>
}
