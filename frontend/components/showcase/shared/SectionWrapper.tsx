import { cn } from '@/lib/utils'

interface SectionWrapperProps {
  children: React.ReactNode
  className?: string
  background?: 'white' | 'muted' | 'dark' | 'transparent'
  size?: 'sm' | 'md' | 'lg'
}

const bgMap = {
  white: 'bg-white',
  muted: 'bg-gray-50',
  dark: 'bg-gray-900 text-white',
  transparent: '',
}

const sizeMap = {
  sm: 'py-12 md:py-16',
  md: 'py-16 md:py-24',
  lg: 'py-24 md:py-32',
}

export function SectionWrapper({
  children,
  className,
  background = 'white',
  size = 'md',
}: SectionWrapperProps) {
  return (
    <section className={cn(bgMap[background], sizeMap[size], className)}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {children}
      </div>
    </section>
  )
}
