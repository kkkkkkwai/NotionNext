'use client'
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-text hover:bg-[#5cffbb] shadow-[0_0_0_1px_rgba(67,255,176,0.2),0_6px_20px_-6px_rgba(67,255,176,0.45)]',
        secondary: 'border border-line bg-white/[0.04] text-fg hover:border-line-strong hover:bg-white/[0.07]',
        ghost: 'text-fg-muted hover:bg-white/[0.05] hover:text-fg',
        outline: 'border border-line text-fg hover:border-line-strong hover:bg-white/[0.04]',
        danger: 'border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: { sm: 'h-8 px-3 text-[13px]', md: 'h-9.5 px-4 py-2', lg: 'h-11 px-5 text-[15px]', icon: 'h-8 w-8', xs: 'h-7 px-2.5 text-xs rounded-lg' }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { loading?: boolean }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading, children, disabled, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
    {children}
  </button>
))
Button.displayName = 'Button'
export { buttonVariants }
