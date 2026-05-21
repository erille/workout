import { Bot, Send, Trash2, UserRound } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";

type CoachStatus = {
  enabled: boolean;
  model: string;
  provider: "openai" | "openrouter";
  reason?: string;
};

type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  provider?: string;
  model?: string;
};

type CoachChatResponse = {
  dataChanged: boolean;
  messages: CoachMessage[];
};

type CoachPageProps = {
  onDataChanged: () => void;
};

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function CoachPage({ onDataChanged }: CoachPageProps) {
  const { language, t } = useI18n();
  const [status, setStatus] = useState<CoachStatus | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    Promise.all([
      apiJson<CoachStatus>("/api/coach/status"),
      apiJson<{ messages: CoachMessage[] }>("/api/coach/messages"),
    ])
      .then(([loadedStatus, loadedMessages]) => {
        if (!isMounted) {
          return;
        }

        setStatus(loadedStatus);
        setMessages(loadedMessages.messages);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : t("coach.errorLoad"));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();

    if (!message || isSending) {
      return;
    }

    setDraft("");
    setError(null);
    setIsSending(true);

    const optimisticMessage: CoachMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const response = await apiJson<CoachChatResponse>("/api/coach/chat", {
        method: "POST",
        body: JSON.stringify({ language, message }),
      });

      setMessages(response.messages);

      if (response.dataChanged) {
        onDataChanged();
      }
    } catch (sendError) {
      setMessages((current) => current.filter((item) => item.id !== optimisticMessage.id));
      setDraft(message);
      setError(sendError instanceof Error ? sendError.message : t("coach.errorSend"));
    } finally {
      setIsSending(false);
    }
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.altKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (!draft.trim() || isSending) {
      return;
    }

    event.currentTarget.form?.requestSubmit();
  };

  const clearMessages = async () => {
    setError(null);

    try {
      const response = await apiJson<{ messages: CoachMessage[] }>("/api/coach/clear", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setMessages(response.messages);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : t("coach.errorClear"));
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">{t("coach.section")}</p>
          <h2 className="text-2xl font-bold text-slate-50">{t("coach.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{t("coach.description")}</p>
        </div>
        {messages.length > 0 ? (
          <button type="button" className="secondary-button w-fit" onClick={clearMessages}>
            <Trash2 aria-hidden="true" size={17} />
            {t("coach.clear")}
          </button>
        ) : null}
      </div>

      <div className="panel flex min-h-[34rem] flex-col p-4">
        {isLoading ? (
          <div className="rounded-md border border-slate-800 bg-slate-950/70 p-4 text-slate-300">
            {t("coach.loading")}
          </div>
        ) : !status?.enabled ? (
          <div className="rounded-md border border-amber-300/50 bg-amber-300/10 p-4 text-amber-50">
            <p className="font-bold">{t("coach.notConfigured")}</p>
            <p className="mt-1 text-sm text-slate-300">{status?.reason ?? t("coach.notConfiguredHelp")}</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-slate-400">
              <span className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1">
                {status.provider}
              </span>
              <span className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1">
                {status.model}
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/50 p-3">
              {messages.length === 0 ? (
                <div className="flex min-h-80 items-center justify-center text-center text-sm text-slate-400">
                  {t("coach.empty")}
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <article
                      key={message.id}
                      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser ? (
                        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-400 text-slate-950">
                          <Bot aria-hidden="true" size={17} />
                        </span>
                      ) : null}
                      <div
                        className={`max-w-3xl whitespace-pre-wrap rounded-md border px-3 py-2 text-sm leading-6 ${
                          isUser
                            ? "border-cyan-300/60 bg-cyan-300 text-slate-950"
                            : "border-slate-800 bg-slate-900 text-slate-100"
                        }`}
                      >
                        {message.content}
                      </div>
                      {isUser ? (
                        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300">
                          <UserRound aria-hidden="true" size={17} />
                        </span>
                      ) : null}
                    </article>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {error ? (
              <div className="mt-3 rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <form className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="coach-message">
                {t("coach.inputLabel")}
              </label>
              <textarea
                id="coach-message"
                className="field min-h-24 resize-y"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder={t("coach.placeholder")}
              />
              <button type="submit" className="primary-button self-end" disabled={isSending || !draft.trim()}>
                <Send aria-hidden="true" size={17} />
                {isSending ? t("coach.sending") : t("coach.send")}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
