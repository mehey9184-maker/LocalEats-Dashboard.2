import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      console.error("Diagnostic: No Authorization header provided.");
      return new Response(
        JSON.stringify({ error: "No Authorization header provided." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Diagnostic: Received token, length:", token.length);

    // Decode JWT payload (without verifying signature here, just for diagnostic)
    const payloadPart = token.split(".")[1];
    if (!payloadPart) {
      console.error("Diagnostic: Invalid JWT format.");
      return new Response(
        JSON.stringify({ error: "Invalid JWT format" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const decodedPayload = JSON.parse(atob(payloadPart));
    const now = Math.floor(Date.now() / 1000);
    
    console.log("Diagnostic: Auth State Decode:");
    console.log(`- Sub (User ID): ${decodedPayload.sub}`);
    console.log(`- Role: ${decodedPayload.role}`);
    console.log(`- Expiry (exp): ${decodedPayload.exp} (Current Time: ${now})`);
    console.log(`- Issued At (iat): ${decodedPayload.iat}`);
    console.log(`- Time to Expiry: ${decodedPayload.exp - now} seconds`);

    const isExpired = decodedPayload.exp < now;

    if (isExpired) {
      console.warn("Diagnostic: Token is EXPIRED.");
    } else {
      console.log("Diagnostic: Token is VALID regarding expiry.");
    }

    return new Response(
      JSON.stringify({ 
        message: "Auth token decoded successfully",
        decoded_state: {
          sub: decodedPayload.sub,
          role: decodedPayload.role,
          is_expired: isExpired,
          time_to_expiry_seconds: decodedPayload.exp - now
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Diagnostic: Internal Error during decoding", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
