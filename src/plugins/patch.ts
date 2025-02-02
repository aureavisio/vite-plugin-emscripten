import { exists, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Logger, Plugin, ResolvedConfig } from "vite";

export type PluginPatchOptions = {
    /**
     * Add Electron support.
     *
     * @default false
     */
    addElectronSupport?: boolean;
    /**
     * Whether to disable inline wasm.
     *
     * @default false
     */
    disableWASMInline?: boolean;
    /**
     * Whether to enable worker inline.
     *
     * @default false
     */
    enableWorkerInline?: boolean;
};

export default (options: PluginPatchOptions = {}): Plugin => {
    const name = "vite-plugin-emscripten:patch";
    let config: ResolvedConfig;
    let logger: Logger;

    let buildFormat = "es";

    const patchElectron = (code: string): { code: string; error?: string } => {
        const findRegex = /var ENVIRONMENT_IS_NODE.*?;/g;
        const full = code.match(findRegex)?.[0];

        if (!full) {
            return { code: code, error: "Could not find ENVIRONMENT_IS_NODE" };
        }

        let update = full.replace(";", " && !ENVIRONMENT_IS_ELECTRON;");
        update = `var ENVIRONMENT_IS_ELECTRON = typeof process == "object" && navigator.userAgent.toLowerCase().includes('electron');\n${update}`;

        return { code: code.replace(full, update) };
    };

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

    const patchWorker = (code: string): { code: string; error?: string } => {
        const findRegex =
            /worker\s*=\s*new\s+Worker\s*\(\s*new\s+URL\s*\(\s*["'][^"']+["']\s*,\s*import\.meta\.url\s*\)[\s\S]*?\)/g;
        const full = code.match(findRegex)?.[0];

        if (!full) {
            return { code: code, error: "Could not find Worker" };
        }

        const findRegex2 =
            /new\s+URL\s*\(\s*["'][^"']+["']\s*,\s*import\.meta\.url\s*\)/g;
        const full2 = full.match(findRegex2)?.[0];

        if (!full2) {
            return { code: code, error: "Could not find new URL" };
        }

        const update1 = full.replace(full2, "workerUrl");
        const update = `const workerUrl = ${full2}\n${update1}`;

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
                let newCode = code;

                if (options.addElectronSupport) {
                    const { code, error } = patchElectron(newCode);

                    if (error) {
                        logger.error(
                            `[vite-plugin-emscripten:patcher] Electron Support: ${error}`,
                        );
                    }

                    newCode = code;
                }

                if (options.disableWASMInline) {
                    const { code, error } = patchWasm(newCode, "pre");

                    if (error) {
                        logger.error(
                            `[vite-plugin-emscripten:wasm] WASM Pre-patch failed: ${error}`,
                        );
                    }

                    newCode = code;
                }

                if (options.enableWorkerInline) {
                    const { code, error } = patchWorker(newCode);

                    if (error) {
                        logger.error(
                            `[vite-plugin-emscripten:worker] Worker Inline failed: ${error}`,
                        );
                    }

                    newCode = code;
                }

                return {
                    code: newCode,
                    map: null,
                };
            }
        },

        generateBundle(outputOptions, bundle) {
            buildFormat = outputOptions.format ?? "esm";

            for (const [fileName, asset] of Object.entries(bundle)) {
                if (
                    fileName.includes("dist-wasm/index.js") &&
                    asset.type === "chunk"
                ) {
                    if (options.addElectronSupport) {
                        const { code, error } = patchElectron(asset.code);

                        if (error) {
                            logger.error(
                                `[vite-plugin-emscripten:patcher] Electron Support: ${error}`,
                            );
                            continue;
                        }

                        asset.code = code;
                    }

                    if (options.disableWASMInline) {
                        const { code, error } = patchWasm(asset.code, "post");

                        if (error) {
                            logger.error(
                                `[vite-plugin-emscripten:wasm] WASM Post-patch failed: ${error}`,
                            );
                            continue;
                        }

                        asset.code = code;
                    }
                }
            }
        },

        async writeBundle() {
            const outputFile = resolve(
                config.build.outDir,
                `index.${buildFormat}.js`,
            );

            try {
                if (!(await exists(outputFile))) {
                    logger.error(
                        "[vite-plugin-emscripten:wasm] WASM Post-patch failed: File not found",
                    );
                    return;
                }

                const code = await readFile(outputFile, "utf-8");

                const { code: codePatchWasm, error: errorPatchWasm } =
                    patchWasm(code, "post");
                if (errorPatchWasm) {
                    logger.error(
                        `[vite-plugin-emscripten:wasm] WASM Post-patch failed: ${errorPatchWasm}`,
                    );
                    return;
                }

                await writeFile(outputFile, codePatchWasm, "utf-8");
            } catch (err) {
                logger.error(
                    `[vite-plugin-emscripten:wasm] WASM Post-patch failed: ${err}`,
                );
            }
        },
    };
};
