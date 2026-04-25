import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const DEMO_SCENARIO = {
  episode: "Episode test - Le totem disparu",
  scenes: [
    {
      numero: 1,
      lieu: "Plage Solarys",
      personnages: ["Sarah", "Hassan"],
      action: "Sarah découvre que le totem a disparu juste avant l'épreuve et accuse Hassan de sabotage.",
      dialogue: "Sarah: Le totem était là ce matin.\nHassan: Tu crois vraiment que j'ai fait ça ?",
      narration: "Le camp bascule dans la suspicion au lever du soleil.",
      camera: "medium close-up on active speaker, reaction cutaways",
      emotion: "suspicion, colère retenue",
    },
    {
      numero: 2,
      lieu: "Camp Vornak",
      personnages: ["Roger"],
      action: "Roger fouille les sacs pendant que tout le monde se dispute au loin.",
      dialogue: "",
      narration: "Pendant que les accusations fusent, Roger agit seul dans l'ombre.",
      camera: "wide establishing shot then push-in",
      emotion: "méfiance, opportunisme",
    },
    {
      numero: 3,
      lieu: "Zone d'épreuve",
      personnages: ["Sarah", "Hassan", "Abel"],
      action: "Abel lance l'épreuve malgré la tension, forçant Sarah et Hassan à coopérer devant tout le monde.",
      dialogue: "Abel: On règle ça après l'épreuve.\nSarah: Très bien, mais je garde un oeil sur lui.",
      narration: "",
      camera: "tracking shot then medium close-up on active speaker",
      emotion: "pression, humiliation publique",
    },
  ],
};

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(DEMO_SCENARIO);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load demo scenario" }, { status: 500 });
  }
}
