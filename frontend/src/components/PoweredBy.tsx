export const PORTFOLIO_URL = 'https://portfolio.jmdatalabs.co/'

export function PoweredBy({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] ${className}`}>
      Powered by{' '}
      <a
        href={PORTFOLIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-white underline-offset-2 hover:underline"
      >
        JM Data Labs
      </a>
    </p>
  )
}
