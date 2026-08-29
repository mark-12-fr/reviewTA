'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  {
    href: '/',
    label: 'Study sets',
    icon: 'M4 5.5A1.5 1.5 0 015.5 4h9A1.5 1.5 0 0116 5.5v13l-5.5-2.5L5 18.5v-13z',
  },
  {
    href: '/folders',
    label: 'Folders',
    icon: 'M3 6.5A1.5 1.5 0 014.5 5h4l1.6 2h9.4A1.5 1.5 0 0121 8.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-11z',
  },
  {
    href: '/solve',
    label: 'Solve',
    icon: 'M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5v-13zM8 9h8M8 13h5M8 16.5h3',
  },
]

function isActiveHref(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-rule bg-surface lg:flex">
        <Link href="/" className="block px-5 py-6 text-[17px] font-semibold tracking-tight">
          Review<span className="text-accent">Ta</span>
        </Link>

        <nav className="px-2">
          {navItems.map((item) => {
            const active = isActiveHref(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] transition-colors ${
                  active ? 'bg-sunken font-medium text-ink' : 'text-ink-2 hover:bg-sunken/60 hover:text-ink'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />
                )}
                <svg
                  className={`h-4 w-4 ${active ? 'text-accent' : 'text-ink-3'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <p className="mt-auto border-t border-rule px-5 py-4 text-[12px] leading-relaxed text-ink-3">
          No account. Your material and progress stay on this computer.
        </p>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-rule bg-surface lg:hidden">
        {navItems.map((item) => {
          const active = isActiveHref(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                active ? 'text-accent' : 'text-ink-3'
              }`}
            >
              <svg
                className="h-[18px] w-[18px]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
