'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Reading surface: sans headings for structure, serif for the prose itself.
 * Raw HTML is not enabled, so generated text can never inject markup.
 */
export default function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`font-serif text-[16px] leading-[1.75] text-ink ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1
              className="mt-10 mb-4 font-sans text-[22px] font-semibold tracking-tight text-ink first:mt-0"
              {...props}
            />
          ),
          h2: (props) => (
            <h2
              className="mt-9 mb-3 font-sans text-[17px] font-semibold tracking-tight text-ink first:mt-0"
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              className="mt-7 mb-2 font-sans text-[15px] font-semibold tracking-tight text-ink first:mt-0"
              {...props}
            />
          ),
          h4: (props) => <h4 className="mt-5 mb-2 font-sans text-[14px] font-semibold text-ink" {...props} />,
          p: (props) => <p className="mb-4" {...props} />,
          ul: (props) => <ul className="mb-4 ml-5 list-disc space-y-1.5 marker:text-rule-strong" {...props} />,
          ol: (props) => (
            <ol className="mb-4 ml-5 list-decimal space-y-1.5 marker:font-mono marker:text-[13px] marker:text-ink-3" {...props} />
          ),
          li: (props) => <li className="pl-1" {...props} />,
          strong: (props) => <strong className="font-semibold text-ink" {...props} />,
          blockquote: (props) => (
            <blockquote className="my-5 border-l-2 border-accent/40 pl-4 text-ink-2" {...props} />
          ),
          code: ({ className: codeClass, children, ...props }) => {
            const isBlock = (codeClass ?? '').includes('language-')
            return isBlock ? (
              <code className="block font-mono text-[13px] leading-relaxed" {...props}>
                {children}
              </code>
            ) : (
              <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px] text-ink" {...props}>
                {children}
              </code>
            )
          },
          pre: (props) => (
            <pre className="mb-5 overflow-x-auto rounded-md border border-rule bg-sunken p-4" {...props} />
          ),
          table: (props) => (
            <div className="mb-5 overflow-x-auto">
              <table className="w-full border-collapse font-sans text-[14px]" {...props} />
            </div>
          ),
          th: (props) => (
            <th className="border-b border-rule-strong px-3 py-2 text-left font-semibold text-ink" {...props} />
          ),
          td: (props) => <td className="border-b border-rule px-3 py-2 align-top text-ink-2" {...props} />,
          hr: () => <hr className="my-9 border-rule" />,
          a: (props) => (
            <a
              className="text-accent underline underline-offset-2 hover:text-accent-hover"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
