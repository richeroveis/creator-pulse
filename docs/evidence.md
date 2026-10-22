# Live studionet evidence

CreatorPulse was deployed to GenLayer studionet and driven through a full multi signer scenario. This
file is a human readable companion to the machine readable record in
[`evidence/studionet_deployment.json`](../evidence/studionet_deployment.json).

## Method

- Every transaction was submitted by a distinct signing account and polled until `status_name == FINALIZED`
  over the studionet RPC while the scenario ran.
- Afterwards every transaction was re-read independently through the explorer JSON API
  (`GET https://explorer-studio.genlayer.com/api/transactions/{hash}`) by `scripts/verify_explorer.py`,
  which checks `FINALIZED`, the contract address, the execution result, the validator vote tally, the
  absence of any appeal flag, and for guard probes the exact revert string. Result: 39/39 rows PASS at 2026-10-22T17:24:01Z.
- `result_name` and the leader receipt `execution_result` were recorded for every row. Guard probes are
  expected to finish with `FINISHED_WITH_ERROR`, and the exact revert payload is stored in the JSON.
- Final state was read with `get_dashboard`, `check_vault_invariants` and `get_token_balance`, not inferred
  from the transaction log.
- The deployed code identity is the sha256 of `contracts/creator_pulse.py`: `ed4fcc08c72e4926329f9efc6c3a16ac7d0b6d57ef04abd03136d1d6ea0381aa`.
  The same digest is published in the evidence JSON, `frontend/src/config.ts` and `README.md`, and
  re-checked by `scripts/verify_identity.py`. GenLayer does not expose deployed Python source: the
  explorer has no source field and `eth_getCode` returns `0x` for this address, so the source commit
  below is the reproducible link between the repository and the deployed bytes.

## Validator agreement on the live audits

Direct mode tests only exercise the leader path. These rows come from the explorer and show what the
independent validators actually returned for each consensus audit:

- `audit:1`: 3 validator votes agreed, 3 of 4 validators returned the leader result byte for byte, expected band `VIRAL_BONUS_TIER` present in the payload.
- `audit:2`: 3 validator votes agreed, 2 of 4 validators returned the leader result byte for byte, expected band `TARGET_MET_TIER` present in the payload.
- `audit:3`: 3 validator votes agreed, 2 of 4 validators returned the leader result byte for byte, expected band `BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH` present in the payload.

## Deployment

