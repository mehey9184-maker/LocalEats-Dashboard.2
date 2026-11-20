// L3-N7B5I: deliberately inert Firebase stand-in for read-only Home browser.
// Rendering Home never creates or updates menu data. All attempted mutations
// throw, and this module creates no Firebase app, network, or credentials.
export {auth,setFixtureUid} from "../l3-n6/fixture-auth";
export const createFirestoreMenuItem=async()=>{
 throw Error("Synthetic Home must never create a menu item");
};
export const updateFirestoreMenuItem=async()=>{
 throw Error("Synthetic Home must never update a menu item");
};
