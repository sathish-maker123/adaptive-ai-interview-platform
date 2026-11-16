
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
    throw new Error("Gemini is not configured. Add GEMINI_API_KEY in Supabase secrets.");
  }

  const model = "gemini-2.5-flash-lite";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  `Instructions:\n${system}\n\nInput:\n${JSON.stringify(input)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message || `Gemini API error (${response.status})`
    );
  }

  const text = result?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("");

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Gemini returned invalid JSON.");
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
