import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { askAssistantApi } from '../../api/client';
import type { ChatEvidenceItem } from '../../shared/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mode?: 'gemini' | 'deterministic-fallback';
  modelUsed?: string;
  notice?: string;
  evidence?: ChatEvidenceItem[];
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  reportingMonth: string;
  monthLabel: string;
  focusedProject?: { code: string; name: string } | null;
  onClearProjectFocus: () => void;
  onSelectProject: (projectCode: string) => void;
}

const STARTER_PROMPTS = [
  'What do the risk levels mean?',
  'Which projects have the highest schedule delay risk?',
  'How is Maharashtra performing on infrastructure outlays?',
  'How do I use the What-If Lab?',
];

function renderFormattedText(text: string) {
  const renderInline = (line: string, keyPrefix: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={`${keyPrefix}-${i}`} className="font-semibold text-[#0B2545]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <em key={`${keyPrefix}-${i}`} className="italic">
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={`${keyPrefix}-${i}`}>{part}</span>;
    });
  };

  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return null;
        if (line.startsWith('### ') || line.startsWith('## ')) {
          const headingText = line.replace(/^#{2,3}\s+/, '');
          return (
            <p key={idx} className="font-semibold text-[#0B2545] pt-1.5">
              {renderInline(headingText, `h-${idx}`)}
            </p>
          );
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span aria-hidden="true" className="text-slate-400 mt-0.5">•</span>
              <span>{renderInline(line.slice(2), `b-${idx}`)}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInline(line, `p-${idx}`)}</p>;
      })}
    </div>
  );
}

export function ChatPanel({
  open,
  onClose,
  reportingMonth,
  monthLabel,
  focusedProject,
  onClearProjectFocus,
  onSelectProject,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!open) return null;

  const visibleStarters = focusedProject
    ? STARTER_PROMPTS.filter((p) => !p.includes(focusedProject.code))
    : STARTER_PROMPTS;

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const reply = await askAssistantApi({
        question: trimmed,
        reportingMonth,
        projectCode: focusedProject?.code,
        history: nextHistory.slice(-6).map((m) => ({ role: m.role, text: m.text })),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: reply.answer,
          mode: reply.mode,
          modelUsed: reply.modelUsed,
          notice: reply.notice,
          evidence: reply.evidence,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI assistant endpoint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="PAIMANA Grounded AI Assistant"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
    >
      <div className="w-full max-w-lg bg-white h-full border-l border-[#DCE3EC] flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-5 py-4 bg-[#0B2545] text-white flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">PAIMANA Data-Grounded Assistant</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Grounded in {monthLabel} dataset · Cites verified project codes & figures
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Assistant"
            className="p-1.5 rounded hover:bg-[#13315C] text-slate-200 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Focused Project Context Bar */}
        {focusedProject && (
          <div className="px-5 py-2.5 bg-[#F8FAFC] border-b border-[#DCE3EC] flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0 flex-1 truncate">
              <span className="text-slate-500">Focus: </span>
              <span className="font-mono font-semibold text-[#0B2545] whitespace-nowrap">
                {focusedProject.code}
              </span>
              <span className="text-slate-700 ml-1">({focusedProject.name})</span>
            </div>
            <button
              type="button"
              onClick={onClearProjectFocus}
              className="text-[#0B2545] hover:underline font-medium shrink-0 whitespace-nowrap cursor-pointer"
            >
              Clear Focus
            </button>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F4F6F9]">
          {messages.length === 0 && (
            <div className="bg-white border border-[#DCE3EC] rounded-md p-4 space-y-3">
              <p className="text-xs font-semibold text-[#0B2545]">
                Ask a question about {monthLabel} infrastructure data
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Answers are grounded strictly in the loaded PAIMANA records. If the dataset does not support a query, the assistant will state that limitation explicitly.
              </p>
              <div className="space-y-2 pt-1">
                {focusedProject && (
                  <button
                    type="button"
                    onClick={() =>
                      sendQuestion(
                        `Why is ${focusedProject.code} flagged, and what bottlenecks or recommendations apply?`,
                      )
                    }
                    className="w-full text-left px-3 py-2 text-xs font-medium border border-[#0B2545] bg-slate-50 text-[#0B2545] rounded hover:bg-slate-100 cursor-pointer"
                  >
                    Why is {focusedProject.code} flagged, and what actions are recommended?
                  </button>
                )}
                {visibleStarters.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendQuestion(prompt)}
                    className="w-full text-left px-3 py-2 text-xs border border-[#DCE3EC] bg-white text-slate-800 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[92%] rounded-md px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#0B2545] text-white'
                    : 'bg-white border border-[#DCE3EC] text-slate-800'
                }`}
              >
                {msg.role === 'assistant' ? renderFormattedText(msg.text) : msg.text}

                {msg.notice && (
                  <p className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-amber-800">
                    {msg.notice}
                  </p>
                )}

                {msg.evidence && msg.evidence.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-600 mb-1.5">
                      Cited Dataset Evidence ({msg.mode === 'gemini' ? msg.modelUsed : 'Grounded Fallback'}):
                    </p>
                    <div className="space-y-1.5">
                      {msg.evidence.map((ev) => (
                        <button
                          key={ev.projectCode}
                          type="button"
                          onClick={() => {
                            onSelectProject(ev.projectCode);
                            onClose();
                          }}
                          className="w-full text-left px-2.5 py-1.5 border border-[#DCE3EC] rounded bg-[#F8FAFC] hover:bg-slate-100 flex items-center justify-between gap-2 text-[11px] cursor-pointer"
                        >
                          <span className="truncate font-medium text-[#0B2545]">
                            <span className="font-mono">{ev.projectCode}</span> · {ev.name}
                          </span>
                          <span className="font-mono tabular-nums text-slate-600 shrink-0">
                            Risk {ev.ruleBasedScore}/100 · {ev.delayMonths}m
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div
              role="status"
              className="bg-white border border-[#DCE3EC] rounded-md px-4 py-3 text-xs text-slate-600 max-w-[85%]"
            >
              Analyzing {monthLabel} records and preparing grounded response...
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs text-[#B91C1C]"
            >
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="p-4 bg-white border-t border-[#DCE3EC] flex items-center gap-2"
        >
          <label htmlFor="chat-question-input" className="sr-only">
            Ask a question about PAIMANA project data
          </label>
          <input
            id="chat-question-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about risk scores, delays, states, or sectors..."
            className="flex-1 px-3 py-2 text-xs border border-[#DCE3EC] rounded bg-white text-slate-900 focus-visible:outline-2 focus-visible:outline-[#0B2545]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send question"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#0B2545] text-white rounded hover:bg-[#13315C] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
}
