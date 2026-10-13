import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { checkOwnPasswordReset, requestOwnPasswordReset } from "@/lib/passwordResets";
import { setSessionCookie } from "@/lib/auth/session";

/** "Forgot current password": a signed-in person asks administrators for a reset. A repeat call returns the open request. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.mustChangePassword) return NextResponse.json({ error: "Password change required" }, { status: 403 });

  try {
    return NextResponse.json(await requestOwnPasswordReset(user.id));
  } catch (error) {
    console.error("POST /api/account/reset-request failed", error);
    return NextResponse.json({ error: "Could not send the request" }, { status: 500 });
  }
}

/**
 * Status of the person's own request. Polled while the Security tab waits. When the administrator hasn't answered in
 * time, this call issues the temporary password and returns it once; the session cookie is refreshed (the password
 * change signs out other devices) so this browser stays signed in to set a new password.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const state = await checkOwnPasswordReset(user.id);
    if (state.state === "issued") {
      await setSessionCookie(user.id, state.sessionVersion);
      return NextResponse.json({ state: "issued", temporaryPassword: state.temporaryPassword });
    }
    return NextResponse.json(state);
  } catch (error) {
    console.error("GET /api/account/reset-request failed", error);
    return NextResponse.json({ error: "Could not check the request" }, { status: 500 });
  }
}
