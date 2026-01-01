const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const http = require("http");

const production = process.argv.includes("--minify");
const watch = process.argv.includes("--watch");
const platform = process.argv.includes("--platform=web") ? "web" : "vscode";

/**
 * @type {import('esbuild').BuildOptions}
 */
const baseConfig = {
    bundle: true,
    minify: production,
    sourcemap: !production,
};

const extensionConfig = {
    ...baseConfig,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    format: "cjs",
    platform: "node",
    external: ["vscode"],
};

const webviewConfig = {
    ...baseConfig,
    entryPoints: ["src/webview/main.ts"],
    outfile: "dist/webview.js",
    platform: "browser",
    format: "iife",
    external: [],
};

const webConfig = {
    ...baseConfig,
    entryPoints: ["src/webview/web-main.ts"],
    outfile: "src/webview/web.js",
    platform: "browser",
    format: "iife",
    external: [],
};

function serveHttp(dir, port) {
    http.createServer((req, res) => {
        const filePath = path.join(dir, req.url === "/" ? "index.html" : req.url);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end(JSON.stringify(err));
                return;
            }
            res.writeHead(200);
            res.end(data);
        });
    }).listen(port);

    console.log(`Watching on http://localhost:${port}`);
}


async function main() {
    if (platform === "web") {
        const ctx = await esbuild.context(webConfig);
        if (watch) {
            await ctx.watch();
            serveHttp("src/webview", 8000);
        } else {
            await ctx.rebuild();
            await ctx.dispose();
        }
        return;
    }

    // VSCode platform build
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
