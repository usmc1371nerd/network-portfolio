import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

type MarkdownRendererProps = {
  markdown: string
}

export function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  const html = useMemo(() => {
    const raw = marked.parse(markdown, { async: false })
    return DOMPurify.sanitize(raw)
  }, [markdown])

  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
}
