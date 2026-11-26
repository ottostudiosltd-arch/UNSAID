import { clearCampusAccess, setCampusAccess } from "../lib/session";
import type { CollegeInfo } from "../types/confession";
import { demoVerifyCollege } from "./demoStore";
import { invokeEdge, isLiveBackendEnabled } from "./edgeApi";

type VerifyCodeResponse =
  | { mode: "admin_gate" }
  | {
      mode?: "college";
      token: string;
      expiresAt: string;
      college: CollegeInfo;
    };

export type VerifyCodeResult =
  | { kind: "admin_gate" }
  | { kind: "college"; college: CollegeInfo };

export async function verifyCollegeCode(code: string): Promise<VerifyCodeResult> {
  if (!isLiveBackendEnabled()) {
    const res = demoVerifyCollege(code);
    return { kind: "college", college: res.college };
  }

  const data = await invokeEdge<VerifyCodeResponse>(
    "verify-college",
    { code },
    { requireCampusToken: false },
  );

  if (data.mode === "admin_gate") {
    return { kind: "admin_gate" };
  }

  setCampusAccess({
    token: data.token,
    expiresAt: data.expiresAt,
    college: data.college,
  });

  return { kind: "college", college: data.college };
}

export function leaveCampus(): void {
  clearCampusAccess();
}
