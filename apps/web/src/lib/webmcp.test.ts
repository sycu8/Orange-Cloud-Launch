import { describe, expect, it } from "vitest";
import { webMcpTools } from "./webmcp";

describe("WebMCP tool definitions", () => {
  it("registers the public site actions", () => {
    expect(webMcpTools.map((tool) => tool.name)).toEqual([
      "describe_oclaunch",
      "jump_to_section",
      "open_discover",
      "start_project",
      "set_language",
    ]);
    for (const tool of webMcpTools) {
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema.type).toBe("object");
      expect(typeof tool.execute).toBe("function");
    }
  });
});