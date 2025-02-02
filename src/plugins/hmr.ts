import { exec } from "node:child_process";
import { promisify } from "node:util";
import { debounce } from "lodash-es";
import pc from "picocolors";
import type { Logger, Plugin } from "vite";

const execAsync = promisify(exec);

export type PluginHMROptions = {
    /**
     * Directories to watch.
     *
     * @default ["src-wasm", "src-wasm-assets"]
     */
    watchDirs?: string[];
    /**
     * File extensions to ignore.
     *
     * @default [".o"]
     */
    ignoreExts?: string[];
    /**
     * Debounce delay in milliseconds.
     *
     * @default 300
     */
    debounceDelay?: number;
};

export default (
    options: PluginHMROptions = {
        watchDirs: ["src-wasm", "src-wasm-assets"],
        ignoreExts: [".o"],
        debounceDelay: 300,
    },
): Plugin => {
    const name = "vite-plugin-emscripten:hmr";
    let logger: Logger;

    let isBuilding = false;

    const runCommand = async (command: string): Promise<{ error?: string }> => {
        try {
            await execAsync(command);

            return {};
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
            };
        }
    };

    const rebuild = debounce(async (file: string) => {
        if (options.watchDirs?.some((dir) => file.includes(dir))) {
            if (
                isBuilding ||
                options.ignoreExts?.some((ext) => file.endsWith(ext))
            ) {
                return;
            }

            isBuilding = true;

            logger.info(pc.cyan(`[${name}] `) + pc.green("Rebuilding..."));

            const { error } = await runCommand("bun build:wasm");

            if (error) {
                logger.error(pc.cyan(`[${name}] `) + pc.red(error));
            }

            isBuilding = false;
        }
    }, options.debounceDelay);

    return {
        name,
        enforce: "post",
        apply: "serve",

        configResolved(resolvedConfig) {
            logger = resolvedConfig.logger;
        },

        async handleHotUpdate({ file }) {
            rebuild(file);
        },
    };
};
