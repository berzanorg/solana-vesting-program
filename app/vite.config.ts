import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vite"
import { resolve } from "path"

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: [
			{
				find: "crypto",
				replacement: resolve(__dirname, "node_modules/crypto-browserify")
			},
			{
				find: "Buffer",
				replacement: "vite-compatible-readable-buffer"
			}
		]
	}
})
