/**
 * CF2 staging-only PostgREST adapter. SOURCE / SYNTHETIC-TEST ONLY.
 * NEVER import or instantiate from the default exported CF1 Worker.
 *
 * The view has security_invoker=true and its existing SQL draft grants SELECT
 * to service_role only; permissions for a future isolated project must be
 * reviewed separately. Neither a live Supabase URL nor any key is stored here.
 * Explicit fetchImpl injection is mandatory (no implicit global fetch).
 */
const SHOP_FIELDS = Object.freeze([
  "approval_status", "archived_at", "effective_is_active", "availability_revision",
  "availability_override_until", "id", "name", "description", "location",
  "category", "logo_url", "rating", "opening_time", "closing_time", "is_active",
  "latitude", "longitude", "lat", "lng", "story"
]);
const MENU_FIELDS = Object.freeze([
  "id", "shop_id", "name", "price", "description", "image_url", "category",
  "is_available", "popularity_score", "customizations", "created_at"
]);
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_SHOPS = 200;
const MAX_MENU = 400;
const MAX_RESPONSE_BYTES = 196608;

function failure() {
  // Do not propagate HTTP payload, connection details or credentials.
  return new Error("CF2_STAGING_READ_UNAVAILABLE");
}

function validateId(value) {
  if (typeof value !== "string" || !ID.test(value)) throw failure();
  return value;
}

function assertRowShape(rows, maxRows) {
  if (!Array.isArray(rows) || rows.length > maxRows ||
      rows.some(row => !row || Array.isArray(row) || typeof row !== "object")) {
    throw failure();
  }
  return rows;
}

/**
 * Interface for an isolated, read-only database reader.
 * read(query) => Array<object>; no live implementation is ever installed
 * in the production Worker by this code.
 */
export function createStagingCatalogRepository(read) {
  if (typeof read !== "function") throw failure();

  async function query(table, select, filters, maxRows) {
    const rows = await read(Object.freeze({
      method: "GET",
      table,
      select: select.join(","),
      filters: Object.freeze(filters.map(item => Object.freeze({...item}))),
      maxRows,
      limit: maxRows + 1,
      order: "id.asc",
      exactCount: true
    }));
    return assertRowShape(rows, maxRows);
  }

  function authoritativeShop(row) {
    if (row.approval_status !== "approved" || row.archived_at !== null)
      throw failure();
    if (typeof row.id !== "string" || !ID.test(row.id) ||
        typeof row.effective_is_active !== "boolean" ||
        typeof row.is_active !== "boolean" ||
        row.availability_revision == null ||
        !Number.isSafeInteger(Number(row.availability_revision))) throw failure();
    return row;
  }

  return Object.freeze({
    async getApprovedShops() {
      const rows = await query("shops_with_availability", SHOP_FIELDS, [
        {field:"approval_status", operator:"eq", value:"approved"},
        {field:"archived_at", operator:"is", value:"null"}
      ], MAX_SHOPS);
      return rows.map(authoritativeShop);
    },
    async getApprovedShopById(id) {
      const shopId=validateId(id);
      const rows = await query("shops_with_availability", SHOP_FIELDS, [
        {field:"id", operator:"eq", value:shopId},
        {field:"approval_status", operator:"eq", value:"approved"},
        {field:"archived_at", operator:"is", value:"null"}
      ], 1);
      if (rows.length > 1) throw failure();
      if (!rows.length) return null;
      const row=authoritativeShop(rows[0]);
      if (row.id!==shopId) throw failure();
      return row;
    },
    async getMenuByShopId(id) {
      const shopId=validateId(id);
      const rows = await query("menu_items", MENU_FIELDS, [
        {field:"shop_id", operator:"eq", value:shopId}
      ], MAX_MENU);
      for (const row of rows) {
        // Cross-shop leakage is a complete-read failure, never an item skip.
        if (String(row.shop_id)!==shopId) throw failure();
      }
      return rows;
    }
  });
}

/**
 * Optional PostgREST HTTP transport for an approved, ISOLATED staging project.
 * Not referenced by the live Worker. Tests must inject a synthetic fetchImpl.
 * Credential is server-only, never a VITE_* variable or committed source.
 */
