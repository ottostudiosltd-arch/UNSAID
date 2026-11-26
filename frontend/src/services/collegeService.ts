import { OFFICIAL_COLLEGES, type OfficialCollege } from "../data/colleges";
import { clearCampusAccess, setCampusAccess } from "../lib/session";
import type { CollegeInfo } from "../types/confession";
import {
  demoListColleges,
  demoRegisterCollege,
  demoVerifyCollege,
} from "./demoStore";
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

export async function fetchCollegesList(): Promise<OfficialCollege[]> {
  if (!isLiveBackendEnabled()) {
    return demoListColleges();
  }

  try {
    const res = await invokeEdge<{ colleges: OfficialCollege[] }>(
      "verify-college",
      { action: "list" },
      { requireCampusToken: false },
    );
    if (Array.isArray(res.colleges) && res.colleges.length > 0) {
      return res.colleges;
    }
  } catch {
    // Fall back gracefully to bundled verified college directory
  }
  return OFFICIAL_COLLEGES;
}

export async function registerCollege(
  name: string,
  code: string,
): Promise<CollegeInfo> {
  if (!isLiveBackendEnabled()) {
    return demoRegisterCollege(name, code).college;
  }

  const data = await invokeEdge<VerifyCodeResponse>(
    "verify-college",
    { action: "register", name, code },
    { requireCampusToken: false },
  );

  if (!("college" in data)) {
    throw new Error("Could not register college.");
  }

  setCampusAccess({
    token: data.token,
    expiresAt: data.expiresAt,
    college: data.college,
  });

  return data.college;
}

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
