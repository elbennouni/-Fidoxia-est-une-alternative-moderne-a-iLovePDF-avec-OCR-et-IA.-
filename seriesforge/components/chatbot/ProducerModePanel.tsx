"use client";

import { useRef, useState } from "react";
import { Bot, ChevronDown, ChevronUp, Clapperboard, Loader2, MessageSquareText, Paperclip, Send, ShieldCheck, Sparkles, Users, Wand2, X } from "lucide-react";
import { AGENT_BLUEPRINT, buildProducerPlan, type ProducerAgentStatus, type ProducerPlan } from "@/lib/chatbot/producerMode";
import type { ProducerAttachment, ProducerChatResponse, ProducerMessage } from "@/lib/chatbot/producerChat";

type ProducerVariant = "preview" | "series-compact" | "episode-full";

interface ProducerModePanelProps {
  publicPreview?: boolean;
  variant?: ProducerVariant;
  seriesName?: string;
  seriesId?: string;
  episodeId?: string;
  episodeTitle?: string;
}

export default function ProducerModePanel({
  publicPreview = false,
  variant = "preview",
  seriesName: initialSeriesName = "Konanta",
  seriesId,
  episodeId,
  episodeTitle,
}: ProducerModePanelProps) {
  const isSeriesCompact = variant === "series-compact";
  const isEpisodeFull = variant === "episode-full";
  const initialMessages: ProducerMessage[] = [
    {
      role: "producer",
      text: isEpisodeFull
        ? `Je pilote maintenant l'épisode${episodeTitle ? ` "${episodeTitle}"` : ""}. Je vais vous proposer les étapes : scénario, personnages à réutiliser, décors, accessoires, storyboard, prompts et voix.`
        : `Je prépare la série${initialSeriesName ? ` "${initialSeriesName}"` : ""}. Je peux vous aider à créer le prochain épisode, clarifier le style et structurer la production avant d'entrer dans l'épisode.`,
    },
    {
      role: "producer",
      text: isEpisodeFull
        ? "Voulez-vous que je commence par écrire le scénario de l'épisode en cours, ou que je prépare d'abord les décors, accessoires et le style ?"
        : "Quel épisode voulez-vous créer pour cette série ? Donnez-moi une idée simple et je vous proposerai un plan avant création.",
    },
  ];
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [seriesName, setSeriesName] = useState(initialSeriesName);
  const [remotePlan, setRemotePlan] = useState<ProducerPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [messages, setMessages] = useState<ProducerMessage[]>(initialMessages);
  const [attachments, setAttachments] = useState<ProducerAttachment[]>([]);
  const [loadingDemoScenario, setLoadingDemoScenario] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallbackPlan = buildProducerPlan({
    mode: "brief",
    input: isEpisodeFull
      ? "Préparer le pilotage complet de l'épisode courant avec validation étape par étape."
      : "Préparer le prochain épisode de la série en partant d'un brief simple.",
  });
  const effectivePlan = remotePlan || fallbackPlan;

  async function sendToProducer() {
    const submittedInput = input.trim();
    if (!submittedInput && attachments.length === 0) return;
    setLoadingPlan(true);
    try {
      const scope = isEpisodeFull ? "episode" : isSeriesCompact ? "series" : "preview";
      const res = await fetch("/api/producer/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          seriesId,
          episodeId,
          seriesName,
          episodeTitle,
          message: submittedInput,
          messages,
          attachments,
        }),
      });
      const data = await res.json() as ProducerChatResponse | { error?: string };
      if (!res.ok) throw new Error(("error" in data && data.error) || "Analyse impossible");
      const successData = data as ProducerChatResponse;
      setRemotePlan(successData.plan);
      setMessages(successData.messages);
      setAttachments([]);
      setInput("");
      setValidationError(null);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "user", text: submittedInput.slice(0, 240) || "Pièce jointe envoyée" },
        { role: "producer", text: error instanceof Error ? error.message : "Analyse impossible" },
      ]);
    } finally {
      setLoadingPlan(false);
    }
  }

  async function loadDemoScenario() {
    setLoadingDemoScenario(true);
    try {
      const res = await fetch("/api/producer/demo-scenario");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de charger le scénario");
      const scenarioText = JSON.stringify(data, null, 2);
      setAttachments((prev) => [
        ...prev.filter((item) => item.type !== "scenario-json"),
        {
          id: `scenario-${Date.now()}`,
          type: "scenario-json",
          name: "scenario-test.json",
          content: scenarioText,
        },
      ]);
      setMessages((prev) => [
        ...prev,
        { role: "producer", text: "J'ai préparé un scénario JSON de test. Cliquez sur Envoyer pour que je l'analyse et vous propose le déroulé." },
      ]);
    } finally {
      setLoadingDemoScenario(false);
    }
  }

  async function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text().catch(() => "");
    const lowerName = file.name.toLowerCase();
    const type =
      lowerName.endsWith(".json") ? "scenario-json"
      : file.type.startsWith("audio/") ? "audio"
      : lowerName.match(/\.(png|jpg|jpeg|webp|gif)$/) ? "image"
      : "image";

    setAttachments((prev) => [
      ...prev,
      {
        id: `${file.name}-${Date.now()}`,
        type,
        name: file.name,
        content,
      },
    ]);
    e.target.value = "";
  }

  return (
    <aside className="w-full xl:w-[420px] flex-shrink-0">
      <div className="rounded-3xl border border-purple-500/20 bg-[#13131a] overflow-hidden shadow-2xl">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-purple-900/40 via-blue-900/20 to-purple-900/30"
        >
          <div className="text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-purple-300">Mode automatique</p>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-1">
              <Bot className="w-5 h-5 text-purple-400" />
              Producteur IA multiagents
            </h2>
          </div>
          {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {open && (
          <div className="p-5 space-y-5">
            <div className="rounded-2xl border border-[#2a2a3e] bg-[#1b1b24] p-4">
              <p className="text-sm text-gray-300 leading-relaxed">
                {isSeriesCompact
                  ? "Préparez un nouvel épisode depuis la série : angle, style, synopsis, structure et scénario de départ."
                  : isEpisodeFull
                    ? "Ce chat pilote l'épisode en cours : scénario, réutilisation personnages, décors, accessoires, storyboard, prompts, voix et validations."
                    : "Ce panneau prépare le futur chatbot producteur. Il analyse un audio ou un scénario JSON, puis déclenche le workflow complet de création avec agents spécialisés, storyboard, prompts image/vidéo, voix et contrôle qualité."}
              </p>
            </div>

            <div className="space-y-2">
              <SectionTitle icon={<Clapperboard className="w-4 h-4 text-orange-400" />} title="Canvas de production" />
              <div className="rounded-2xl border border-[#2a2a3e] bg-[#1e1e2e] p-3 text-sm text-gray-300 max-h-44 overflow-y-auto">
                <p className="font-medium text-white mb-2">{effectivePlan.summary}</p>
                <ul className="space-y-2">
                  {effectivePlan.scenes.slice(0, isSeriesCompact ? 3 : 5).map((step, index) => (
                    <li key={`${step.title}-${index}`} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-orange-400 flex-shrink-0" />
                      <span>
                        <strong>{step.title}</strong> — {step.action}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <SectionTitle icon={<MessageSquareText className="w-4 h-4 text-cyan-400" />} title="Dialogue" />
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`rounded-2xl p-3 text-sm ${
                      message.role === "user"
                        ? "bg-blue-600/15 border border-blue-600/25 text-blue-100"
                        : "bg-[#1e1e2e] border border-[#2a2a3e] text-gray-200"
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-wide opacity-70 mb-1">
                      {message.role === "user" ? "Vous" : "Producteur IA"}
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a2a3e] bg-[#1e1e2e] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Boîte de dialogue</p>
                  <p className="text-sm text-gray-300 mt-1">
                    Parlez au Producteur IA, joignez un scénario JSON, un son, une image de décor ou un personnage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl border border-[#2a2a3e] bg-[#13131a] hover:border-purple-500/40 text-gray-300 text-sm flex items-center gap-2"
                >
                  <Paperclip className="w-4 h-4" />
                  Joindre
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,audio/*,image/*,.txt"
                className="hidden"
                onChange={handleAttachmentChange}
              />

              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">Série</label>
                <input
                  value={seriesName}
                  onChange={(e) => setSeriesName(e.target.value)}
                  disabled={variant !== "preview"}
                  className="w-full px-4 py-3 rounded-2xl bg-[#13131a] border border-[#2a2a3e] text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#13131a] border border-[#2a2a3e] text-sm text-gray-300">
                      <span className="text-xs uppercase text-purple-300">{attachment.type}</span>
                      <span className="truncate max-w-[180px]">{attachment.name}</span>
                      <button
                        onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                        className="text-gray-500 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={isEpisodeFull ? 4 : 3}
                placeholder={isEpisodeFull
                  ? "Ex: Crée le scénario, réutilise Sarah et Hassan, propose les décors et accessoires, puis demande-moi validation étape par étape."
                  : "Ex: Je veux créer l'épisode 5, ambiance sombre, style Pixar réaliste, et un grand conflit au camp."}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void sendToProducer();
                  }
                }}
                className="w-full px-4 py-3 rounded-2xl bg-[#13131a] border border-[#2a2a3e] text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
              />
              {validationError && (
                <p className="text-xs text-red-400">JSON invalide : {validationError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={sendToProducer}
                  disabled={loadingPlan}
                  className="flex-1 px-4 py-3 rounded-2xl border border-purple-500/30 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {loadingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {loadingPlan ? "Le Producteur réfléchit..." : "Envoyer au Producteur IA"}
                </button>
                <button
                  onClick={loadDemoScenario}
                  disabled={loadingDemoScenario}
                  className="px-4 py-3 rounded-2xl border border-orange-600/30 bg-orange-600/10 hover:bg-orange-600/20 disabled:opacity-50 text-orange-200 text-sm font-medium transition-all"
                >
                  {loadingDemoScenario ? "..." : "Démo"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Agents actifs" value={String(AGENT_BLUEPRINT.length)} icon={<Users className="w-4 h-4 text-blue-400" />} />
              <MetricCard label="Scènes prévues" value={String(effectivePlan.scenes.length)} icon={<Clapperboard className="w-4 h-4 text-purple-400" />} />
            </div>

            <div className="rounded-2xl border border-[#2a2a3e] bg-[#1e1e2e] p-3 text-sm text-gray-400">
              {loadingPlan ? "Analyse multiagents en cours..." : effectivePlan.summary}
            </div>

            <div className="space-y-2">
              <SectionTitle icon={<Wand2 className="w-4 h-4 text-purple-400" />} title="Agents branchés" />
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                {effectivePlan.agents.map((agent: ProducerAgentStatus) => (
                  <div key={agent.id} className="rounded-2xl border border-[#2a2a3e] bg-[#1e1e2e] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{agent.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{agent.role}</p>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-purple-600/15 border border-purple-600/30 text-purple-200">
                        {agent.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionTitle icon={<Sparkles className="w-4 h-4 text-orange-400" />} title="Plan d’exécution" />
              <div className="space-y-2">
                {effectivePlan.scenes.map((step: ProducerPlan["scenes"][number], index: number) => (
                  <div key={`${step.title}-${index}`} className="rounded-2xl border border-[#2a2a3e] bg-[#1e1e2e] p-3">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-orange-600/15 border border-orange-600/30 text-orange-300 text-xs font-bold flex items-center justify-center mt-0.5">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{step.title}</p>
                        <p className="text-xs text-gray-400 mt-1">{step.camera}</p>
                        <p className="text-xs text-gray-500 mt-1">{step.lipsync ? "lipsync actif" : "narration / action"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isEpisodeFull && (
              <div className="rounded-2xl border border-purple-600/20 bg-purple-900/10 p-4 text-sm text-purple-100">
                Épisode en cours : {episodeTitle || "épisode courant"}. Le Producteur IA doit vous proposer chaque étape, attendre votre accord, puis exécuter.
              </div>
            )}

            {isSeriesCompact && (
              <div className="rounded-2xl border border-blue-600/20 bg-blue-900/10 p-4 text-sm text-blue-100">
                Une fois l&apos;épisode créé, ouvrez-le pour continuer avec le chat complet, étape par étape.
              </div>
            )}

            <div className="rounded-2xl border border-green-600/20 bg-green-900/10 p-4">
              <SectionTitle icon={<ShieldCheck className="w-4 h-4 text-green-400" />} title="Règles de qualité intégrées" />
              <ul className="mt-3 space-y-2 text-sm text-green-100/90">
                {effectivePlan.recommendations.map((guard: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-400" />
                    <span>{guard}</span>
                  </li>
                ))}
              </ul>
            </div>

            {publicPreview && (
              <div className="rounded-2xl border border-blue-600/20 bg-blue-900/10 p-4 text-sm text-blue-100">
                Cette preview est déjà testable en ligne comme démonstrateur de votre futur chatbot Producteur IA, même avant le branchement complet au pipeline.
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <p className="text-sm font-semibold text-white">{title}</p>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        <div>{icon}</div>
      </div>
    </div>
  );
}
