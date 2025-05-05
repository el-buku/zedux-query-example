import { createEcosystem } from "@zedux/react";
export const rootEcosystem = createEcosystem({
    id: "root",
    ssr: typeof window === "undefined",
});
