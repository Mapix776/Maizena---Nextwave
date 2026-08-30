import {
  CommandExitError,
  FileType,
  Sandbox,
  type CommandResult as E2BCommandResult,
  type SandboxOpts,
} from 'e2b';

import type {
  AuthoringCommand,
  AuthoringSandbox,
  CommandResult,
  SandboxCreatePolicy,
} from './authoring-runner.js';

const COMMANDS: Record<AuthoringCommand, string> = {
  'validate-source': 'npm run validate:source',
  build: 'npm run build',
  'validate-browser': 'npm run validate:browser',
  'assert-no-network': 'npm run validate:network',
};

interface E2BEntryLike {
  path: string;
  type?: FileType | 'file' | 'dir' | 'symlink';
  symlinkTarget?: string;
}

interface E2BSandboxLike {
  files: {
    list(path: string, options?: { depth?: number }): Promise<E2BEntryLike[]>;
    read(path: string, options: { format: 'bytes' }): Promise<Uint8Array>;
    write(path: string, contents: ArrayBuffer): Promise<unknown>;
  };
  commands: {
    run(
      command: string,
      options: { cwd: string; timeoutMs: number },
    ): Promise<E2BCommandResult>;
  };
  kill(): Promise<boolean>;
}

export interface E2BSandboxFactoryOptions {
  template?: string;
  create?: (
    template: string,
    options: SandboxOpts,
  ) => Promise<E2BSandboxLike>;
}

class E2BAuthoringSandbox implements AuthoringSandbox {
  constructor(private readonly sandbox: E2BSandboxLike) {}

  async listFiles(root: string) {
    const entries = await this.sandbox.files.list(root, { depth: 8 });
    const files: string[] = [];

    for (const entry of entries) {
      const entryType = entry.type ? String(entry.type) : undefined;
      if (entryType === FileType.SYMLINK) {
        throw new Error(
          `Symlink is not exportable: ${entry.path} -> ${entry.symlinkTarget ?? 'unknown'}`,
        );
      }
      if (entryType === FileType.DIR) continue;
      if (entryType !== FileType.FILE) {
        throw new Error(`Unsupported filesystem entry: ${entry.path}`);
      }
      files.push(entry.path);
    }

    return files.sort();
  }

  readFile(path: string) {
    return this.sandbox.files.read(path, { format: 'bytes' });
  }

  async writeFile(path: string, contents: Uint8Array) {
    const copy = Uint8Array.from(contents);
    await this.sandbox.files.write(path, copy.buffer);
  }

  async run(command: AuthoringCommand): Promise<CommandResult> {
    try {
      return await this.sandbox.commands.run(COMMANDS[command], {
        cwd: '/workspace/report',
        timeoutMs: 90_000,
      });
    } catch (error) {
      if (error instanceof CommandExitError) {
        return {
          exitCode: error.exitCode,
          stdout: error.stdout,
          stderr: error.stderr || error.error || '',
        };
      }
      throw error;
    }
  }

  async kill() {
    await this.sandbox.kill();
  }
}

export function createE2BSandboxFactory(
  options: E2BSandboxFactoryOptions = {},
) {
  const template = options.template ?? process.env.E2B_REPORT_TEMPLATE ?? 'nauta-report-builder-v1';
  const create =
    options.create ??
    (async (templateName: string, sandboxOptions: SandboxOpts) =>
      Sandbox.create(templateName, sandboxOptions));

  return async (policy: SandboxCreatePolicy): Promise<AuthoringSandbox> => {
    const sandbox = await create(template, {
      allowInternetAccess: policy.allowInternetAccess,
      envs: {},
      lifecycle: { autoResume: false, onTimeout: 'kill' },
      metadata: {
        jobId: policy.jobId,
        purpose: 'nauta-report-authoring',
      },
      secure: true,
      timeoutMs: 180_000,
    });

    return new E2BAuthoringSandbox(sandbox);
  };
}
