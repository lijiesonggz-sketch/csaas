import { HERO_CONTENT } from '@/components/showcase/shared/content'
import { ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="bg-white border-b border-gray-200">
      <div className="max-w-[1200px] mx-auto px-8 py-24 md:py-32">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 mb-6">
            {HERO_CONTENT.badge}
          </p>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-black leading-[1.1] mb-6">
            {HERO_CONTENT.title}
          </h1>
          <p className="text-lg leading-relaxed text-gray-500 mb-10 max-w-lg">
            {HERO_CONTENT.subtitle}
          </p>
          <div className="flex items-center gap-4">
            <button className="bg-black text-white px-8 py-3 text-sm font-medium tracking-wide hover:bg-gray-800 transition-colors duration-150 flex items-center gap-2">
              {HERO_CONTENT.ctaPrimary}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="bg-white text-black border border-gray-300 px-8 py-3 text-sm font-medium hover:bg-gray-50 transition-colors duration-150">
              {HERO_CONTENT.ctaSecondary}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