export function createStagingPostgrestReader({
  endpoint, expectedProjectRef, apiKey, fetchImpl, maxBytes=MAX_RESPONSE_BYTES
}) {
  if (typeof fetchImpl !== "function" || typeof apiKey !== "string" ||
      apiKey.length < 8 || typeof expectedProjectRef !== "string" ||
      !/^[a-z0-9]{12,32}$/.test(expectedProjectRef) ||
      typeof endpoint !== "string") throw failure();
  let root;
  try { root = new URL(endpoint); }
  catch { throw failure(); }
  if (root.origin !== endpoint || root.protocol !== "https:" ||
      root.hostname !== expectedProjectRef + ".supabase.co" ||
      root.port || root.username || root.password) throw failure();
  if (!Number.isSafeInteger(maxBytes) || maxBytes<1024 || maxBytes>MAX_RESPONSE_BYTES)
    throw failure();

  const acceptedTables = new Set(["shops_with_availability", "menu_items"]);
  const allowColumns = {
    shops_with_availability: SHOP_FIELDS,
    menu_items: MENU_FIELDS
  };

  async function readBodyBounded(response) {
    if (!response.body || typeof response.body.getReader !== "function")
      throw failure();
    const reader=response.body.getReader();
    const chunks=[];
    let totalBytes=0;
    try {
      while (true) {
        const chunk=await reader.read();
        if (chunk.done) break;
        totalBytes+=chunk.value.byteLength;
        if (totalBytes>maxBytes) throw failure();
        chunks.push(chunk.value);
      }
    } finally {
      try { await reader.cancel(); } catch { /* response already ended */ }
    }
    const bytes=new Uint8Array(totalBytes);
    let at=0;
    for(const chunk of chunks){ bytes.set(chunk,at);at+=chunk.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)); }
    catch { throw failure(); }
  }

  return async function stagedRead(query) {
    if (!query || query.method!=="GET" ||
        !acceptedTables.has(query.table) ||
        query.select!==allowColumns[query.table].join(",") ||
        query.exactCount!==true || query.order!=="id.asc" ||
        !Number.isInteger(query.limit) ||
        query.limit<1 || query.limit>MAX_MENU+1 ||
        query.limit!==query.maxRows+1 ||
        !Array.isArray(query.filters)) throw failure();

    const expectedFilters = query.table==="menu_items"
      ? ["shop_id:eq"]
      : query.maxRows===1
        ? ["id:eq","approval_status:eq","archived_at:is"]
        : ["approval_status:eq","archived_at:is"];
    if (query.filters.length!==expectedFilters.length ||
        query.filters.some((f,i)=> !f || f.field+":"+f.operator!==expectedFilters[i] ||
          typeof f.value!=="string" ||
          ((f.field==="id"||f.field==="shop_id")&&!ID.test(f.value)) ||
          (f.field==="approval_status"&&f.value!=="approved") ||
          (f.field==="archived_at"&&f.value!=="null"))) throw failure();

    const url=new URL("/rest/v1/"+query.table,root);
    url.searchParams.set("select",query.select);
    for (const item of query.filters)
      url.searchParams.set(item.field,item.operator+"."+item.value);
    url.searchParams.set("order",query.order);
    url.searchParams.set("limit",String(query.limit));

    let response;
    try {
      response=await fetchImpl(url.href,{
        method:"GET",
        redirect:"manual",
        cache:"no-store",
        signal:AbortSignal.timeout(8000),
        headers:{
          Accept:"application/json",
          apikey:apiKey,
          Prefer:"count=exact"
        }
      });
    } catch { throw failure(); }
    if (!response || ![200,206].includes(response.status)) throw failure();
    // A missing/unknown count could silently hide additional shops or prices.
    const range=response.headers?.get?.("content-range");
    const count=range?.match(/^(?:\*|0|[0-9]+-[0-9]+)\/([0-9]+)$/);
    if (!count) throw failure();
    const exactCount=Number(count[1]);
    if (!Number.isSafeInteger(exactCount) || exactCount>query.maxRows)
      throw failure();
    const rows=await readBodyBounded(response);
    if (!Array.isArray(rows) || rows.length!==exactCount ||
        rows.length>query.maxRows) throw failure();
    return rows;
  };
}
