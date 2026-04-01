import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		colors: {
  			primary: {
  				'50': '#eef4f9',
  				'100': '#d4e5f2',
  				'200': '#a9cbe5',
  				'300': '#7eb0d8',
  				'400': '#5396cb',
  				'500': '#2d6d9e',
  				'600': '#1E3A5F',
  				'700': '#18324f',
  				'800': '#12293f',
  				'900': '#0c1a29',
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				'50': '#f1f5f9',
  				'100': '#e2e8f0',
  				'200': '#cbd5e1',
  				'300': '#94A3B8',
  				'400': '#7d8fa3',
  				'500': '#64748b',
  				'600': '#4b5e73',
  				'700': '#334863',
  				'800': '#1e3a5f',
  				'900': '#0f172a',
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			accent: {
  				'50': '#ecfdf5',
  				'100': '#d1fae5',
  				'200': '#a7f3d0',
  				'300': '#6ee7b7',
  				'400': '#34d399',
  				'500': '#059669',
  				'600': '#047857',
  				'700': '#065f46',
  				'800': '#064e3b',
  				'900': '#022c22',
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			background: 'hsl(var(--background))',
  			text: {
  				primary: '#1E3A5F',
  				secondary: '#64748b',
  				disabled: '#94a3b8'
  			},
  			status: {
  				success: '#059669',
  				'success-light': '#d1fae5',
  				warning: '#f59e0b',
  				'warning-light': '#fef3c7',
  				error: '#ef4444',
  				'error-light': '#fee2e2',
  				info: '#1E3A5F',
  				'info-light': '#eef4f9',
  				pending: '#6b7280',
  				'pending-light': '#f3f4f6'
  			},
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			card: '4px',
  			button: '4px',
  			pill: '9999px',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			card: '0 1px 2px rgba(0, 0, 0, 0.05)',
  			'card-hover': '0 2px 8px rgba(0, 0, 0, 0.08)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
