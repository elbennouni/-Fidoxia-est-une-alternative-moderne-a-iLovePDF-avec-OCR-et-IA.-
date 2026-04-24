"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Settings, Key, Eye, EyeOff, Save, Loader2, CheckCircle, ExternalLink } from "lucide-react";

const API_KEYS = [
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI",
    description: "GPT-4o (scénarios, QC) + DALL-E 3 (images) + Vision (analyse photos)",
    placeholder: "sk-proj-...",
    link: "https://platform.openai.com/api-keys",
    required: true,
  },
  {
    key: "REPLICATE_API_TOKEN",
    label: "Replicate",
    description: "FLUX, SDXL, Ideogram v2, Wan vidéo — img2img disponible",
    placeholder: "r8_...",
    link: "https://replicate.com/account/api-tokens",
    required: false,
  },
  {
    key: "FAL_API_KEY",
    label: "Fal.ai",
    description: "FLUX Schnell (~$0.001/img), FLUX Dev img2img, Recraft v3 Pixar",
    placeholder: "xxxxxxxx:xxxxxxxx",
    link: "https://fal.ai/dashboard/keys",
    required: false,
  },
  {
    key: "TOGETHER_API_KEY",
    label: "Together.ai",
    description: "FLUX Schnell 100% GRATUIT avec compte — idéal pour tests",
    placeholder: "...",
    link: "https://api.together.ai/settings/api-keys",
    required: false,
  },
  {
    key: "HUGGINGFACE_API_KEY",
    label: "HuggingFace",
    description: "FLUX Dev entièrement GRATUIT via Inference API",
    placeholder: "hf_...",
    link: "https://huggingface.co/settings/tokens",
    required: false,
  },
  {
    key: "STABILITY_API_KEY",
    label: "Stability AI",
    description: "Stable Diffusion Core ($0.003/img) et Ultra ($0.008/img)",
    placeholder: "sk-...",
    link: "https://platform.stability.ai/account/credits",
    required: false,
  },
  {
    key: "HEYGEN_API_KEY",
    label: "HeyGen",
    description: "Voix TTS françaises pour personnages et narrateur",
    placeholder: "...",
    link: "https://app.heygen.com/settings?nav=API",
    required: false,
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({
    OPENAI_API_KEY: "",
    REPLICATE_API_TOKEN: "",
    FAL_API_KEY: "",
    HEYGEN_API_KEY: "",
  });
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "error">("idle");
  const [currentKeys, setCurrentKeys] = useState<Record<string, string>>({});

  useEffect(() => { fetchCurrentKeys(); }, []);

  async function fetchCurrentKeys() {
    try {
      const res = await fetch("/api/settings");
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setCurrentKeys(data.keys || {});
    } catch {}
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const toSave: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v.trim()) toSave[k] = v.trim();
      }
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("✅ Clés API sauvegardées !");
      setValues({ OPENAI_API_KEY: "", REPLICATE_API_TOKEN: "", FAL_API_KEY: "", HEYGEN_API_KEY: "" });
      fetchCurrentKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function testOpenAI() {
    setTesting(true);
    setTestResult("idle");
    try {
      const res = await fetch("/api/settings/test-openai");
      const data = await res.json();
      if (data.ok) {
        setTestResult("ok");
        toast.success("✅ Clé OpenAI valide !");
      } else {
        setTestResult("error");
        toast.error("❌ Clé OpenAI invalide : " + data.error);
      }
    } catch {
      setTestResult("error");
      toast.error("Test échoué");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-purple-400" /> Paramètres
        </h1>
        <p className="text-gray-400 mt-1">Configurez vos clés API directement ici</p>
      </div>

      {/* Current status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-8">
        {API_KEYS.map(({ key, label }) => {
          const hasKey = !!currentKeys[key];
          return (
            <div key={key} className={`p-2.5 rounded-xl border text-center ${hasKey ? "bg-green-900/10 border-green-600/30" : "bg-[#13131a] border-[#2a2a3e]"}`}>
              <div className={`text-base mb-0.5 ${hasKey ? "text-green-400" : "text-gray-600"}`}>{hasKey ? "✅" : "⚠️"}</div>
              <p className="text-xs font-medium text-white truncate">{label}</p>
              <p className={`text-xs mt-0.5 ${hasKey ? "text-green-400" : "text-gray-500"}`}>{hasKey ? "OK" : "Manquante"}</p>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {API_KEYS.map(({ key, label, description, placeholder, link, required }) => (
          <div key={key} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-white">{label}</span>
                  {required && <span className="text-xs px-1.5 py-0.5 bg-red-600/20 border border-red-600/30 rounded text-red-400">Requis</span>}
                </div>
                <p className="text-xs text-gray-400 mt-1">{description}</p>
              </div>
              <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors whitespace-nowrap ml-3">
                Obtenir <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {currentKeys[key] && (
              <div className="mb-2 px-3 py-1.5 bg-green-900/10 border border-green-600/20 rounded-lg">
                <p className="text-xs text-green-400">✅ Clé actuelle : {currentKeys[key]}</p>
              </div>
            )}

            <div className="relative">
              <input
                type={visible[key] ? "text" : "password"}
                value={values[key]}
                onChange={e => setValues({ ...values, [key]: e.target.value })}
                placeholder={currentKeys[key] ? "Laisser vide pour garder la clé actuelle" : placeholder}
                className="w-full px-4 py-3 pr-12 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setVisible({ ...visible, [key]: !visible[key] })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {visible[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? "Sauvegarde..." : "Sauvegarder les clés"}
          </button>
          <button
            type="button"
            onClick={testOpenAI}
            disabled={testing}
            className={`flex items-center gap-2 px-5 py-3 border rounded-xl font-medium transition-all ${
              testResult === "ok" ? "border-green-500 text-green-400 bg-green-900/10" :
              testResult === "error" ? "border-red-500 text-red-400 bg-red-900/10" :
              "border-[#2a2a3e] text-gray-400 hover:border-gray-400"
            }`}
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> :
             testResult === "ok" ? <CheckCircle className="w-4 h-4" /> :
             <Key className="w-4 h-4" />}
            Tester OpenAI
          </button>
        </div>
      </form>
    </div>
  );
}
