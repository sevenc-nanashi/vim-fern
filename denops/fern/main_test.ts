import { request } from "./main.ts";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("file operations", async () => {
  const root = await Deno.makeTempDir({ prefix: "fern-denops-" });
  try {
    const file = `${root}/file.txt`;
    const copied = `${root}/copied.txt`;
    const moved = `${root}/moved.txt`;

    await request({ operation: "mkfile", path: file });
    const entries = await request({ operation: "children", path: root });
    assert(
      Array.isArray(entries) && entries.some((entry) => entry.path === file),
      "created file is not listed",
    );

    await request({ operation: "copy", src: file, dst: copied });
    await request({ operation: "move", src: copied, dst: moved });
    await request({ operation: "remove", path: moved });

    let missing = false;
    try {
      await Deno.stat(moved);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        missing = true;
      } else {
        throw error;
      }
    }
    assert(missing, "moved file was not removed");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("run operation", async () => {
  const result = await request({
    operation: "run",
    args: [Deno.execPath(), "eval", "console.log('fern')"],
  });
  assert(
    typeof result === "object" && result !== null && "stdout" in result &&
      result.stdout === "fern\n",
    "run operation did not return stdout",
  );
});
