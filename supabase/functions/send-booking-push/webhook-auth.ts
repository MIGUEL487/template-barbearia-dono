/** Rotation is opt-in. PRIMARY remains intact while emitters migrate to NEXT.
 * Promote NEXT to PRIMARY and remove NEXT only after both real paths pass.
 * A timer must not revoke a credential already used by a migrated emitter. */
export async function webhookAuthorization(
  actual: string,
  primary: string | undefined,
  next: string | undefined,
) {
  const configured = !!primary && primary.length >= 32;
  const nextActive = configured && !!next && next.length >= 32;
  if (!configured || !actual || actual.length > 4096)
    return {
      configured,
      authorized: false,
      credential: "none" as const,
      nextActive,
    };
  const digest = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  const [provided, a, b] = await Promise.all([
    digest(actual),
    digest(primary!),
    digest(nextActive ? next! : ""),
  ]);
  const equal = (x: Uint8Array) => {
    let mismatch = 0;
    for (let i = 0; i < provided.length; i++) mismatch |= provided[i] ^ x[i];
    return mismatch === 0;
  };
  const primaryMatches = equal(a),
    nextMatches = equal(b) && nextActive;
  return {
    configured,
    authorized: primaryMatches || nextMatches,
    credential: primaryMatches
      ? ("primary" as const)
      : nextMatches
        ? ("next" as const)
        : ("none" as const),
    nextActive,
  };
}
