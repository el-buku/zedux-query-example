import { createEcosystem } from "@zedux/react";
export const createRootEcosystem = () => createEcosystem({
    id: "root",
    ssr: typeof window === "undefined",
});
