import { defineConfig } from "vitest/config";

export default defineConfig({
    base: "/hallucinationwars/",
    server: {
        open: true,
        allowedHosts: true,
    },
    test: {
        environment: "jsdom",
    },
});
