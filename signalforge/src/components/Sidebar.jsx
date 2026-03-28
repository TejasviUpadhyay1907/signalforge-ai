import { Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconLogo } from './Logo';

const navItems = [
  {
    path: '/dashboard', 
    label: 'Dashboard',
    description: 'Market signals & opportunities',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  {
    path: '/portfolio', 
    label: 'Portfolio',
    description: 'Track your holdings',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2v10l5.5-5.5" />
      </>
    ),
  },
  {
    path: '/assistant', 
    label: 'AI Assistant',
    description: 'Get trading insights',
    icon: (
      <>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </>
    ),
  },
];

function NavItemTooltip({ item, buttonRef, isHovered }) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isHovered && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 12, // 12px gap from sidebar
      });
    }
  }, [isHovered, buttonRef]);

  if (!isHovered) return null;

  return createPortal(
    <div 
      className="fixed pointer-events-none z-[9999] transition-opacity duration-200 animate-in fade-in slide-in-from-left-2"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateY(-50%)',
      }}
    >
      <div className="px-3 py-2 rounded-lg bg-[#0f0f13]/95 border border-white/[0.15] shadow-[0_8px_24px_rgba(0,0,0,0.9)] backdrop-blur-md whitespace-nowrap">
        <div className="text-xs font-semibold text-white tracking-wide">{item.label}</div>
        <div className="text-[10px] text-gray-400 mt-0.5">{item.description}</div>
        
        {/* Arrow pointing to sidebar */}
        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-[-1px]">
          <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-white/[0.15]" />
          <div className="absolute top-1/2 -translate-y-1/2 right-0 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[4px] border-r-[#0f0f13]/95" />
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const [hoveredItem, setHoveredItem] = useState(null);
  const buttonRefs = useRef({});

  return (
    <nav className="hidden lg:flex flex-col w-[68px] bg-gradient-to-b from-[rgba(12,12,14,0.8)] via-[rgba(10,10,12,0.85)] to-[rgba(8,8,10,0.9)] backdrop-blur-xl border-r border-white/[0.06] items-center py-6 gap-1 shrink-0 shadow-[4px_0_24px_-8px_rgba(0,0,0,0.3)]">
      {/* Logo */}
      <Link 
        to="/" 
        className="group mb-6 hover:opacity-90 transition-all duration-300 hover:scale-105 active:scale-95"
      >
        <div className="relative">
          <IconLogo size={34} />
          {/* Subtle glow on hover */}
          <div className="absolute inset-0 rounded-full bg-gold/0 group-hover:bg-gold/10 blur-xl transition-all duration-500" />
        </div>
      </Link>

      {/* Divider */}
      <div className="w-8 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-2" />

      {/* Nav items */}
      <div className="flex flex-col items-center gap-2 flex-1">
        {navItems.map(item => {
          const active = pathname === item.path || (item.path === '/dashboard' && pathname.startsWith('/stock'));
          const isHovered = hoveredItem === item.path;
          
          return (
            <div 
              key={item.path} 
              className="relative"
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {/* Premium active indicator bar */}
              <div className={`absolute -left-[17px] top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-300 ${
                active 
                  ? 'h-10 bg-gradient-to-b from-gold via-gold to-gold/70 shadow-[0_0_16px_rgba(212,175,55,0.7)]' 
                  : 'h-0 bg-transparent'
              }`} />

              <Link
                ref={el => buttonRefs.current[item.path] = el}
                to={item.path}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`sidebar-icon group relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  active
                    ? 'bg-gradient-to-br from-gold/[0.18] via-gold/[0.12] to-gold/[0.06] text-gold shadow-[0_0_24px_-4px_rgba(212,175,55,0.4),inset_0_1px_1px_rgba(255,255,255,0.1)] scale-105 border border-gold/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06] hover:scale-105 active:scale-95 border border-transparent hover:border-white/[0.08]'
                }`}
              >
                {/* Icon */}
                <svg
                  width="22" 
                  height="22" 
                  viewBox="0 0 24 24"
                  fill="none" 
                  stroke="currentColor"
                  strokeWidth={active ? '2.25' : '2'}
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className={`relative z-10 transition-all duration-300 ${
                    active ? 'drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]' : ''
                  } ${isHovered && !active ? 'scale-110' : ''}`}
                >
                  {item.icon}
                </svg>
                
                {/* Premium glow effect on active */}
                {active && (
                  <>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-gold/10 to-transparent animate-pulse" />
                    <div className="absolute inset-0 rounded-xl bg-gold/5 blur-md" />
                  </>
                )}

                {/* Hover shine effect */}
                {isHovered && !active && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                )}
              </Link>

              {/* Portal-based tooltip */}
              <NavItemTooltip 
                item={item}
                buttonRef={{ current: buttonRefs.current[item.path] }}
                isHovered={isHovered}
              />
            </div>
          );
        })}
      </div>

      {/* Bottom divider */}
      <div className="w-8 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mt-2" />
      
      {/* Optional: Status indicator */}
      <div className="mt-4 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-signal-green animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
      </div>
    </nav>
  );
}
