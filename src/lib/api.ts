
import { supabase } from "./supabase";

export async function invoke<T>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add your project credentials."
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Please sign in first.");
  }

  const { data, error } = await supabase.functions.invoke(name, {
    body,
  });

  if (error) {
    const context = (error as { context?: Response }).context;

    if (context) {
      const result = await context.clone().json().catch(() => null);
      throw new Error(result?.error || error.message);
    }

    throw new Error(error.message);
  }

  return data as T;
}
