const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

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
    const distDir = path.join(__dirname, "dist");
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir);
    }

    const copyCss = () => {
        fs.copyFileSync(
            path.join(__dirname, "src/webview/style.css"),
            path.join(distDir, "style.css")
        );
        console.log("Copied style.css to dist");
    };

    copyCss();

    const contexts = [
        await esbuild.context(extensionConfig),
        await esbuild.context(webviewConfig),
    ];
    if (watch) {
        // Simple watch for CSS
        fs.watch(path.join(__dirname, "src/webview/style.css"), (eventType) => {
            if (eventType === 'change') {
                copyCss();
            }
        });

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
