import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AuthForm } from '@/components/app/auth-form'

export const metadata = { title: 'Sign up' }

export default async function SignupPage() {
  if (await getSession()) redirect('/dashboard')
  return <AuthForm mode="signup" />
}
