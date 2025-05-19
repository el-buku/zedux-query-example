import { api, atom, injectAtomInstance } from "@zedux/react";

const invalidatorAtom = (atomKey: string, queryKey: string, tags: string[]) =>
  atom(
    `invalidator-${atomKey}-${queryKey}`,
    (_atomKey, _queryKey, _tags) => api(),
    {
      tags: [atomKey, queryKey, ...tags],
    },
  );

export const injectTagInvalidator = (
  key: string,
  queryKey: string,
  invalidateFn: () => void,
  tags?: string[],
) => {
  const tagsForAtom = tags || [];
  const invalidatorAtomInstance = injectAtomInstance(
    invalidatorAtom(key, queryKey, tagsForAtom),
    [key, queryKey, tagsForAtom],
  );
  invalidatorAtomInstance.on("invalidate", invalidateFn);
};
