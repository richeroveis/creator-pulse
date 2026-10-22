"""Independent contract reads to confirm the UI-driven recovery outcome.

Populates the final block of evidence/ui_flow_verification.json with on chain facts:
the recovered campaign state, the curator stake after the pull refund, the vault
invariant and the actor balances. Reads use a throwaway account (no funds, no secret).
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from genlayer_py import create_account, create_client  # noqa: E402
from genlayer_py.chains import studionet  # noqa: E402

CONTRACT = "0x6768EAdcFBF13aDEE460Bfd228f6653f3e013016"
CPT = 10 ** 18
EVIDENCE = ROOT / "evidence" / "ui_flow_verification.json"
KEYS = ROOT / "artifacts" / "_ui_flow_keys.json"


def main() -> int:
    rc = create_client(chain=studionet, account=create_account())

    def read(fn, args=None):
        return rc.read_contract(address=CONTRACT, function_name=fn, args=args or [])

    addresses = json.loads(KEYS.read_text(encoding="utf-8"))["addresses"]
    dash = read("get_dashboard", [12])
    recovered = [c for c in dash.get("campaigns", []) if c.get("recovered")]
    info = {}
    if recovered:
        c = max(recovered, key=lambda x: int(x["campaign_id"]))
        cid = int(c["campaign_id"])
        info = {
            "recovered_campaign_id": cid,
            "recovered_title": c["title"],
            "recovered_state": c["state"],
            "brand_refunded_cpt": int(c["brand_refund_atto"]) // CPT if c.get("brand_refund_atto") else None,
            "creator_bond_returned_cpt": int(c["creator_payout_atto"]) // CPT if c.get("creator_payout_atto") else None,
            "curator_stake_total_cpt": int(c["curation_stake_total_atto"]) // CPT,
            "curator_refunded_cpt": int(c["curation_refunded_atto"]) // CPT,
            "curator_b_stake_after_refund": int(read("get_curator_stake", [cid, addresses["curator_b"]])) // CPT,
        }
    result = {
        "campaign_count": int(read("get_campaign_count")),
        "recovered_campaign": info or None,
        "invariants": read("check_vault_invariants"),
        "balances_cpt": {name: int(read("get_token_balance", [addr])) // CPT for name, addr in addresses.items()},
    }
    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    evidence["final"] = result
    EVIDENCE.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2)[:1200])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
