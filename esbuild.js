const esbuild = require("esbuild");

const production = process.argv.includes("--minify");
const watch = process.argv.includes("--watch");

/**
 * @type {import('esbuild').BuildOptions}
 */
const baseConfig = {
    bundle: true,
    minify: production,
    sourcemap: !production,
    format: "cjs",
    platform: "node",
    external: ["vscode"],
};

const extensionConfig = {
    ...baseConfig,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
};

const webviewConfig = {
    ...baseConfig,
    entryPoints: ["src/webview/main.ts"],
    outfile: "dist/webview.js",
    platform: "browser",
    format: "iife",
    external: [],
};

async function main() {
    const contexts = [
        await esbuild.context(extensionConfig),
        await esbuild.context(webviewConfig),
    ];
    if (watch) {
        for (const ctx of contexts) {
            await ctx.watch();
        }
    } else {
        for (const ctx of contexts) {
            await ctx.rebuild();
            await ctx.dispose();
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
