import { useUser, UserButton } from '@clerk/clerk-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TopBar({ title, subtitle }) {
  const { user, isLoaded } = useUser();

  // Build dynamic greeting if no custom title provided
  const displayTitle = title || (
    isLoaded && user
      ? `${getGreeting()}, ${user.firstName || 'there'}`
      : `${getGreeting()}`
  );

  return (
    <header className="h-14 px-6 flex items-center justify-between border-b border-surfaceBorder bg-base shrink-0">
      <div>
        <h1 className="text-sm font-medium text-white">{displayTitle}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center bg-white/[0.04] border border-surfaceBorder rounded-lg px-3 py-1.5 gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search signals..." className="bg-transparent text-sm text-gray-200 outline-none w-40 placeholder-gray-600" />
        </div>
        <button className="text-gray-400 hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
        </button>
        {/* Clerk UserButton — shows real avatar, profile, sign out */}
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8 rounded-full border border-white/[0.1]',
              userButtonPopoverCard: 'bg-[#111] border border-white/[0.08] shadow-2xl',
              userButtonPopoverActionButton: 'text-gray-300 hover:bg-white/[0.06]',
              userButtonPopoverActionButtonText: 'text-gray-300',
              userButtonPopoverFooter: 'hidden',
            },
          }}
        />
      </div>
    </header>
  );
}
