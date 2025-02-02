import type { Logger, Plugin, ResolvedConfig } from "vite";

export type PluginPatchOptions = {
    /**
     * Add Electron support.
     *
     * @default false
     */
    addElectronSupport?: boolean;
};

export default (options: PluginPatchOptions = {}): Plugin => {
    const name = "vite-plugin-emscripten:patch";
    let config: ResolvedConfig;
    let logger: Logger;

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

    return {
        name,
        enforce: "pre",

        configResolved(resolvedConfig) {
            config = resolvedConfig;
            logger = resolvedConfig.logger;
        },

        transform(code, id) {
            if (id.includes("dist-wasm/index.js")) {
                if (options.addElectronSupport) {
                    const { code: newCode, error } = patchElectron(code);

                    if (error) {
                        logger.error(
                            `[vite-plugin-emscripten:patcher] Electron Support: ${error}`,
                        );
                    }

                    return {
                        code: newCode,
                        map: null,
                    };
                }
            }
        },

        generateBundle(_, bundle) {
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
                }
            }
        },
    };
};
