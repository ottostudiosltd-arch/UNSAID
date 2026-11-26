import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { clearCampusAccess, getCampusAccess, getOrCreateSessionId } from "../lib/session";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function isLiveBackendEnabled(): boolean {
  return isSupabaseConfigured;
}

export async function invokeEdge<TResponse>(
  functionName: string,
  body: Record<string, unknown>,
  options: { requireCampusToken?: boolean } = {},
): Promise<TResponse> {
  if (!supabase) {
    throw new ApiError(
      "SUPABASE_NOT_CONFIGURED",
      "Supabase is not connected yet.",
      500,
    );
  }

  const headers: Record<string, string> = {
    "x-session-id": getOrCreateSessionId(),
  };

  if (options.requireCampusToken !== false) {
    const access = getCampusAccess();
    if (!access) {
      throw new ApiError("UNAUTHORIZED", "Please enter your college code first.", 401);
    }
    headers["x-college-token"] = access.token;
  }

  const { data, error } = await supabase.functions.invoke<TResponse>(functionName, {
    body,
    headers,
  });

  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      const status = context.status;
      try {
        const parsed = (await context.json()) as {
          error?: { code?: string; message?: string };
        };
        const code = parsed?.error?.code ?? "REQUEST_FAILED";
        const message = parsed?.error?.message ?? error.message;
        if (status === 401 && code === "UNAUTHORIZED") {
          clearCampusAccess();
        }
        throw new ApiError(code, message, status);
      } catch (err) {
        if (err instanceof ApiError) throw err;
      }
    }
    throw new ApiError("REQUEST_FAILED", error.message || "Request failed.", 500);
  }

  return data as TResponse;
}