| Field | Value |
| --- | --- |
| Network | studionet, chain id 61999 |
| Contract | [`0x6768EAdcFBF13aDEE460Bfd228f6653f3e013016`](https://explorer-studio.genlayer.com/address/0x6768EAdcFBF13aDEE460Bfd228f6653f3e013016) |
| Deploy transaction | [0x48e6029a946a](https://explorer-studio.genlayer.com/tx/0x48e6029a946a6b87b33c9e5a90423c8e277d7a6cd303edfc66f1ee91afe4b065) |
| Runner | `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }` |
| Code sha256 | `ed4fcc08c72e4926329f9efc6c3a16ac7d0b6d57ef04abd03136d1d6ea0381aa` |
| Deployed at commit | `a77042e409dacf6e205839a31c610e3d48a35fe5` |
| Commit tag | `untagged` |
| Explorer re-verification | 39/39 rows PASS at 2026-10-22T17:24:01Z |

## Transactions

| Step | Transaction | Status | Result | Execution | Votes | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `deploy` | [0x48e6029a946a](https://explorer-studio.genlayer.com/tx/0x48e6029a946a6b87b33c9e5a90423c8e277d7a6cd303edfc66f1ee91afe4b065) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |  |
| `faucet:brand_nova` | [0x326374cfdb0f](https://explorer-studio.genlayer.com/tx/0x326374cfdb0fcf852e62395bb16f708601ff7c8c0ff590350d31b13f837c36e6) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:brand_pulse` | [0x3637e0369787](https://explorer-studio.genlayer.com/tx/0x3637e03697876d38b320a359e44947839cb7104ef91a68c336ba1848db4d1c35) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:brand_aurora` | [0xd21d2bc2c153](https://explorer-studio.genlayer.com/tx/0xd21d2bc2c15323fc1dcd8d6e89411e01cd95b53047991bdcb83ba0521f488915) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:creator_mira` | [0xe0a003f328bf](https://explorer-studio.genlayer.com/tx/0xe0a003f328bfda5374775177b36b6ed3e2005278424611b7d6574e9f7e14ac60) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:creator_jonas` | [0x75ec0ac00617](https://explorer-studio.genlayer.com/tx/0x75ec0ac00617471318c049c12c03ff4530e96ecd5db29d3a4bbd69c3e3ecd943) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:curator_lin` | [0x9fbee46fab4b](https://explorer-studio.genlayer.com/tx/0x9fbee46fab4b45d197b7bc91706f0f85b19c9a765f4bfb4a66eb4f32a726c943) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:curator_ada` | [0xee88fb65dbc5](https://explorer-studio.genlayer.com/tx/0xee88fb65dbc59225eebdf270a491025cc596f2b53eb4f56c0aade87a2c516c3b) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `create:1` | [0x5fdb02075c86](https://explorer-studio.genlayer.com/tx/0x5fdb02075c8615a36e3e6113fdacb090a3e3d7200f1f44006650e18a49b11a2a) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | locks 2000 CPT of maximum liability |
| `create:2` | [0xa96a8d252b4c](https://explorer-studio.genlayer.com/tx/0xa96a8d252b4cb80b66c458e591c1d4f81042ab43045a5c0d163e7dcc3c5e2b12) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | locks 1300 CPT of maximum liability |
| `create:3` | [0xaf88a9f1bdb7](https://explorer-studio.genlayer.com/tx/0xaf88a9f1bdb73ea256bb4a35844f24b79f6f8d56b35c517552ff3b621e43070a) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | locks 1500 CPT of maximum liability |
| `create:4` | [0xeb729541d7bc](https://explorer-studio.genlayer.com/tx/0xeb729541d7bc5af99eff734ffe0e279e13f82ea86bec5886e10955426b2f3f14) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | funds the vault of the campaign that will be recovered |
| `submit:1` | [0x761e6f085d8b](https://explorer-studio.genlayer.com/tx/0x761e6f085d8bfa83c68a995faf1894d40f01bc2321d81bd6270565da786d8917) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | creator bond locked into custody |
| `submit:2` | [0x2cfeafdd6028](https://explorer-studio.genlayer.com/tx/0x2cfeafdd60287ec0726a84d0946abcbe6d8bb76baa083291623eaff4bdfb0d0e) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | creator bond locked into custody |
| `submit:3` | [0x12a985a35e9f](https://explorer-studio.genlayer.com/tx/0x12a985a35e9f6908015ddc08eafe2aa7159d91f662035e0aa1dc96bfc593042e) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | client retry race: the first submit write was accepted on chain, this recorded retry reverted because campaign 3 was already SUBMITTED, see audit:3 which finalized |
| `submit:4` | [0x04bdb110e0cd](https://explorer-studio.genlayer.com/tx/0x04bdb110e0cd3e3fc1125c79885c1c0de4a1a89c991cc7b5ad7eaf5074e61040) | FINALIZED | MAJORITY_AGREE | SUCCESS | 4 agree / 0 disagree | locks the bond and submits an unreadable proof page |
| `guard:recover-before-window` | [0x0196dbd196ad](https://explorer-studio.genlayer.com/tx/0x0196dbd196ad5bd88113ae3905a3839e7af2327a22f9f56c588cf55998716fac) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | neutral recovery is blocked before the minimum audit window |
| `guard:recover-hard-timeout-early` | [0xb208aafcd88d](https://explorer-studio.genlayer.com/tx/0xb208aafcd88d0799e7f2cb9438643acd53136a95031beef6f771eff29429b6aa) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | hard timeout recovery is blocked long before the seven day floor |
| `curate:1` | [0x5140b487ce73](https://explorer-studio.genlayer.com/tx/0x5140b487ce73d0b4e7e9f6bb78c26bee329a08924a757a912fc3309ac426748a) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | 120 CPT staked behind campaign 1 |
| `curate:2` | [0xb8c3f6160db1](https://explorer-studio.genlayer.com/tx/0xb8c3f6160db190a71d024151b9180b5b69f318f4da18411e3f75d0ccedf39bf9) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | 40 CPT staked behind campaign 1 |
| `curate:3` | [0x32f793c59e6e](https://explorer-studio.genlayer.com/tx/0x32f793c59e6ef774cbaa69f3cdd214d7531180000d38e1875063f7e6edd1393d) | FINALIZED | MAJORITY_AGREE | SUCCESS | 4 agree / 0 disagree | 60 CPT staked behind campaign 2 |
| `curate:4` | [0xd7128272aef6](https://explorer-studio.genlayer.com/tx/0xd7128272aef68c80b875090061a75256954c1dc8069b44af4a129bee4c8b9144) | FINALIZED | MAJORITY_AGREE | SUCCESS | 4 agree / 0 disagree | 30 CPT staked behind campaign 3 |
| `curate:recovery` | [0xb28000cf66b2](https://explorer-studio.genlayer.com/tx/0xb28000cf66b2a9669af6b3002295fcd8e9a7570abd2b2066d05cb933dc311b2f) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | community stake behind the dead evidence deliverable |
| `guard:clawback-submitted` | [0x90f21929e125](https://explorer-studio.genlayer.com/tx/0x90f21929e125169d913d38b7fccbc6bfcfb3625a9b302b318aceff5c52f5ea1b) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 4 agree / 0 disagree | brand cannot pull the viral pool while a deliverable awaits audit |
| `audit:1` | [0x306c84fa7dab](https://explorer-studio.genlayer.com/tx/0x306c84fa7dab1f0a5695362c43bce3cf367dd551213640645650ffb7e50b4071) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 1 disagree | live consensus audit, expected VIRAL_BONUS_TIER |
| `audit:2` | [0x2d2a0b31ac30](https://explorer-studio.genlayer.com/tx/0x2d2a0b31ac308c3c18a8ad4f144241a1d493465091fb1bdee3d27795b9575068) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | live consensus audit, expected TARGET_MET_TIER |
| `audit:3` | [0x7d36ba26d364](https://explorer-studio.genlayer.com/tx/0x7d36ba26d36468e212d33058d5d6ab8d96c5c1cea30fce5aa324aef0c4039cd6) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | live consensus audit, expected BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH |
| `guard:clawback-evaluated` | [0x1681d33925b4](https://explorer-studio.genlayer.com/tx/0x1681d33925b401056ab341c54b7dce4aa5b5b90a9bc4949d0693d07dcd51d379) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | brand cannot pull funds inside the post audit dispute window |
| `settle:1` | [0x3a3356d6ed64](https://explorer-studio.genlayer.com/tx/0x3a3356d6ed649de420b9aa096f158a5db46990e0190ecff6c5e7a609e5b78c0e) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | viral band releases the full vault |
| `settle:3` | [0x3ef791549ee8](https://explorer-studio.genlayer.com/tx/0x3ef791549ee85eed6d1403157277ae19769291ecf088d422911d90b895d7189f) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | slash band refunds the brand |
| `refund:curation-1` | [0x913322750f67](https://explorer-studio.genlayer.com/tx/0x913322750f6780102e27a4092f80eccd39a5c3c2672ebfa2e0746eb11e45f8dd) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | curator pulls the stake back after settlement |
| `guard:curate-after-settlement` | [0x2e881f858942](https://explorer-studio.genlayer.com/tx/0x2e881f8589420adfd7d30b26d9b164e9cbc553593182fd44a2da9abc8a895c39) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | settled campaigns leave the curated feed |
| `guard:transfer-overdraw` | [0xa19ea7a585c1](https://explorer-studio.genlayer.com/tx/0xa19ea7a585c194dda5e9a417e6d6a0c9da5351fbd8e10a31cff99c2aa09ba68d) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | balance floor holds under an overdraw attempt |
| `recover:4` | [0x75930721a330](https://explorer-studio.genlayer.com/tx/0x75930721a3307981dcfbabc185cc86f09b1405e6e4489d93044cac2ec50043a7) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | validators fetch dead.html, agree proof_unreachable, neutral recovery runs |
| `guard:audit-after-recovery` | [0xb29ea1997665](https://explorer-studio.genlayer.com/tx/0xb29ea1997665908c9d129e17a7bf26ffbd23ae2c90f74f8605c1293ff109fe63) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | a recovered campaign can never be audited |
| `guard:curate-after-recovery` | [0x7ffdb4e8b05f](https://explorer-studio.genlayer.com/tx/0x7ffdb4e8b05f21c6ba50b8350657110759acbd1142affeec4c84a75a99a544ac) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | a recovered campaign can never be curated |
| `guard:withdraw-after-recovery` | [0x86a4a556d5e5](https://explorer-studio.genlayer.com/tx/0x86a4a556d5e59003982997f7a3413b750210e62a735da0458aedcad86ad4c316) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 4 agree / 0 disagree | the brand can never reclaim a recovered vault |
| `guard:recover-twice` | [0x7bc1786d78f5](https://explorer-studio.genlayer.com/tx/0x7bc1786d78f5a066cc8d4fe5c9d02b2959e1743cc62ec9af03601c3e2710a21e) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 5 agree / 0 disagree | recovery is not repeatable |
| `refund:recovery-curator` | [0x971babf1705a](https://explorer-studio.genlayer.com/tx/0x971babf1705a1961f8b74337e2bd8c438240fede7dea54b9666b460c104b3b4b) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | curator pulls the stake back after the neutral recovery |

## Final campaign state

| Id | Campaign | Band | Anchor | Creator CPT | Brand CPT | State |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | Recovery dead evidence probe | `` | 0 | 0 | 0 | RECOVERED |
| 3 | AuroraLab night serum drop | `BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH` | 0 | 0 | 1650 | SETTLED |
| 2 | PulseFuel morning stack | `TARGET_MET_TIER` | 80 | 1000 | 400 | EVALUATED |
| 1 | NovaGlow winter ritual launch | `VIRAL_BONUS_TIER` | 100 | 2120 | 0 | SETTLED |

Vault invariant: `1610 CPT ==
1400 escrow + 210 curation`, drift
`0`, `ok = True`.

Campaign 2 was intentionally left in `EVALUATED` state so the settlement claim stays available in the
live app for anyone who wants to exercise `claim_campaign_settlement` after the dispute window.

## Guard probes

| Probe | Expected guard | On chain observation |
| --- | --- | --- |
| `guard:recover-before-window` | `Unreachable recovery window has not opened` | `FINISHED_WITH_ERROR` by explorer row check PASS, payload `[EXPECTED] Unreachable recovery window has not opened yet` |
| `guard:recover-hard-timeout-early` | `Hard timeout window has not opened yet` | `FINISHED_WITH_ERROR` by explorer row check PASS, payload `[EXPECTED] Hard timeout window has not opened yet` |
| `guard:clawback-submitted` | `PAPITO_LIABILITY_LOCK` | `FINISHED_WITH_ERROR` by explorer row check PASS, payload `[EXPECTED] PAPITO_LIABILITY_LOCK deliverable is awaiting the live audit` |
| `guard:clawback-evaluated` | `PAPITO_LIABILITY_LOCK` | `FINISHED_WITH_ERROR` by explorer row check PASS, payload `[EXPECTED] PAPITO_LIABILITY_LOCK post audit dispute window is still running` |
| `guard:curate-after-settlement` | `already settled` | `FINISHED_WITH_ERROR` by explorer row check PASS, payload `[EXPECTED] Campaign is already settled` |
| `guard:transfer-overdraw` | `Insufficient CPT balance` | `FINISHED_WITH_ERROR` by explorer row check PASS, payload `[EXPECTED] Insufficient CPT balance` |
| `guard:audit-after-recovery` | `not awaiting an audit` | `FINISHED_WITH_ERROR` by explorer row check PASS, payload `[EXPECTED] Campaign is not awaiting an audit` |
| `guard:curate-after-recovery` | `funds were recovered` | `FINISHED_WITH_ERROR` by explorer row check PASS, payload `[EXPECTED] Campaign funds were recovered` |
| `guard:withdraw-after-recovery` | `funds were recovered` | `FINISHED_WITH_ERROR` by explorer row check PASS, payload `[EXPECTED] PAPITO_LIABILITY_LOCK campaign funds were recovered` |
| `guard:recover-twice` | `only possible from SUBMITTED` | `FINISHED_WITH_ERROR` by explorer row check PASS, payload `[EXPECTED] Recovery is only possible from SUBMITTED` |
| Missing disclosure tag | forced slash band | campaign 3 settled as `BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH` with creator payout 0 |

## Reproduce

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
genvm-lint check contracts/creator_pulse.py
pytest tests/ -q
python scripts/deploy_studionet.py
python scripts/verify_explorer.py
python scripts/record_provenance.py
python scripts/write_evidence_md.py
python scripts/verify_identity.py
```
