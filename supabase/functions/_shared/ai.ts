
export async function askAI(system: string, input: unknown) {
  const key = Deno.env.get("GEMINI_API_KEY");

  if (!key) {
    throw new Error("Gemini API key is missing in Supabase secrets.");
  }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
        "Api-Revision": "2026-05-20",
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash-lite",
        input:
          `Instructions:\n${system}\n\n` +
          `Input:\n${JSON.stringify(input)}\n\n` +
          "Return only valid JSON. Do not use Markdown code fences.",
        store: false,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message || `Gemini API error (${response.status})`
    );
  }

  if (result.status === "failed") {
    throw new Error(
      result.errors?.map((e: { message?: string }) => e.message).join("; ") ||
      "Gemini interaction failed."
    );
  }

  const output = (result.steps ?? [])
    .filter((step: { type?: string }) => step.type === "model_output")
    .flatMap((step: { content?: { type?: string; text?: string }[] }) =>
      step.content ?? []
    )
    .filter((part: { type?: string }) => part.type === "text")
    .map((part: { text?: string }) => part.text ?? "")
    .join("")
    .trim();

  if (!output) {
    throw new Error("Gemini returned an empty response.");
  }

  const cleaned = output
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Gemini returned invalid JSON: " + cleaned.slice(0, 200));
  }
}
