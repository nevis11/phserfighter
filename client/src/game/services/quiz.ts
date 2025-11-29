export type QuizOption = {
  text: string;
};

export type Quiz = {
  question: string;
  options: QuizOption[]; // length 4
  correctIndex: number; // 0-3
};

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function buildPrompt(): string {
  return (
    "Generate ONE short multiple-choice question suitable for a dungeon-adventure game. " +
    "Return JSON ONLY with fields: question (string), options (array of 4 strings), correctIndex (0-3). " +
    "No explanation, no markdown."
  );
}

export async function getQuizQuestion(): Promise<Quiz> {
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY as string | undefined;

  if (!apiKey) {
    console.warn("No API key found, using fallback quiz.");
    return {
      question: "Which item opens a locked door?",
      options: [
        { text: "Small Key" },
        { text: "Map" },
        { text: "Compass" },
        { text: "Boss" },
      ],
      correctIndex: 0,
    };
  }

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt() }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
        },
      }),
    });
    const data = await res.json();
    const candidate = data?.candidates?.[0];

    // Prefer direct JSON if responseMimeType is respected
    let parsed: any | undefined;
    const parts = candidate?.content?.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (typeof p?.text === "string" && p.text.trim().length > 0) {
          // Text path (model returned JSON as a string)
          const t = p.text as string;
          const s = t.indexOf("{");
          const e = t.lastIndexOf("}");
          const jsonStr = s >= 0 && e > s ? t.slice(s, e + 1) : t;
          try {
            parsed = JSON.parse(jsonStr);
            break;
          } catch {}
        } else if (p?.inlineData?.mimeType === "application/json" && p.inlineData?.data) {
          // Inline base64 JSON path
          try {
            const decoded = atob(p.inlineData.data as string);
            parsed = JSON.parse(decoded);
            break;
          } catch {}
        }
      }
    }

    if (!parsed) throw new Error("No JSON content in Gemini response");

    const options = (parsed.options || []).slice(0, 4).map((o: string) => ({
      text: String(o),
    }));
    if (options.length < 4) throw new Error("Not enough options");

    return {
      question: String(parsed.question || "Answer this to get the key!"),
      options,
      correctIndex: Math.min(Math.max(Number(parsed.correctIndex ?? 0), 0), 3),
    };
  } catch (e) {
    console.error("Quiz generation failed:", e);
    return {
      question: "Fire is weak against which element?",
      options: [
        { text: "Water" },
        { text: "Earth" },
        { text: "Wind" },
        { text: "Fire" },
      ],
      correctIndex: 0,
    };
  }
}
