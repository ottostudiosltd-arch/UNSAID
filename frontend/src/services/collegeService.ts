import { clearCampusAccess, setCampusAccess } from "../lib/session";
import type { CollegeInfo } from "../types/confession";
import { demoVerifyCollege } from "./demoStore";
import { invokeEdge, isLiveBackendEnabled } from "./edgeApi";

interface VerifyCollegeResponse {
  token: string;
  expiresAt: string;
  college: CollegeInfo;
}

export async function verifyCollegeCode(code: string): Promise<CollegeInfo> {
  if (!isLiveBackendEnabled()) {
    const res = demoVerifyCollege(code);
    return res.college;
  }

  const data = await invokeEdge<VerifyCollegeResponse>(
    "verify-college",
    { code },
    { requireCampusToken: false },
  );

  setCampusAccess({
    token: data.token,
    expiresAt: data.expiresAt,
    college: data.college,
  });

  return data.college;
}

export function leaveCampus(): void {
  clearCampusAccess();
}
