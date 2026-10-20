# Live studionet evidence

CreatorPulse was deployed to GenLayer studionet and driven through a full multi signer scenario. This
file is a human readable companion to the machine readable record in
[`evidence/studionet_deployment.json`](../evidence/studionet_deployment.json).

## Method

- Every transaction was submitted by a distinct signing account, polled until `status_name == FINALIZED`,
  and then re-read through the explorer JSON RPC with `get_transaction`.
- `result_name` and the leader receipt `execution_result` were recorded for every row. Guard probes are
  expected to finish with `FINISHED_WITH_ERROR`, and the exact revert payload is stored in the JSON.
- Final state was read with `get_dashboard`, `check_vault_invariants` and `get_token_balance`, not inferred
  from the transaction log.
- The deployed code identity is the sha256 of `contracts/creator_pulse.py`: `66fab11723efa7bc3603a8537c2f98003649fe9339b2397829146539df1c4d65`.
  The same digest is published in the evidence JSON, `frontend/src/config.ts` and `README.md`, and
  re-checked by `scripts/verify_identity.py`.

## Deployment

| Field | Value |
| --- | --- |
| Network | studionet, chain id 61999 |
| Contract | [`0x031B8ed9391b81fd89107B231F9573bD699e3F38`](https://explorer-studio.genlayer.com/address/0x031B8ed9391b81fd89107B231F9573bD699e3F38) |
| Deploy transaction | [0xa0d3b9ddfb9a](https://explorer-studio.genlayer.com/tx/0xa0d3b9ddfb9ae63a9c102f1b32890f67b48925c1e97c21ba4ad941c20280abd4) |
| Runner | `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }` |
| Code sha256 | `66fab11723efa7bc3603a8537c2f98003649fe9339b2397829146539df1c4d65` |
| Deployed at commit | `19f5b74e65cc9ee8b30ac17a62b169a6a1fb70e6` |

## Transactions

| Step | Transaction | Status | Result | Execution | Votes | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `faucet:brand_nova` | [0xcfa3dbded8b1](https://explorer-studio.genlayer.com/tx/0xcfa3dbded8b194b7421e1f1172a0c7abd563fd7f90ba1b5a0d1730a273bc5b1c) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:brand_pulse` | [0x51f60c5389b5](https://explorer-studio.genlayer.com/tx/0x51f60c5389b5451ed5bdbacfb5da529da87b6811c48e0d0286a8490492c805a2) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:brand_aurora` | [0xb9d2b69d694c](https://explorer-studio.genlayer.com/tx/0xb9d2b69d694cd71d44a1bc014fa87e8c2aeabc695a03c35165342d02dbd389cc) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:creator_mira` | [0x6ef665b5be71](https://explorer-studio.genlayer.com/tx/0x6ef665b5be71a4d5672506d6251364e08c52ae384fd3486abf012b329d7c489c) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:creator_jonas` | [0x47b435095386](https://explorer-studio.genlayer.com/tx/0x47b435095386dc53c3f43567398e796bdf5d6fdb59107859b35f291c9afa7a07) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:curator_lin` | [0xf656aec2f27d](https://explorer-studio.genlayer.com/tx/0xf656aec2f27d39fb9ecda7c5fa6728b251f3e158676ae8afd0416941c0b73628) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:curator_ada` | [0xc1dd64380674](https://explorer-studio.genlayer.com/tx/0xc1dd643806746882cd338616708f81332dd374b280fad5f2b8eec5d2b116a052) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | capped faucet credit for a demo signer |
| `create:1` | [0x5b1f82cee874](https://explorer-studio.genlayer.com/tx/0x5b1f82cee8746668deb44e98defdc19f5c18b2616612eb67e613696c1654349b) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | locks 2000 CPT of maximum liability |
| `create:2` | [0x67452884a77e](https://explorer-studio.genlayer.com/tx/0x67452884a77efb2c997d7b82b3ba4f5c9546f8b09831f4fb0901bbde8c1e7fbf) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | locks 1300 CPT of maximum liability |
| `create:3` | [0xdd7ed0be9c09](https://explorer-studio.genlayer.com/tx/0xdd7ed0be9c097a4b3bd94f568d6b6181d6f88f116a91d259bf1d6fe9d5d425ab) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | locks 1500 CPT of maximum liability |
| `submit:1` | [0x3f13ba9dfa79](https://explorer-studio.genlayer.com/tx/0x3f13ba9dfa79da65a28b95ff72ff3c8043ae75cad46b60b73cda9fd346533acd) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | creator bond locked into custody |
| `submit:2` | [0x593daa3e1f84](https://explorer-studio.genlayer.com/tx/0x593daa3e1f84ff47ba62770a5cffbf9abb12b15f3c5f574722bfacb04972c534) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | creator bond locked into custody |
| `submit:3` | [0x703638484918](https://explorer-studio.genlayer.com/tx/0x7036384849186144ee1684b1423e9df6ac9f4f58d155d0e9ab2cf71509a337a8) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | creator bond locked into custody |
| `curate:1` | [0x36f7ea8903c5](https://explorer-studio.genlayer.com/tx/0x36f7ea8903c5ef3f51eeec402822e7d91bac0ff645f0792b28ec9c22ce3cccc0) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | 120 CPT staked behind campaign 1 |
| `curate:2` | [0x5e8c594497e2](https://explorer-studio.genlayer.com/tx/0x5e8c594497e2010ff3cf3849832c4cb665f77fea9a8db6a4ec006faac1060d53) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | 40 CPT staked behind campaign 1 |
| `curate:3` | [0xd82fe1d620ba](https://explorer-studio.genlayer.com/tx/0xd82fe1d620bafa4246ad2342b71e8222a83905a829ec8255f9a36e9af1c55402) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | 60 CPT staked behind campaign 2 |
| `curate:4` | [0x89f40b9334cd](https://explorer-studio.genlayer.com/tx/0x89f40b9334cdb312090a279c3646fbf7e8b37acac37c9b938ab1876590b839c1) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | 30 CPT staked behind campaign 3 |
| `guard:clawback-submitted` | [0x150977f14dab](https://explorer-studio.genlayer.com/tx/0x150977f14dabc3b8ff0b95cc0bdb1fdb107c49e692922b7382f6f854123353d3) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | brand cannot pull the viral pool while a deliverable awaits audit |
| `audit:1` | [0x9b1bccaa4aac](https://explorer-studio.genlayer.com/tx/0x9b1bccaa4aacface3eb63752c21578cd1f17d016b2d4b792c1f71567890c7e9c) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | live consensus audit, expected VIRAL_BONUS_TIER |
| `audit:2` | [0x065ade2b16dc](https://explorer-studio.genlayer.com/tx/0x065ade2b16dc4c76fcb318ec7990b9cc4ea6aa4ad5f5db3b5a74a0725adee60a) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 1 disagree | live consensus audit, expected TARGET_MET_TIER |
| `audit:3` | [0x1806400aa312](https://explorer-studio.genlayer.com/tx/0x1806400aa312fad513f80c6055cf65029e06566e0e0b50bb8022ee0ef8ec6714) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | live consensus audit, expected BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH |
| `guard:clawback-evaluated` | [0x0e94e360017e](https://explorer-studio.genlayer.com/tx/0x0e94e360017efb384f58cd32732d99249a796c75c21baaa2e07b09cf11635078) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | brand cannot pull funds inside the post audit dispute window |
| `settle:1` | [0x858d32683e99](https://explorer-studio.genlayer.com/tx/0x858d32683e99d8516e5ca569f7a4a7d007e97c134f28ca66d7a373a5a5ccf647) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | viral band releases the full vault |
| `settle:3` | [0xd3bbc7dafd1f](https://explorer-studio.genlayer.com/tx/0xd3bbc7dafd1f80bff518d185e0343d2f297794290367873a186537727668607f) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | slash band refunds the brand |
| `refund:curation-1` | [0xad9be373efca](https://explorer-studio.genlayer.com/tx/0xad9be373efca9c11338ffed9b3540dbcbc03f52e5735c9116170f8200669666f) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | curator pulls the stake back after settlement |
| `guard:curate-after-settlement` | [0x64d911c68543](https://explorer-studio.genlayer.com/tx/0x64d911c685435cadbcd2bf8f280d074703be76d950f356fd0fcd385f25c7bc11) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | settled campaigns leave the curated feed |
| `guard:transfer-overdraw` | [0x3874ece506f9](https://explorer-studio.genlayer.com/tx/0x3874ece506f915bec863448686d9bd1116933e71c6583959288a7b252904bbd6) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | balance floor holds under an overdraw attempt |

## Final campaign state

| Id | Campaign | Band | Anchor | Creator CPT | Brand CPT | State |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | AuroraLab night serum drop | `BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH` | 0 | 0 | 1650 | SETTLED |
| 2 | PulseFuel morning stack | `TARGET_MET_TIER` | 80 | 1000 | 400 | EVALUATED |
| 1 | NovaGlow winter ritual launch | `VIRAL_BONUS_TIER` | 100 | 2120 | 0 | SETTLED |

Vault invariant: `1610 CPT ==
1400 escrow + 210 curation`, drift
`0`, `ok = True`.

Campaign 2 was intentionally left in `EVALUATED` state so the settlement claim stays available in the
live app for anyone who wants to exercise `claim_campaign_settlement` after the dispute window.

## Guard probes

| Probe | Expected | Observed |
| --- | --- | --- |
| Brand clawback while the deliverable awaits audit | `PAPITO_LIABILITY_LOCK` | `FINISHED_WITH_ERROR`, payload `[EXPECTED] PAPITO_LIABILITY_LOCK deliverable is awaiting the live audit` |
| Brand clawback inside the post audit dispute window | `PAPITO_LIABILITY_LOCK` | `FINISHED_WITH_ERROR`, payload `[EXPECTED] PAPITO_LIABILITY_LOCK post audit dispute window is still running` |
| Curation after settlement | `already settled` | `FINISHED_WITH_ERROR`, payload `[EXPECTED] Campaign is already settled` |
| Transfer above the caller balance | `Insufficient CPT balance` | `FINISHED_WITH_ERROR`, payload `[EXPECTED] Insufficient CPT balance` |
| Missing disclosure tag | forced slash band | campaign 3 settled as `BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH` with creator payout 0 |

## Reproduce

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
genvm-lint check contracts/creator_pulse.py
pytest tests/ -q
python scripts/deploy_studionet.py
python scripts/verify_identity.py
```
