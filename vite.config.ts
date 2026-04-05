import { defineConfig } from "vitest/config";

export default defineConfig({
    base: "/hallucinationwars/",
    server: {
        open: true,
    },
    test: {
        environment: "jsdom",
    },
});
