
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const db = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

export const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export async function userFrom(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) throw new Error("Authentication required");

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) throw new Error("Invalid session");

  return data.user;
}

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
        system_instruction:
          system + "\nReturn only valid JSON. Do not use Markdown.",
        input: JSON.stringify(input),
        generation_config: {
          temperature: 0.4,
        },
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

export function avg(scores: (number | null)[]) {
  const values = scores.filter(
    (x): x is number => typeof x === "number"
  );

  return values.length
    ? Math.round(
        (values.reduce((a, b) => a + b, 0) / values.length) * 10
      ) / 10
    : 0;
}
