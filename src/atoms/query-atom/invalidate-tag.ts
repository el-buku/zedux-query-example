import { AnyAtomInstance, getDefaultEcosystem } from "@zedux/react";

export function invalidateTag(tagOrTags: string | string[]): void {
  const ecosystem = getDefaultEcosystem();
  const tagsToSearch = Array.isArray(tagOrTags) ? tagOrTags : [tagOrTags];
  const matchingNodes = ecosystem.findAll("@atom").filter((node) => {
    // TODO rely on findAll(tags) when fix PR drops
    // https://github.com/Omnistac/zedux/pull/254/files
    return tagsToSearch.some((tag) => node.template?.tags?.includes(tag));
  });
  console.log("atoms to invalidate", matchingNodes.length);
  ecosystem.batch(() => {
    matchingNodes.forEach((node) => {
      (node as AnyAtomInstance).invalidate();
    });
  });
}
