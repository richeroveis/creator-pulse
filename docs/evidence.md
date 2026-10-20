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
- The deployed code identity is the sha256 of `contracts/creator_pulse.py`: `14bf5153b84d7167231d427c2899d97d9514e828efe463d1c274b4e8d4718c33`. The same
  digest is published in the evidence JSON, `frontend/src/config.ts` and `README.md`, and re-checked by
  `scripts/verify_identity.py`.

## Deployment

| Field | Value |
| --- | --- |
| Network | studionet, chain id 61999 |
| Contract | [`0x110C9EFa897A5Eab9b7f8019e70A43EB994f181B`](https://explorer-studio.genlayer.com/address/0x110C9EFa897A5Eab9b7f8019e70A43EB994f181B) |
| Deploy transaction | [0xee06a0af540c](https://explorer-studio.genlayer.com/tx/0xee06a0af540cd9ce9c7e75929b6ab6b5a453e0e25102a9fd982b28a617cdaf28) |
| Runner | `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }` |
| Code sha256 | `14bf5153b84d7167231d427c2899d97d9514e828efe463d1c274b4e8d4718c33` |
| Deployed at commit | `fa972f7d12c0e7bffcf4d981888977e6d2f4e26a` |

## Transactions

| Step | Transaction | Status | Result | Execution | Votes | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `faucet:brand_nova` | [0xfac62bcf9bbe](https://explorer-studio.genlayer.com/tx/0xfac62bcf9bbe6226a52bdbf5f3104e065639049f363ba21bd804fd2bb90de68c) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:brand_pulse` | [0xcf950464b873](https://explorer-studio.genlayer.com/tx/0xcf950464b873265b9c47ae22cf60a873252be0e2fe017534d121928c8d95bb58) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:brand_aurora` | [0x6f313017af68](https://explorer-studio.genlayer.com/tx/0x6f313017af680c6490f65bdb93a2100c03a80b97b8f0cbb6fbf2a245f4c22a4e) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:creator_mira` | [0x0ebb2ad0bee9](https://explorer-studio.genlayer.com/tx/0x0ebb2ad0bee92827d8519561b38544dad042b9e2c74bf3f20a479047ec27b96d) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:creator_jonas` | [0x7e2752b805c0](https://explorer-studio.genlayer.com/tx/0x7e2752b805c0be524f3191c7a754e8d9aaa4bc5c213ab5da3b3538036a48e028) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:curator_lin` | [0x43bdb126551b](https://explorer-studio.genlayer.com/tx/0x43bdb126551b8b4db1505e93db48e54f90aa31b26e5b05c9e3db09b0067850d3) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | capped faucet credit for a demo signer |
| `faucet:curator_ada` | [0xfc528a95f6e5](https://explorer-studio.genlayer.com/tx/0xfc528a95f6e557129cbfb3df276d26eea093a5daacb6c018cf6740bbd913f313) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | capped faucet credit for a demo signer |
| `create:1` | [0x9b7d5ac8d136](https://explorer-studio.genlayer.com/tx/0x9b7d5ac8d136a63d402c7d5c2d49ec7e309cee56c83d93da16eb610824f94871) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | locks 2000 CPT of maximum liability |
| `create:2` | [0xe65b60927a2c](https://explorer-studio.genlayer.com/tx/0xe65b60927a2c0cca16072553ae7e955d492f350c2368026607e0f445e17187df) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | locks 1300 CPT of maximum liability |
| `create:3` | [0x48a50c2c0293](https://explorer-studio.genlayer.com/tx/0x48a50c2c0293c99ffeca842736245bd169fbd565eb669bd17f071af5716c692c) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | locks 1500 CPT of maximum liability |
| `submit:1` | [0xb83bd383be6f](https://explorer-studio.genlayer.com/tx/0xb83bd383be6f393df512f7660d5fee76effcef52f2f3583562ab12bb719f012e) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | creator bond locked into custody |
| `submit:2` | [0xfc3276992eba](https://explorer-studio.genlayer.com/tx/0xfc3276992eba071ebeaca645efa47d6b27263894fc6449ad34c48d2b530b4991) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | creator bond locked into custody |
| `submit:3` | [0x75397b4aa1ae](https://explorer-studio.genlayer.com/tx/0x75397b4aa1ae5105830bddd7be31e0285516f353a06fe59e2282d59672bedc03) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | creator bond locked into custody |
| `curate:1` | [0x6ba52402abdd](https://explorer-studio.genlayer.com/tx/0x6ba52402abddd16df6d936b413d7bb39d1729e186f6994c03a2b0f9b0819f1ed) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | 120 CPT staked behind campaign 1 |
| `curate:2` | [0x1621cdf1c922](https://explorer-studio.genlayer.com/tx/0x1621cdf1c922851cc07a7b8887f889d18cfc76dff32b6b6641dea5a48b050a08) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | 40 CPT staked behind campaign 1 |
| `curate:3` | [0xabaf2ed2e7a3](https://explorer-studio.genlayer.com/tx/0xabaf2ed2e7a36f159b635aa6ea3c17a202904cf24d1fb66bb3815352b3b6abef) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | 60 CPT staked behind campaign 2 |
| `curate:4` | [0x58744ec62569](https://explorer-studio.genlayer.com/tx/0x58744ec62569fe4d3e6382a88e192f6ae2b9d798806cc17e5c10c506e02d924a) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | 30 CPT staked behind campaign 3 |
| `guard:clawback-submitted` | [0x1a646d87ec75](https://explorer-studio.genlayer.com/tx/0x1a646d87ec75533a308db957119618825ec533a0bf4cc43a8e7550cf2c6663b5) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | brand cannot pull the viral pool while a deliverable awaits audit |
| `audit:1` | [0x6b903db2dcb7](https://explorer-studio.genlayer.com/tx/0x6b903db2dcb7c061e5d0d39c091a5786bef41f8e74414212966440394a9ab574) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | live consensus audit, expected VIRAL_BONUS_TIER |
| `audit:2` | [0x2beeebf4d3c1](https://explorer-studio.genlayer.com/tx/0x2beeebf4d3c1a1da23b22f2a49466b5ad33e52eadbaba50dd19a38677e4725a1) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | live consensus audit, expected TARGET_MET_TIER |
| `audit:3` | [0x2d353812e8db](https://explorer-studio.genlayer.com/tx/0x2d353812e8db7bfc2b634d5ba4de774cf7d8a9f0ec3d968d9a3dfb0cdc19b862) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | live consensus audit, expected BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH |
| `guard:clawback-evaluated` | [0x3c7c374d545c](https://explorer-studio.genlayer.com/tx/0x3c7c374d545cd71ed4bcd46589a4e2dd595c21c218433104fa51daa11fae39a1) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | brand cannot pull funds inside the post audit dispute window |
| `settle:1` | [0xb676aa3aeeba](https://explorer-studio.genlayer.com/tx/0xb676aa3aeeba808092fa4ece1c848c45d02d2264d8d1a81f2d8f7a61d0e94091) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree | viral band releases the full vault |
| `settle:3` | [0x2c2e9603ec93](https://explorer-studio.genlayer.com/tx/0x2c2e9603ec93b7628cf3af52b3fba003bc83c33a5dd8acdf5919081310ab54d7) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | slash band refunds the brand |
| `refund:curation-1` | [0x5068fa7e8e49](https://explorer-studio.genlayer.com/tx/0x5068fa7e8e49d9f74ba8580896cafb13c822afd0d773e65aabc0c729398380cc) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree | curator pulls the stake back after settlement |
| `guard:curate-after-settlement` | [0x5c90e420564d](https://explorer-studio.genlayer.com/tx/0x5c90e420564d854fedd98d49841d34342d0a6e966fe339528a1a900aa67b8e0b) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | settled campaigns leave the curated feed |
| `guard:transfer-overdraw` | [0x49665d0eecac](https://explorer-studio.genlayer.com/tx/0x49665d0eecac9ec5041ee10be2daa07f992cd81dda768c9a056f0a3686d73149) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree | balance floor holds under an overdraw attempt |

## Final campaign state

| Id | Campaign | Band | Anchor | Creator CPT | Brand CPT | State |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | AuroraLab night serum drop | `BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH` | 0 | 0 | 1650 | SETTLED |
| 2 | PulseFuel morning stack | `TARGET_MET_TIER` | 80 | 1000 | 400 | EVALUATED |
| 1 | NovaGlow winter ritual launch | `VIRAL_BONUS_TIER` | 100 | 2120 | 0 | SETTLED |

Vault invariant: `1610 CPT == 1400 escrow
+ 210 curation`, drift `0`, `ok = True`.

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
