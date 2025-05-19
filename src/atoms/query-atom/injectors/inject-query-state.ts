import { injectMachineStore } from "@zedux/machines";
export const injectQueryState = () => {
  const store = injectMachineStore((state) => [
    // the first state is the initial state ('idle' here):
    state("idle").on("request", "fetching"),
    state("fetching")
      .on("fetchSuccessful", "success")
      .on("fetchFailed", "error"),
    // Change: invalidate goes to idle
    state("success").on("invalidate", "idle"),
    // Change: Add invalidate transition, retry stays
    state("error")
      .on("retry", "fetching")
      .on("invalidate", "idle"),
  ]);

  return store;
};
