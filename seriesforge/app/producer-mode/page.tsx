"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProducerModePanel from "@/components/chatbot/ProducerModePanel";

export default function ProducerModePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>

        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_420px] gap-6">
          <div className="space-y-6">
            <div className="rounded-3xl border border-[#2a2a3e] bg-[#13131a] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-purple-400 mb-3">Preview</p>
              <h1 className="text-4xl font-bold text-white mb-3">Mode Producteur IA multiagents</h1>
              <p className="text-gray-300 max-w-3xl">
                Cette preview vous permet de tester l&apos;expérience du chatbot producteur: analyse d&apos;un brief,
                d&apos;un scénario JSON ou d&apos;un angle audio, puis orchestration des agents scénario,
                dialogues, réalisation, storyboard, image, vidéo, voix et qualité.
              </p>
            </div>

            <div className="rounded-3xl border border-[#2a2a3e] bg-[#13131a] p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Ce que ce mode doit piloter</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {[
                  "Producteur / orchestration globale",
                  "Scénariste / drama / cliffhanger",
                  "Dialoguiste / répliques lipsync",
                  "Réalisateur / plans / rythme vertical",
                  "Storyboard / scènes / durées / angles",
                  "Mémoire personnages / casting / tenues",
                  "Décors / lieux / météo / ambiance",
                  "Props / totem / objets / accessoires",
                  "Prompt Master image",
                  "Prompt Master vidéo",
                  "Voix / lipsync / voix off",
                  "Montage / final cut / export",
                  "Qualité / cohérence / validation",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-[#2a2a3e] bg-[#1a1a24] px-4 py-3 text-gray-300">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="xl:sticky xl:top-6 self-start">
            <ProducerModePanel publicPreview />
          </div>
        </div>
      </div>
    </div>
  );
}
