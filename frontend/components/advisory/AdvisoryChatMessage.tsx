import { Button } from '@/components/ui/button'
import {
  type ThinkTankConversationMessage,
  type ThinkTankDecisionOption,
} from '@/lib/advisory/workflows'
import { cn } from '@/lib/utils'

interface AdvisoryChatMessageProps {
  message: ThinkTankConversationMessage
  isStreaming?: boolean
  decisionOptionsAreCurrent?: boolean
  onDecisionOption?: (option: ThinkTankDecisionOption) => void
  onReplyToExpert?: (message: ThinkTankConversationMessage) => void
}

type MarkdownBlock =
  | { type: 'heading'; level: 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; language?: string; code: string }

export function AdvisoryChatMessage({
  message,
  isStreaming = false,
  decisionOptionsAreCurrent = true,
  onDecisionOption,
  onReplyToExpert,
}: AdvisoryChatMessageProps) {
  const roleDisplay = getRoleDisplay(message)
  const partyModeIdentity = getPartyModeIdentity(message)
  const canReplyToExpert = Boolean(partyModeIdentity && !isStreaming && onReplyToExpert)

  return (
    <article
      aria-label={roleDisplay.ariaLabel}
      className={cn('rounded-sm border border-l-[3px] p-4', roleDisplay.className)}
      style={partyModeIdentity ? { borderLeftColor: partyModeIdentity.accentColor } : undefined}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[hsl(var(--advisory-muted-foreground))]">
            {roleDisplay.label}
          </p>
          {partyModeIdentity && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] leading-4 text-[hsl(var(--advisory-muted-foreground))]">
              <span>{partyModeIdentity.role}</span>
              <span>第 {partyModeIdentity.round} 轮</span>
              <span>发言 {partyModeIdentity.speakerIndex}</span>
              {partyModeIdentity.perspective && <span>{partyModeIdentity.perspective}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--advisory-muted-foreground))]">
          {isStreaming && (
            <span
              role="status"
              aria-live="polite"
              aria-label={
                partyModeIdentity
                  ? `当前发言人：${partyModeIdentity.name}，${partyModeIdentity.role}`
                  : 'ThinkTank 回复生成状态'
              }
            >
              {partyModeIdentity
                ? `${partyModeIdentity.name}（${partyModeIdentity.role}）正在发言`
                : '正在生成'}
            </span>
          )}
          {message.stepIndex && <span>Step {message.stepIndex}</span>}
        </div>
      </div>
      <div className="min-w-0 break-words text-[length:inherit] leading-[inherit] text-[hsl(var(--advisory-foreground))]">
        <MarkdownContent content={message.content} />
        {isStreaming && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block text-[hsl(var(--advisory-foreground))]"
          >
            ▌
          </span>
        )}
      </div>
      {canReplyToExpert && partyModeIdentity && (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`回复${partyModeIdentity.name}，${partyModeIdentity.role}`}
            onClick={() => onReplyToExpert?.(message)}
            className="h-7 rounded-sm px-2 text-xs"
          >
            回复 {partyModeIdentity.name}
          </Button>
        </div>
      )}
      {message.role === 'assistant' && message.decisionOptions?.length ? (
        <div aria-label="顾问决策选项" className="mt-4 flex flex-wrap gap-2">
          {message.decisionOptions.map((option) => {
            const shortcutHint = option.shortcut ? `快捷键 ${option.shortcut}` : '无快捷键'
            const isDisabled = !option.enabled || !decisionOptionsAreCurrent
            const accessibleLabel = `${option.label}，${shortcutHint}${
              option.description ? `，${option.description}` : ''
            }`

            return (
              <span key={`${message.id}-${option.action}`} className="flex max-w-full flex-col gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDisabled}
                  aria-label={accessibleLabel}
                  title={accessibleLabel}
                  onClick={() => onDecisionOption?.(option)}
                  className="h-8 rounded-sm px-2 text-xs"
                >
                  <span>{option.label}</span>
                  {option.shortcut && (
                    <span className="ml-2 rounded-sm border border-current px-1 text-[10px] leading-4">
                      {option.shortcut}
                    </span>
                  )}
                </Button>
                {option.description && !option.enabled && decisionOptionsAreCurrent && (
                  <span className="max-w-56 text-[11px] leading-4 text-[hsl(var(--advisory-muted-foreground))]">
                    {option.description}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      ) : null}
    </article>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content)

  if (blocks.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const HeadingTag = `h${block.level}` as 'h2' | 'h3' | 'h4'

          return (
            <HeadingTag
              key={`${block.type}-${index}`}
              className="text-base font-semibold leading-6 text-[hsl(var(--advisory-foreground))]"
            >
              {renderInlineMarkdown(block.text)}
            </HeadingTag>
          )
        }

        if (block.type === 'list') {
          return (
            <ul key={`${block.type}-${index}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          )
        }

        if (block.type === 'code') {
          return (
            <pre
              key={`${block.type}-${index}`}
              className="max-w-full overflow-x-auto rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] p-3 text-xs leading-5"
            >
              <code className="font-mono" lang={block.language}>
                {block.code}
              </code>
            </pre>
          )
        }

        return (
          <p key={`${block.type}-${index}`} className="whitespace-pre-wrap">
            {renderInlineMarkdown(block.text)}
          </p>
        )
      })}
    </div>
  )
}

function parseMarkdownBlocks(rawContent: string): MarkdownBlock[] {
  const lines = rawContent.split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    const fence = trimmed.match(/^```(\w+)?\s*$/)
    if (fence) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ type: 'code', language: fence[1], code: codeLines.join('\n') })
      continue
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const headingText = sanitizeAiMarkdown(heading[2])
      blocks.push({
        type: 'heading',
        level: (heading[1].length + 1) as 2 | 3 | 4,
        text: headingText,
      })
      index += 1
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        const item = sanitizeAiMarkdown(lines[index].trim().replace(/^[-*]\s+/, ''))
        if (item.trim()) {
          items.push(item)
        }
        index += 1
      }
      if (items.length) {
        blocks.push({ type: 'list', items })
      }
      continue
    }

    const paragraphLines: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index].trim()) &&
      !/^(#{1,3})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index])
      index += 1
    }
    const paragraph = sanitizeAiMarkdown(paragraphLines.join('\n'))
    if (paragraph.trim()) {
      blocks.push({ type: 'paragraph', text: paragraph })
    }
  }

  return blocks
}

