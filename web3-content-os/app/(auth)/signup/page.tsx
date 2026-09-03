import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Suspense } from 'react'
import { AuthForm } from '@/components/app/auth-form'

export const metadata = { title: '注册' }

export default async function SignupPage() {
  if (await getSession()) redirect('/dashboard')
  return <Suspense><AuthForm mode="signup" /></Suspense>
}
