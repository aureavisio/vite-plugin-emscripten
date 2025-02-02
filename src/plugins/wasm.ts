import { exists, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Logger, Plugin, ResolvedConfig } from "vite";

export type PluginWASMOptions = {
    /**
     * Whether to disable inline wasm.
     *
     * @default false
     */
    disableInline?: boolean;
};

export default (options: PluginWASMOptions = {}): Plugin => {
    const name = "vite-plugin-emscripten:wasm";
    let config: ResolvedConfig;
    let logger: Logger;

    let buildFormat = "es";

    const patchWasm = (
        code: string,
        type: "pre" | "post",
    ): { code: string; error?: string } => {
        const findRegex =
            /new\s+URL\s*\(\s*["']index\.wasm["'](?:\s*,\s*[^)]*)?\)/g;
        const full = code.match(findRegex)?.[0];

        if (!full) {
            return { code: code, error: "Could not find wasm" };
        }

        const update =
            type === "pre"
                ? `new URL("index.wasm")`
                : `new URL("index.wasm", import.meta.url)`;

        return { code: code.replace(full, update) };
    };

    return {
        name,
        enforce: "pre",

        configResolved(resolvedConfig) {
            config = resolvedConfig;
            logger = resolvedConfig.logger;
        },

        transform(code, id) {
            if (id.includes("dist-wasm/index.js")) {
                if (options.disableInline) {
                    const { code: newCode, error } = patchWasm(code, "pre");

                    if (error) {
                        logger.error(
                            `[vite-plugin-emscripten:wasm] Pre-patch failed: ${error}`,
                        );
                    }

                    return {
                        code: newCode,
                        map: null,
                    };
                }
            }
        },

        generateBundle(outputOptions, _) {
            buildFormat = outputOptions.format ?? "esm";
        },

        async writeBundle() {
            const outputFile = resolve(
                config.build.outDir,
                `index.${buildFormat}.js`,
            );

            try {
                if (!(await exists(outputFile))) {
                    logger.error(
                        "[vite-plugin-emscripten:wasm] Post-patch failed: File not found",
                    );
                    return;
                }

                const code = await readFile(outputFile, "utf-8");

                const { code: codePatchWasm, error: errorPatchWasm } =
                    patchWasm(code, "post");
                if (errorPatchWasm) {
                    logger.error(
                        `[vite-plugin-emscripten:wasm] Post-patch failed: ${errorPatchWasm}`,
                    );
                    return;
                }

                await writeFile(outputFile, codePatchWasm, "utf-8");
            } catch (err) {
                logger.error(
                    `[vite-plugin-emscripten:wasm] Post-patch failed: ${err}`,
                );
            }
        },
    };
};
