import type { Plugin } from "vite";
import pluginDTS, {
    type PluginOptions as PluginDTSOptions,
} from "vite-plugin-dts";
import {
    type ViteStaticCopyOptions as PluginCopyOptions,
    viteStaticCopy as pluginCopy,
} from "vite-plugin-static-copy";
import pluginHMR, { type PluginHMROptions } from "./plugins/hmr";
import pluginMinify, { type PluginMinifyOptions } from "./plugins/minify";
import pluginPatch, { type PluginPatchOptions } from "./plugins/patch";
import pluginWASM, { type PluginWASMOptions } from "./plugins/wasm";

export type {
    PluginDTSOptions,
    PluginCopyOptions,
    PluginHMROptions,
    PluginMinifyOptions,
    PluginPatchOptions,
    // PluginServerOptions,
};

export type PluginEmscripten = {
    /**
     * Copy options.
     */
    copy?: PluginCopyOptions;
    /**
     * DTS options.
     */
    dts?: PluginDTSOptions;
    /**
     * HMR options.
     */
    hmr?: PluginHMROptions;
    /**
     * Minify options.
     */
    minify?: PluginMinifyOptions;
    /**
     * Patch options.
     */
    patch?: PluginPatchOptions;
    /**
     * WASM options.
     */
    wasm?: PluginWASMOptions;
};

export default (config: PluginEmscripten = {}): Plugin[] => {
    const plugins: Plugin[] = [];

    if (config.copy) {
        plugins.push(...pluginCopy(config.copy));
    }

    if (config.dts) {
        plugins.push(pluginDTS(config.dts));
    }

    if (config.hmr) {
        plugins.push(pluginHMR(config.hmr));
    }

    if (config.minify) {
        plugins.push(pluginMinify(config.minify));
    }

    if (config.patch) {
        plugins.push(pluginPatch(config.patch));
    }

    if (config.wasm) {
        plugins.push(pluginWASM(config.wasm));
    }

    return [
        {
            name: "vite-plugin-emscripten",
        },
        ...plugins,
    ];
};
