import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";
import { type MinifyOptions, minify as tMinify } from "terser";
import type { Logger, Plugin, ResolvedConfig } from "vite";

export type PluginMinifyOptions = MinifyOptions;

export default (options: PluginMinifyOptions = {}): Plugin => {
    const name = "vite-plugin-emscripten:minify";
    let config: ResolvedConfig;
    let logger: Logger;

    return {
        name,
        enforce: "post",
        apply: "build",

        configResolved(resolvedConfig) {
            config = resolvedConfig;
            logger = resolvedConfig.logger;
        },

        async closeBundle() {
            const dist = config.build.outDir;
            const files = await readdir(dist, { recursive: true });
            const jsFiles = files.filter((file) => file.endsWith(".js"));

            for (const file of jsFiles) {
                const path = join(dist, file);

                try {
                    const code = await readFile(path, "utf8");
                    const result = await tMinify(code, options);

                    if (!result.code) {
                        throw new Error(`Failed to minify <${file}>`);
                    }

                    await writeFile(path, result.code, "utf8");

                    logger.info(
                        pc.cyan(`[${name}] `) + pc.green(`Minified: ${file}`),
                    );
                } catch (error) {
                    logger.error(
                        `[${name}] ${error instanceof Error ? error.message : error}`,
                    );
                }
            }
        },
    };
};
