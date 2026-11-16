import { describe, expect, it } from "vitest";
import { readSession, signSession } from "@/lib/auth/session";

describe("session tokens", () => {
  it("round-trips a user id and rejects tampering", () => {
    const token = signSession("user-1", 60);
    expect(readSession(token)).toBe("user-1");
    const [body] = token.split(".");
    expect(readSession(`${body}.forged`)).toBeNull();
    expect(readSession("not-a-token")).toBeNull();
  });
});