function renderInlineMarkdown(text: string) {
  const tokens = text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean)

  return tokens.map((token, index) => {
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={`${token}-${index}`}
          className="rounded-sm bg-[hsl(var(--advisory-muted-bg))] px-1 py-0.5 font-mono text-[0.92em]"
        >
          {token.slice(1, -1)}
        </code>
      )
    }

    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const href = sanitizeMarkdownHref(link[2])

      return (
        <a
          key={`${token}-${index}`}
          href={href}
          target={href.startsWith('http') ? '_blank' : undefined}
          rel={href.startsWith('http') ? 'noreferrer' : undefined}
          className="underline underline-offset-2"
        >
          {link[1]}
        </a>
      )
    }

    return token
  })
}

function sanitizeAiMarkdown(content: string): string {
  return content.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
}

function sanitizeMarkdownHref(href: string): string {
  const normalized = href.trim()
  if (
    normalized.startsWith('https://') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('mailto:') ||
    normalized.startsWith('#')
  ) {
    return normalized
  }

  return '#'
}

function getRoleDisplay(message: ThinkTankConversationMessage) {
  const partyModeIdentity = getPartyModeIdentity(message)
  if (partyModeIdentity) {
    return {
      label: partyModeIdentity.name,
      ariaLabel: `专家消息：${partyModeIdentity.name}，${partyModeIdentity.role}，第 ${partyModeIdentity.round} 轮`,
      className:
        'mr-auto max-w-[88%] border-l-[hsl(var(--advisory-foreground))] bg-[hsl(var(--advisory-muted-bg))]',
    }
  }

  if (message.role === 'user') {
    return {
      label: '你的回答',
      ariaLabel: '你的回答',
      className:
        'ml-auto max-w-[88%] border-l-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))]',
    }
  }

  if (message.role === 'system') {
    return {
      label: '系统消息',
      ariaLabel: '系统消息',
      className:
        'mr-auto max-w-[88%] border-l-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))]',
    }
  }

  if (message.role === 'expert') {
    const expertName =
      typeof message.metadata?.expert_name === 'string' ? message.metadata.expert_name : '专家'

    return {
      label: expertName,
      ariaLabel: `专家消息：${expertName}`,
      className:
        'mr-auto max-w-[88%] border-l-[hsl(var(--advisory-foreground))] bg-[hsl(var(--advisory-muted-bg))]',
    }
  }

  return {
    label: 'ThinkTank 顾问回复',
    ariaLabel: 'ThinkTank 顾问回复',
    className:
      'mr-auto max-w-[88%] border-l-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))]',
  }
}

function getPartyModeIdentity(message: ThinkTankConversationMessage):
  | {
      id: string
      name: string
      role: string
      perspective: string
      round: number
      speakerIndex: number
      accentColor: string
    }
  | null {
  if (message.metadata?.party_mode_message !== true) return null

  const advisorId = readMetadataText(message.metadata.party_mode_advisor_id) ?? 'expert'
  const name = readMetadataText(message.metadata.party_mode_advisor_name) ?? '专家'
  const role = readMetadataText(message.metadata.party_mode_advisor_role) ?? 'ThinkTank Expert'
  const perspective = readMetadataText(message.metadata.party_mode_advisor_perspective) ?? ''
  const round = readMetadataNumber(message.metadata.party_mode_round) ?? 1
  const speakerIndex = readMetadataNumber(message.metadata.party_mode_speaker_index) ?? 1

  return {
    id: advisorId,
    name,
    role,
    perspective,
    round,
    speakerIndex,
    accentColor: getExpertAccentColor(advisorId),
  }
}

function readMetadataText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readMetadataNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getExpertAccentColor(advisorId: string): string {
  const palette = ['#0f766e', '#7c3aed', '#b45309', '#2563eb', '#be123c']
  const hash = advisorId.split('').reduce((total, char) => total + char.charCodeAt(0), 0)

  return palette[hash % palette.length]
}
