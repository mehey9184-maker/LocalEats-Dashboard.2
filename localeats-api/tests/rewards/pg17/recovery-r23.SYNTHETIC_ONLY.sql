-- R2.3 SYNTHETIC ONLY. Extension for disposable PostgreSQL 17 test container.
-- NOT a Supabase migration. No live customer, admin, merchant or bank account is touched.
BEGIN;

-- An actual trusted API would load verified refund events from the original
-- paid+collected pickup order; this lab receives synthetic verified facts.
CREATE TABLE reward_lab.refund_events (
  refund_id text PRIMARY KEY,
  refund_reference text NOT NULL UNIQUE,
  order_id text NOT NULL,
  line_id text NOT NULL,
  customer_id text NOT NULL REFERENCES reward_lab.progress(customer_id),
  units integer NOT NULL CHECK (units > 0),
  reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(order_id,line_id) REFERENCES reward_lab.credited_lines(order_id,line_id)
);
CREATE TABLE reward_lab.customer_holds (
  customer_id text PRIMARY KEY REFERENCES reward_lab.progress(customer_id),
  original_refund_id text NOT NULL REFERENCES reward_lab.refund_events(refund_id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reward_lab.cancelled_reward_attempts (
  attempt_id text PRIMARY KEY,
  grant_id text NOT NULL REFERENCES reward_lab.grants(grant_id),
  customer_id text NOT NULL REFERENCES reward_lab.progress(customer_id),
  reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reward_lab.transfer_reference_corrections (
  correction_id text PRIMARY KEY,
  transfer_id text NOT NULL UNIQUE REFERENCES reward_lab.transfers(transfer_id),
  admin_id text NOT NULL,
  new_bank_reference text NOT NULL,
  reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reward_lab.dispute_resolutions (
  resolution_id text PRIMARY KEY,
  payable_id text NOT NULL UNIQUE REFERENCES reward_lab.payables(payable_id),
  admin_id text NOT NULL,
  summary text NOT NULL CHECK(length(summary) BETWEEN 5 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reward_lab.dispute_merchant_acks (
  ack_id text PRIMARY KEY,
  resolution_id text NOT NULL UNIQUE REFERENCES reward_lab.dispute_resolutions(resolution_id),
  verified_shop_id text NOT NULL REFERENCES reward_lab.shops(shop_id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Existing audit trigger also forbids UPDATE and DELETE in recovery event tables.
CREATE TRIGGER immutable_refunds BEFORE UPDATE OR DELETE ON reward_lab.refund_events
  FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_audit_change();
CREATE TRIGGER immutable_cancellations BEFORE UPDATE OR DELETE ON reward_lab.cancelled_reward_attempts
  FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_audit_change();
CREATE TRIGGER immutable_transfer_corrections BEFORE UPDATE OR DELETE ON reward_lab.transfer_reference_corrections
  FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_audit_change();
CREATE TRIGGER immutable_dispute_resolutions BEFORE UPDATE OR DELETE ON reward_lab.dispute_resolutions
  FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_audit_change();
CREATE TRIGGER immutable_resolution_acks BEFORE UPDATE OR DELETE ON reward_lab.dispute_merchant_acks
  FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_audit_change();

-- Any refunded credited order-line places the customer on a reversible
-- REVIEW HOLD: their rank and existing reward promises are NOT erased.
-- Existing earned rewards retain their reserved budget until owner review.
-- A held customer cannot earn additional units or collect an unfulfilled reward.
CREATE FUNCTION reward_lab.reject_held_credit() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM reward_lab.customer_holds WHERE customer_id=NEW.customer_id)
  THEN RAISE EXCEPTION 'CUSTOMER_REWARDS_ON_REFUND_HOLD'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER block_held_credits BEFORE INSERT ON reward_lab.credited_lines
  FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_held_credit();

CREATE FUNCTION reward_lab.reject_held_handover() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM reward_lab.customer_holds WHERE customer_id=NEW.customer_id)
  THEN RAISE EXCEPTION 'CUSTOMER_REWARDS_ON_REFUND_HOLD'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER block_held_handovers BEFORE INSERT ON reward_lab.handovers
  FOR EACH ROW EXECUTE FUNCTION reward_lab.reject_held_handover();

CREATE FUNCTION reward_lab.record_verified_refund(
  p_refund_id text,p_reference text,p_order_id text,p_line_id text,
  p_units integer,p_reason text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE
  v_old reward_lab.refund_events%ROWTYPE;
  v_line reward_lab.credited_lines%ROWTYPE;
  v_already integer;
BEGIN
  IF COALESCE(length(trim(p_refund_id)),0)=0 OR
     COALESCE(length(trim(p_reference)),0)=0 OR
     COALESCE(length(trim(p_order_id)),0)=0 OR
     COALESCE(length(trim(p_line_id)),0)=0 OR
     p_units IS NULL OR p_units<1 OR
     COALESCE(length(trim(p_reason)),0)<3 OR length(p_reason)>500
  THEN RAISE EXCEPTION 'INVALID_REFUND_EVENT'; END IF;
  -- Serializes refund against credit_paid_order() and fulfil_grant().
  PERFORM id FROM reward_lab.program WHERE id=1 FOR UPDATE;
  SELECT * INTO v_old FROM reward_lab.refund_events WHERE refund_id=p_refund_id;
  IF FOUND THEN
    IF (v_old.refund_reference,v_old.order_id,v_old.line_id,v_old.units,v_old.reason)
       IS DISTINCT FROM (p_reference,p_order_id,p_line_id,p_units,p_reason)
    THEN RAISE EXCEPTION 'REFUND_REPLAY_CONFLICT'; END IF;
    RETURN p_refund_id;
  END IF;
  SELECT * INTO v_line FROM reward_lab.credited_lines
    WHERE order_id=p_order_id AND line_id=p_line_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UNVERIFIED_REFUND_SOURCE'; END IF;
  SELECT COALESCE(sum(units),0)::integer INTO v_already FROM reward_lab.refund_events
    WHERE order_id=p_order_id AND line_id=p_line_id;
  IF v_already+p_units>v_line.units THEN
    RAISE EXCEPTION 'REFUND_UNITS_EXCEED_QUALIFIED_QUANTITY';
  END IF;
  INSERT INTO reward_lab.refund_events(refund_id,refund_reference,order_id,line_id,customer_id,units,reason)
    VALUES(p_refund_id,p_reference,p_order_id,p_line_id,v_line.customer_id,p_units,p_reason);
  INSERT INTO reward_lab.customer_holds(customer_id,original_refund_id)
    VALUES(v_line.customer_id,p_refund_id) ON CONFLICT(customer_id) DO NOTHING;
  INSERT INTO reward_lab.audit(event_type,subject_id,detail)
    VALUES('refund_hold',p_refund_id,p_order_id||':'||p_line_id||':units='||p_units);
  RETURN p_refund_id;
END;
$$;

-- Cancel an uncollected redemption ATTEMPT, not the customer's earned entitlement.
-- There is no payable before actual handover; no reserved budget is released here.
CREATE FUNCTION reward_lab.cancel_uncollected_attempt(
  p_attempt text,p_grant text,p_customer text,p_reason text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE
  v_grant reward_lab.grants%ROWTYPE;
  v_prior reward_lab.cancelled_reward_attempts%ROWTYPE;
BEGIN
  IF COALESCE(length(trim(p_attempt)),0)=0 OR
    COALESCE(length(trim(p_reason)),0)<3 OR length(p_reason)>500
  THEN RAISE EXCEPTION 'INVALID_CANCEL_REQUEST'; END IF;
  PERFORM id FROM reward_lab.program WHERE id=1 FOR UPDATE;
  SELECT * INTO v_prior FROM reward_lab.cancelled_reward_attempts WHERE attempt_id=p_attempt;
  IF FOUND THEN
    IF (v_prior.grant_id,v_prior.customer_id,v_prior.reason)
       IS DISTINCT FROM (p_grant,p_customer,p_reason)
    THEN RAISE EXCEPTION 'CANCELLATION_REPLAY_CONFLICT'; END IF;
    RETURN p_attempt;
  END IF;
  SELECT * INTO v_grant FROM reward_lab.grants WHERE grant_id=p_grant FOR UPDATE;
  IF NOT FOUND OR v_grant.customer_id IS DISTINCT FROM p_customer
    THEN RAISE EXCEPTION 'GRANT_NOT_OWNED'; END IF;
  IF v_grant.status<>'earned' OR EXISTS (
    SELECT 1 FROM reward_lab.handovers WHERE grant_id=p_grant
  ) THEN RAISE EXCEPTION 'FOOD_ALREADY_HANDED_OVER'; END IF;
  INSERT INTO reward_lab.cancelled_reward_attempts(attempt_id,grant_id,customer_id,reason)
    VALUES(p_attempt,p_grant,p_customer,p_reason);
  INSERT INTO reward_lab.audit(event_type,subject_id,detail)
    VALUES('attempt_cancelled',p_attempt,p_grant);
  RETURN p_attempt;
END;
$$;

-- Mistyped reference correction is APPEND-ONLY. Never change original transfer,
-- amount, recipient, status or allow a second bank payment through this function.
CREATE FUNCTION reward_lab.correct_transfer_reference(
  p_correction text,p_transfer text,p_admin text,p_new_reference text,p_reason text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE
  v_payment reward_lab.payables%ROWTYPE;
  v_transfer reward_lab.transfers%ROWTYPE;
  v_old reward_lab.transfer_reference_corrections%ROWTYPE;
BEGIN
  IF COALESCE(length(trim(p_correction)),0)=0 OR
     COALESCE(length(trim(p_admin)),0)=0 OR
     COALESCE(length(trim(p_new_reference)),0)=0 OR
     COALESCE(length(trim(p_reason)),0)<3 OR length(p_reason)>500
  THEN RAISE EXCEPTION 'INVALID_REFERENCE_CORRECTION'; END IF;
  SELECT * INTO v_transfer FROM reward_lab.transfers WHERE transfer_id=p_transfer;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND'; END IF;
  SELECT * INTO v_payment FROM reward_lab.payables
    WHERE payable_id=v_transfer.payable_id FOR UPDATE;
  IF v_payment.status NOT IN ('sent','disputed') THEN
    RAISE EXCEPTION 'REFERENCE_CORRECTION_CLOSED';
  END IF;
  SELECT * INTO v_old FROM reward_lab.transfer_reference_corrections WHERE transfer_id=p_transfer;
  IF FOUND THEN
    IF (v_old.correction_id,v_old.admin_id,v_old.new_bank_reference,v_old.reason)
      IS DISTINCT FROM (p_correction,p_admin,p_new_reference,p_reason)
    THEN RAISE EXCEPTION 'REFERENCE_CORRECTION_REPLAY_CONFLICT'; END IF;
    RETURN p_correction;
  END IF;
  IF v_transfer.bank_reference=p_new_reference THEN RAISE EXCEPTION 'REFERENCE_UNCHANGED'; END IF;
  INSERT INTO reward_lab.transfer_reference_corrections(
    correction_id,transfer_id,admin_id,new_bank_reference,reason)
    VALUES(p_correction,p_transfer,p_admin,p_new_reference,p_reason);
  INSERT INTO reward_lab.audit(event_type,subject_id,detail)
    VALUES('reference_corrected',p_correction,p_transfer);
  RETURN p_correction;
END;
$$;

-- Super Admin can document a dispute investigation, but CANNOT self-confirm
-- the merchant received the payment. That needs a second merchant-only action.
CREATE FUNCTION reward_lab.document_dispute_resolution(
  p_resolution text,p_payable text,p_admin text,p_summary text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE
  v_payment reward_lab.payables%ROWTYPE;
  v_old reward_lab.dispute_resolutions%ROWTYPE;
BEGIN
  IF COALESCE(length(trim(p_resolution)),0)=0 OR
     COALESCE(length(trim(p_admin)),0)=0 OR
     COALESCE(length(trim(p_summary)),0)<5 OR length(p_summary)>500
  THEN RAISE EXCEPTION 'INVALID_DISPUTE_DOCUMENTATION'; END IF;
  SELECT * INTO v_payment FROM reward_lab.payables WHERE payable_id=p_payable FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYABLE_NOT_FOUND'; END IF;
  SELECT * INTO v_old FROM reward_lab.dispute_resolutions WHERE payable_id=p_payable;
  IF FOUND THEN
    IF (v_old.resolution_id,v_old.admin_id,v_old.summary)
      IS DISTINCT FROM (p_resolution,p_admin,p_summary)
    THEN RAISE EXCEPTION 'DISPUTE_RESOLUTION_REPLAY_CONFLICT'; END IF;
    RETURN p_resolution;
  END IF;
  IF v_payment.status<>'disputed' THEN RAISE EXCEPTION 'PAYMENT_NOT_DISPUTED'; END IF;
  INSERT INTO reward_lab.dispute_resolutions(resolution_id,payable_id,admin_id,summary)
    VALUES(p_resolution,p_payable,p_admin,p_summary);
  INSERT INTO reward_lab.audit(event_type,subject_id,detail)
    VALUES('resolution_documented',p_resolution,p_payable);
  RETURN p_resolution;
END;
$$;

CREATE FUNCTION reward_lab.merchant_acknowledge_dispute_resolution(
  p_ack text,p_resolution text,p_verified_shop text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE
  v_resolution reward_lab.dispute_resolutions%ROWTYPE;
  v_payment reward_lab.payables%ROWTYPE;
  v_old reward_lab.dispute_merchant_acks%ROWTYPE;
BEGIN
  IF COALESCE(length(trim(p_ack)),0)=0 THEN RAISE EXCEPTION 'INVALID_RESOLUTION_ACK'; END IF;
  SELECT * INTO v_resolution FROM reward_lab.dispute_resolutions
    WHERE resolution_id=p_resolution;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESOLUTION_NOT_FOUND'; END IF;
  SELECT * INTO v_payment FROM reward_lab.payables WHERE payable_id=v_resolution.payable_id FOR UPDATE;
  IF v_payment.shop_id IS DISTINCT FROM p_verified_shop THEN
    RAISE EXCEPTION 'MERCHANT_FORBIDDEN';
  END IF;
  SELECT * INTO v_old FROM reward_lab.dispute_merchant_acks
    WHERE resolution_id=p_resolution;
  IF FOUND THEN
    IF (v_old.ack_id,v_old.verified_shop_id) IS DISTINCT FROM (p_ack,p_verified_shop)
    THEN RAISE EXCEPTION 'RESOLUTION_ACK_REPLAY_CONFLICT'; END IF;
    RETURN p_ack;
  END IF;
  IF v_payment.status<>'disputed' THEN RAISE EXCEPTION 'PAYMENT_NOT_DISPUTED'; END IF;
  INSERT INTO reward_lab.dispute_merchant_acks(ack_id,resolution_id,verified_shop_id)
    VALUES(p_ack,p_resolution,p_verified_shop);
  UPDATE reward_lab.payables SET status='confirmed' WHERE payable_id=v_payment.payable_id;
  INSERT INTO reward_lab.audit(event_type,subject_id,detail)
    VALUES('merchant_resolution_ack',p_ack,p_resolution);
  RETURN p_ack;
END;
$$;

-- Useful invariant: never release refund-held reservations or rewrite an owed
-- amount because the customer subsequently received a refund.
CREATE FUNCTION reward_lab.reconcile_allocated_budget()
RETURNS TABLE(allocated_minor bigint,expected_minor bigint,balanced boolean)
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog STABLE AS $$
 SELECT p.allocated_minor,
   (
     COALESCE((SELECT sum(cap_minor) FROM reward_lab.grants WHERE status='earned'),0)
     +COALESCE((SELECT sum(amount_minor) FROM reward_lab.payables),0)
   )::bigint AS expected_minor,
   p.allocated_minor=(
     COALESCE((SELECT sum(cap_minor) FROM reward_lab.grants WHERE status='earned'),0)
     +COALESCE((SELECT sum(amount_minor) FROM reward_lab.payables),0)
   ) FROM reward_lab.program p WHERE p.id=1
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA reward_lab FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA reward_lab FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA reward_lab FROM PUBLIC;
COMMIT;
