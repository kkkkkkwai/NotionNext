import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AuthForm } from '@/components/app/auth-form'

export const metadata = { title: 'Sign in' }

export default async function LoginPage() {
  if (await getSession()) redirect('/dashboard')
  return <AuthForm mode="login" />
}
