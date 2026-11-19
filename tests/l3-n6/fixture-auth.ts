// L3-N6 LOCAL BROWSER FIXTURE ONLY: never import in the shipped application.
// Replaces Firebase module solely when esbuild bundles tests/l3-n6/fixture-entry.tsx.
export const auth:{currentUser:{uid:string}|null}={currentUser:{uid:"merchant-a"}};
export function setFixtureUid(uid:string|null){
  auth.currentUser=uid?{uid}:null;
}
