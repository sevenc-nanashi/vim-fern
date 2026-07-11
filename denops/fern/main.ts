import type { Entrypoint } from "@denops/std";
import * as v from "valibot";

const Request = v.object({
  operation: v.picklist([
    "root",
    "parent",
    "children",
    "mkfile",
    "mkdir",
    "copy",
    "move",
    "remove",
    "run",
  ]),
  path: v.optional(v.string()),
  src: v.optional(v.string()),
  dst: v.optional(v.string()),
  args: v.optional(v.array(v.string())),
  cwd: v.optional(v.string()),
});

type Request = v.InferOutput<typeof Request>;

type Entry = {
  name: string;
  status: 0 | 1;
  hidden: 0 | 1;
  path: string;
};

function required(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function basename(path: string): string {
  const normalized = path.replace(/[\\/]$/, "");
  const index = Math.max(
    normalized.lastIndexOf("/"),
    normalized.lastIndexOf("\\"),
  );
  return index === -1 ? normalized : normalized.slice(index + 1);
}

function dirname(path: string): string {
  const normalized = path.replace(/[\\/]$/, "");
  const index = Math.max(
    normalized.lastIndexOf("/"),
    normalized.lastIndexOf("\\"),
  );
  if (index < 0) return normalized;
  if (index === 0) return normalized.slice(0, 1);
  if (index === 2 && normalized[1] === ":") return normalized.slice(0, 3);
  return normalized.slice(0, index);
}

function entry(path: string, info: Deno.FileInfo): Entry {
  const name = basename(path);
  return {
    name,
    status: info.isDirectory ? 1 : 0,
    hidden: name.startsWith(".") ? 1 : 0,
    path,
  };
}

async function getEntry(path: string): Promise<Entry> {
  return entry(path, await Deno.stat(path));
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

async function children(path: string): Promise<Entry[]> {
  const result: Entry[] = [];
  for await (const item of Deno.readDir(path)) {
    result.push(await getEntry(`${path.replace(/[\\/]$/, "")}/${item.name}`));
  }
  return result;
}

async function copy(src: string, dst: string): Promise<void> {
  const info = await Deno.stat(src);
  await Deno.mkdir(dirname(dst), { recursive: true });
  if (info.isDirectory) {
    await Deno.mkdir(dst, { recursive: true });
    for await (const item of Deno.readDir(src)) {
      await copy(`${src}/${item.name}`, `${dst}/${item.name}`);
    }
    return;
  }
  await Deno.copyFile(src, dst);
}

export async function request(input: unknown): Promise<unknown> {
  const request = v.parse(Request, input) as Request;
  switch (request.operation) {
    case "root":
      return await getEntry(required(request.path, "path"));
    case "parent": {
      const path = required(request.path, "path");
      if (path === "/" || /^[A-Za-z]:[\\/]?$/.test(path)) {
        throw new Error("no parent node exists for the root");
      }
      return await getEntry(dirname(path));
    }
    case "children":
      return await children(required(request.path, "path"));
    case "mkfile": {
      const path = required(request.path, "path");
      if (await exists(path)) {
        throw new Error(`'${path}' already exist`);
      }
      await Deno.mkdir(dirname(path), { recursive: true });
      await Deno.writeFile(path, new Uint8Array());
      return null;
    }
    case "mkdir": {
      const path = required(request.path, "path");
      if (await exists(path)) {
        throw new Error(`'${path}' already exist`);
      }
      await Deno.mkdir(path, { recursive: true });
      return null;
    }
    case "copy":
      await copy(required(request.src, "src"), required(request.dst, "dst"));
      return null;
    case "move":
      await Deno.mkdir(dirname(required(request.dst, "dst")), {
        recursive: true,
      });
      await Deno.rename(
        required(request.src, "src"),
        required(request.dst, "dst"),
      );
      return null;
    case "remove":
      await Deno.remove(required(request.path, "path"), { recursive: true });
      return null;
    case "run": {
      const args = request.args;
      if (args === undefined || args.length === 0) {
        throw new Error("args is required");
      }
      const command = new Deno.Command(args[0], {
        args: args.slice(1),
        cwd: request.cwd,
        stdout: "piped",
        stderr: "piped",
      });
      const output = await command.output();
      return {
        code: output.code,
        stdout: new TextDecoder().decode(output.stdout),
        stderr: new TextDecoder().decode(output.stderr),
      };
    }
  }
}

export const main: Entrypoint = (denops) => {
  denops.dispatcher = { request };
};
