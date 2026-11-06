import { describe, expect, it } from "vitest"
import { classifyRunError } from "../src/core/failures.js"

describe("classifyRunError", () => {
  it("recognises a request-shape rejection", () => {
    expect(classifyRunError({ error: "Invalid discriminator value. Expected 'user' | 'assistant'" })).toBe("deterministic")
    expect(classifyRunError({ error: "invalid_request_error: messages[23].role" })).toBe("deterministic")
    expect(classifyRunError({ error: "unsupported parameter: tool_choice" })).toBe("deterministic")
  })

  it("recognises an outage", () => {
    expect(classifyRunError({ error: "502 Bad Gateway" })).toBe("outage")
    expect(classifyRunError({ error: "upstream connect error" })).toBe("outage")
  })

  it("recognises a rate limit", () => {
    expect(classifyRunError({ error: "429 Too Many Requests" })).toBe("rate_limit")
    expect(classifyRunError({ error: "rate limit exceeded" })).toBe("rate_limit")
  })

  it("treats auth and quota failures as other, not the member's fault for routing", () => {
    expect(classifyRunError({ error: "401 Unauthorized" })).toBe("other")
    expect(classifyRunError({ error: "insufficient credits" })).toBe("other")
  })

  it("defaults to other", () => {
    expect(classifyRunError({ error: "process exited with code 1" })).toBe("other")
    expect(classifyRunError({})).toBe("other")
  })
})
