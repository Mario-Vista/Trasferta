import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const { entraConGoogle } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      <div className="flex flex-col items-center text-center max-w-xs">
        <h1 className="font-display text-4xl tracking-tight mb-2">
          TRASFERTA<span className="text-accent">→</span>
        </h1>
        <p className="text-text-muted mb-10">Le trasferte della crew, in un posto solo.</p>
        <button className="btn-primary w-full" onClick={entraConGoogle}>
          <GoogleIcon />
          Entra con Google
        </button>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 7.1 29.6 5 24 5c-7.4 0-13.8 4.1-17.1 10.1l-.6-.4z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.5-5.5c-2 1.4-4.6 2.3-7.7 2.3-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.9 39.8 16.4 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.5l6.5 5.5C41.3 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  )
}
