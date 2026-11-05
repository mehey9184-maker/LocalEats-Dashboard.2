#!/usr/bin/env python3
"""Check that the reviewed fee patch guards the exact installed function source.

Static source only: no Supabase credentials, network, database access or writes.
"""
import hashlib
import re
from pathlib import Path

foundation = Path("supabase/drafts/pickup_launch_foundation.sql").read_text(encoding="utf8")
patch = Path("supabase/drafts/pickup_zero_fee.sql").read_text(encoding="utf8")

source = re.search(
    r"create function public\.pickup_create_order\([\s\S]+?as \$create\$([\s\S]*?)\$create\$",
    foundation,
)
expected = re.search(
    r"where oid = 'public\.pickup_create_order\(text,text,jsonb\)'::regprocedure\)"
    r" is distinct from '([0-9a-f]{64})'",
    patch,
)
if source is None or expected is None:
    raise SystemExit("PICKUP_REVIEW_DRAFT_MISSING_OR_CHANGED")

actual_hash = hashlib.sha256(source.group(1).encode("utf8")).hexdigest()
if actual_hash != expected.group(1):
    raise SystemExit("PICKUP_REVIEW_DRAFT_FUNCTION_HASH_DRIFT")
if patch.count("fee := 0;") != 1:
    raise SystemExit("PICKUP_ZERO_FEE_REVIEW_BODY_CHANGED")

print("PICKUP_REVIEW_SOURCE_HASH_VERIFIED")
