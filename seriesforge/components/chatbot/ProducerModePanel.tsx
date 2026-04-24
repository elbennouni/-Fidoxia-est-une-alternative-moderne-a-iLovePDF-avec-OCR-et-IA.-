"use client";

import { useMemo, useState } from "react";
import { Bot, ChevronDown, ChevronUp, Clapperboard, MessageSquareText, Mic, ShieldCheck, Sparkles, Users, Wand2 } from "lucide-react";
import { buildProducerPlan, AGENT_BLUEPRINT, type ProducerAgentStatus, type ProducerPlan } from "@/lib/chatbot/producerMode";

type Mode = "audio" | "scenario-json" | "brief";

export default function ProducerModePanel({ publicPreview = false }: { publicPreview?: boolean }) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("scenario-json");
  const [input, setInput] = useState("");
  const [seriesName, setSeriesName] = useState("Konanta");

  const plan = useMemo<ProducerPlan>(() => buildProducerPlan({
    mode,
    input: input || (mode === "scenario-json"
      ? JSON.stringify({
          scenes: [
            {
              numero: 1,
              lieu: "Plage Solarys",
              personnages: ["Sarah", "Hassan"],
              action: "Sarah confronte Hassan devant le totem après une trahison.",
              dialogue: "Sarah: Tu m'as menti.\nHassan: J'ai protégé l'équipe.",
              narration: "Le camp explose juste avant l'épreuve.",
              camera: "medium close-up on active speaker, reaction cutaways",
              emotion: "tension, humiliation, rage contenue",
            },
          ],
        }, null, 2)
      : mode === "audio"
        ? "Narrateur: La tempête se lève.\nSarah: On doit courir maintenant."
        : "Créer un épisode dramatique sur la plage avec confrontation, totem et révélation finale."),
  }), [mode, input, seriesName]);

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
                Ce panneau prépare le futur chatbot producteur. Il analyse un audio ou un scénario JSON, puis déclenche le workflow complet
                de création avec agents spécialisés, storyboard, prompts image/vidéo, voix et contrôle qualité.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("scenario-json")}
                className={`px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${mode === "scenario-json" ? "border-purple-500 bg-purple-600/15 text-purple-200" : "border-[#2a2a3e] bg-[#1e1e2e] text-gray-400"}`}
              >
                <MessageSquareText className="w-4 h-4 mx-auto mb-1" />
                Scénario JSON
              </button>
              <button
                onClick={() => setMode("audio")}
                className={`px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${mode === "audio" ? "border-blue-500 bg-blue-600/15 text-blue-200" : "border-[#2a2a3e] bg-[#1e1e2e] text-gray-400"}`}
              >
                <Mic className="w-4 h-4 mx-auto mb-1" />
                Analyse audio
              </button>
            </div>

            <button
              onClick={() => setMode("brief")}
              className={`w-full px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${mode === "brief" ? "border-emerald-500 bg-emerald-600/15 text-emerald-200" : "border-[#2a2a3e] bg-[#1e1e2e] text-gray-400"}`}
            >
              <Sparkles className="w-4 h-4 inline mr-2" />
              Brief libre
            </button>

            <div className="space-y-3">
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">Série</label>
                <input
                  value={seriesName}
                  onChange={(e) => setSeriesName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-[#1e1e2e] border border-[#2a2a3e] text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
                  {mode === "audio" ? "Résumé audio / transcript" : mode === "scenario-json" ? "Synopsis ou scénario JSON" : "Brief créatif"}
                </label>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={7}
                  placeholder={mode === "audio"
                    ? "Collez ici la transcription ou le résumé audio à analyser pour découper des clips."
                    : mode === "scenario-json"
                      ? "Collez ici un synopsis libre ou un scénario JSON pour lancer un storyboard détaillé."
                      : "Décrivez simplement l'épisode voulu et le producteur prépare le plan multiagents."}
                  className="w-full px-4 py-3 rounded-2xl bg-[#1e1e2e] border border-[#2a2a3e] text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Agents actifs" value={String(AGENT_BLUEPRINT.length)} icon={<Users className="w-4 h-4 text-blue-400" />} />
              <MetricCard label="Scènes prévues" value={String(plan.scenes.length)} icon={<Clapperboard className="w-4 h-4 text-purple-400" />} />
            </div>

            <div className="space-y-2">
              <SectionTitle icon={<Wand2 className="w-4 h-4 text-purple-400" />} title="Agents branchés" />
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                {plan.agents.map((agent: ProducerAgentStatus) => (
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
                {plan.scenes.map((step, index) => (
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

            <div className="rounded-2xl border border-green-600/20 bg-green-900/10 p-4">
              <SectionTitle icon={<ShieldCheck className="w-4 h-4 text-green-400" />} title="Règles de qualité intégrées" />
              <ul className="mt-3 space-y-2 text-sm text-green-100/90">
                {plan.recommendations.map((guard: string, index: number) => (
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
