# CreatorPulse

**AI verified brand sponsorship and creator campaign KPI settlement on GenLayer.**

CreatorPulse is a working settlement hub for the creator economy. A brand funds a campaign vault in
CPT, the campaign token. A creator accepts the brief, locks an anti-bot bond, and publishes a
deliverable. Independent GenLayer validators re-render the submitted proof page, verify that the
authenticated brand tag is really disclosed, score the delivery on a four anchor ladder, and agree
exactly on one settlement band. The vault then pays out through a single deterministic helper.

No owner key can score a campaign. No brand can unilaterally approve a payout, slash a creator, or
claw back the viral bonus pool while an audit is pending. The only path from a submitted deliverable
to money moving is live validator consensus.

- Live app: https://richeroveis.github.io/creator-pulse/
- Repository: https://github.com/richeroveis/creator-pulse
- Contract: `contracts/creator_pulse.py`
- Evidence: `evidence/studionet_deployment.json`
- Tag: `studionet-v1`

---

## Why this exists

Creator sponsorships break down over three questions:

1. Did the creator actually deliver what the brief promised?
2. Was the sponsor disclosure really shown, or only claimed in a caption?
3. Is the engagement organic, or bought?

Today those questions are answered in a private spreadsheet by whoever holds the invoice. Creators
wait months for a discretionary decision. Brands overpay for bot traffic. Affiliate managers have no
auditable record.

CreatorPulse turns the decision into a consensus object. Validators fetch the same public proof page,
run the same ladder, and must agree on three fields before a single CPT leaves custody. The payout
band is derived from those fields by one shared pure function, so a validator cannot "agree" on an
anchor and still have the contract pay a different amount.

---

## The steward red lines

### 1. Zero owner, admin or brand bypasses

There is no `owner`, `admin`, `governor` or `operator` storage field, and no public method that can
set a score, approve a payout or slash a creator. A campaign can only be evaluated through
`verify_campaign_deliverable_live`, which runs `gl.nondet.web.render` and
`gl.eq_principle.prompt_comparative`. The test suite parses the contract AST and fails if any such
role or method ever appears.

### 2. A really funded vault, a creator bond and a maximum liability lock

- CPT lives in `token_balances: TreeMap[Address, u256]` and `vault_custody_balance: u256`.
- `create_campaign` debits `base_reward + viral_bonus_pool` from the brand and locks it. That sum is
  the maximum potential liability of the campaign.
- `accept_and_submit_deliverable` debits `required_creator_bond` from the creator into custody.
- `curate_deliverable` locks community CPT behind a deliverable.
- **PAPITO lock:** the brand cannot withdraw the base reward or the viral pool while the campaign is
  still accepting submissions, while a deliverable is awaiting audit, or during the post-audit
  dispute window. `withdraw_campaign_liquidity` is the only reclaim path and it reverts with
  `PAPITO_LIABILITY_LOCK` in all three states.

### 3. A discrete band decided inside consensus

`verify_campaign_deliverable_live` snapshots every settlement input into plain locals before the non
deterministic call. Inside consensus it renders the proof page, rejects a missing authenticated tag,
and asks the model for exactly one of four anchors. Parsing is fail-closed: malformed JSON, a missing
anchor, a non numeric anchor or an out of range anchor reverts the transaction instead of picking a
friendly default. `prompt_comparative` requires exact agreement on `campaign_band`, `quality_anchor`
and `disclosure_verified`.

### 4. One coherent invariant helper

`_compute_campaign_band` is the single source of truth for every split. The auditor, the settlement
gate and the simulator preview view all call it. `_sync_top_curated_campaign` is the single source of
truth for the curated ranking, and settlement re-syncs it so a settled campaign can never stay on the
board. Settlement requires `evaluated == True` and a closed dispute window.

---

## Settlement bands

Let `B` be the base reward, `V` the viral bonus pool and `D` the creator bond. The vault always holds
`B + V` after funding and `B + V + D` after submission.

| Band | Trigger | Creator receives | Brand receives |
| --- | --- | --- | --- |
| `VIRAL_BONUS_TIER` | anchor 100 and disclosure verified | `B + V + D` | `0` |
| `TARGET_MET_TIER` | anchor 80 and disclosure verified | `B + D` | `V` |
| `PARTIAL_DELIVERY_TIER` | anchor 50 and disclosure verified | `floor(B/2) + D` | `B - floor(B/2) + V` |
| `BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH` | anchor 0 or disclosure missing | `0` | `B + V + D` |

Every row satisfies `creator_payout + brand_refund = B + V + D`, which is asserted in the contract,
in the direct tests, and in the live deployment evidence.

Anchors are snapped **down** to the nearest rung. A model answer of 79 becomes 50, never 80. A missing
tag forces anchor 0 regardless of what the model said.

---

## Contract surface

| Method | Type | Purpose |
| --- | --- | --- |
| `faucet_or_deposit(amount)` | write | Capped test faucet, 400,000 CPT lifetime per account |
| `transfer_tokens(to, amount)` | write | CPT transfer with `str` or `Address` coercion |
| `create_campaign(...)` | write | Fund a vault and lock the maximum liability |
| `accept_and_submit_deliverable(id, url)` | write | Lock the creator bond and submit a proof URL |
| `curate_deliverable(id, stake)` | write | Stake CPT behind a submitted deliverable |
| `verify_campaign_deliverable_live(id)` | write | Consensus audit, band and split |
| `claim_campaign_settlement(id)` | write | Release the band after the dispute window |
| `claim_curation_refund(id)` | write | Curator pull refund after settlement |
| `withdraw_campaign_liquidity(id)` | write | Brand reclaim, blocked by the PAPITO lock |
| `get_dashboard(limit)` | view | Stats, campaigns, feed and config in one call |
| `get_campaign(id)` | view | Full campaign snapshot |
| `get_feed(limit)` | view | Curated ranking of evaluated campaigns |
| `get_campaign_band_preview(...)` | view | The shared helper, exposed for the simulator |
| `check_vault_invariants()` | view | Vault equals escrow plus unrefunded curation |
| `get_config()` | view | Guardrail constants and the equivalence principle |
| `get_stats()` | view | Vault, volume, slashes, audits |

Other views: `get_campaign_count`, `get_token_balance`, `get_my_balance`, `get_curator_stake`.

---

## Invariants

- `vault_custody_balance == sum(active campaign escrow) + sum(unrefunded curation stakes)`
- `creator_payout + brand_refund == base_reward + viral_bonus_pool + required_creator_bond`
- A settled or cancelled campaign contributes zero escrow
- A campaign cannot be audited twice, settled twice, or curated after settlement
- A brand cannot submit its own campaign, and neither brand nor creator can curate it
- The faucet is capped per account, rewards and bonds have floors and ceilings, and every deadline has
  a minimum and maximum window

---

## Architecture

```text
Brand wallet                       Creator wallet                  Curator wallets
     |                                  |                               |
     | create_campaign                  | accept_and_submit             | curate_deliverable
     v                                  v                               v
+--------------------------------------------------------------------------------------+
|                           CreatorPulse intelligent contract                          |
|                                                                                      |
|  token_balances: TreeMap[Address, u256]        vault_custody_balance: u256          |
|  campaigns: TreeMap[str, Campaign]             curation_stakes: TreeMap[str, u256]  |
|                                                                                      |
|  verify_campaign_deliverable_live                                                    |
|    1. snapshot storage into plain locals                                             |
|    2. gl.nondet.web.render(proof_url, mode="text")                                   |
|    3. require the authenticated brand tag                                            |
|    4. gl.nondet.exec_prompt(json) -> one of 0, 50, 80, 100                           |
|    5. gl.eq_principle.prompt_comparative on band, anchor, disclosure                 |
|    6. _compute_campaign_band -> creator payout, brand refund                         |
|                                                                                      |
|  claim_campaign_settlement -> credit creator and brand, release escrow               |
+--------------------------------------------------------------------------------------+
                                  |
                                  v
                    studionet validators (5 per transaction)
```

The frontend is a static React bundle. It never computes a settlement for money. The What-If Studio
mirrors the helper for illustration only, and its "Verify against chain" button reads
`get_campaign_band_preview` from the deployed contract to prove the mirror agrees.

---

## Repository layout

```text
contracts/creator_pulse.py          intelligent contract, pinned runner on line 1
tests/conftest.py                   Windows unlink workaround plus fixtures
tests/test_creator_pulse_direct.py  97 direct tests, all passing
scripts/deploy_studionet.py         idempotent live deployment and seeding
scripts/verify_identity.py          4-way sha256 identity check
tools/make_logo.py                  procedural 512x512 logo generator
tools/generate_soundtrack.py        synthesized demo soundtrack
frontend/                           React, TypeScript, Vite, Tailwind, genlayer-js
frontend/public/proofs/             static proof pages fetched by validators
evidence/studionet_deployment.json  deploy address, tx table, state and hashes
docs/                               logo, demo video, evidence notes
```

---

## Quick start

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt

genvm-lint check contracts/creator_pulse.py
pytest tests/ -q

cd frontend
npm install
npm run build
npm run dev
```

Live deployment (needs `GENLAYER_PRIVATE_KEY` in this project's own `.env`):

```bash
.venv/bin/python scripts/deploy_studionet.py --full
.venv/bin/python scripts/verify_identity.py
```

The deploy script checkpoints every step in `evidence/_deploy_state.json` (gitignored) so a network
failure resumes instead of duplicating transactions. Burner keys for the demo brands, creators and
curators live only in that ignored file.

---

## Live studionet evidence

<!-- DEPLOYMENT_EVIDENCE_START -->
### Deployment identity

| Field | Value |
| --- | --- |
| Network | studionet, chain id 61999 |
| Contract | [`0x110C9EFa897A5Eab9b7f8019e70A43EB994f181B`](https://explorer-studio.genlayer.com/address/0x110C9EFa897A5Eab9b7f8019e70A43EB994f181B) |
| Deploy transaction | [`0xee06a0af540cd9ce9c7e75929b6ab6b5a453e0e25102a9fd982b28a617cdaf28`](https://explorer-studio.genlayer.com/tx/0xee06a0af540cd9ce9c7e75929b6ab6b5a453e0e25102a9fd982b28a617cdaf28) |
| Contract file sha256 | `14bf5153b84d7167231d427c2899d97d9514e828efe463d1c274b4e8d4718c33` |
| Deployed code sha256 | `14bf5153b84d7167231d427c2899d97d9514e828efe463d1c274b4e8d4718c33` |
| Runner | `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }` |

Four independent places carry the same code hash: `contracts/creator_pulse.py` on disk,
`evidence/studionet_deployment.json`, `frontend/src/config.ts` and this README. Run
`python scripts/verify_identity.py` to re-check all four, plus the address that appears in the
evidence file and the frontend.

### Transaction table

Every row below was polled to `FINALIZED` and read back through the explorer RPC. Guard probes are
expected to finish with `FINISHED_WITH_ERROR`; the payload column in the evidence file records the
exact revert string.

| Step | Transaction | Status | Result | Execution | Votes |
| --- | --- | --- | --- | --- | --- |
| `faucet:brand_nova` | [0xfac62bcf9b](https://explorer-studio.genlayer.com/tx/0xfac62bcf9bbe6226a52bdbf5f3104e065639049f363ba21bd804fd2bb90de68c) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `faucet:brand_pulse` | [0xcf950464b8](https://explorer-studio.genlayer.com/tx/0xcf950464b873265b9c47ae22cf60a873252be0e2fe017534d121928c8d95bb58) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `faucet:brand_aurora` | [0x6f313017af](https://explorer-studio.genlayer.com/tx/0x6f313017af680c6490f65bdb93a2100c03a80b97b8f0cbb6fbf2a245f4c22a4e) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `faucet:creator_mira` | [0x0ebb2ad0be](https://explorer-studio.genlayer.com/tx/0x0ebb2ad0bee92827d8519561b38544dad042b9e2c74bf3f20a479047ec27b96d) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `faucet:creator_jonas` | [0x7e2752b805](https://explorer-studio.genlayer.com/tx/0x7e2752b805c0be524f3191c7a754e8d9aaa4bc5c213ab5da3b3538036a48e028) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree |
| `faucet:curator_lin` | [0x43bdb12655](https://explorer-studio.genlayer.com/tx/0x43bdb126551b8b4db1505e93db48e54f90aa31b26e5b05c9e3db09b0067850d3) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `faucet:curator_ada` | [0xfc528a95f6](https://explorer-studio.genlayer.com/tx/0xfc528a95f6e557129cbfb3df276d26eea093a5daacb6c018cf6740bbd913f313) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree |
| `create:1` | [0x9b7d5ac8d1](https://explorer-studio.genlayer.com/tx/0x9b7d5ac8d136a63d402c7d5c2d49ec7e309cee56c83d93da16eb610824f94871) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree |
| `create:2` | [0xe65b60927a](https://explorer-studio.genlayer.com/tx/0xe65b60927a2c0cca16072553ae7e955d492f350c2368026607e0f445e17187df) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `create:3` | [0x48a50c2c02](https://explorer-studio.genlayer.com/tx/0x48a50c2c0293c99ffeca842736245bd169fbd565eb669bd17f071af5716c692c) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `submit:1` | [0xb83bd383be](https://explorer-studio.genlayer.com/tx/0xb83bd383be6f393df512f7660d5fee76effcef52f2f3583562ab12bb719f012e) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `submit:2` | [0xfc3276992e](https://explorer-studio.genlayer.com/tx/0xfc3276992eba071ebeaca645efa47d6b27263894fc6449ad34c48d2b530b4991) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `submit:3` | [0x75397b4aa1](https://explorer-studio.genlayer.com/tx/0x75397b4aa1ae5105830bddd7be31e0285516f353a06fe59e2282d59672bedc03) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `curate:1` | [0x6ba52402ab](https://explorer-studio.genlayer.com/tx/0x6ba52402abddd16df6d936b413d7bb39d1729e186f6994c03a2b0f9b0819f1ed) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `curate:2` | [0x1621cdf1c9](https://explorer-studio.genlayer.com/tx/0x1621cdf1c922851cc07a7b8887f889d18cfc76dff32b6b6641dea5a48b050a08) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree |
| `curate:3` | [0xabaf2ed2e7](https://explorer-studio.genlayer.com/tx/0xabaf2ed2e7a36f159b635aa6ea3c17a202904cf24d1fb66bb3815352b3b6abef) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `curate:4` | [0x58744ec625](https://explorer-studio.genlayer.com/tx/0x58744ec62569fe4d3e6382a88e192f6ae2b9d798806cc17e5c10c506e02d924a) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree |
| `guard:clawback-submitted` | [0x1a646d87ec](https://explorer-studio.genlayer.com/tx/0x1a646d87ec75533a308db957119618825ec533a0bf4cc43a8e7550cf2c6663b5) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree |
| `audit:1` | [0x6b903db2dc](https://explorer-studio.genlayer.com/tx/0x6b903db2dcb7c061e5d0d39c091a5786bef41f8e74414212966440394a9ab574) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `audit:2` | [0x2beeebf4d3](https://explorer-studio.genlayer.com/tx/0x2beeebf4d3c1a1da23b22f2a49466b5ad33e52eadbaba50dd19a38677e4725a1) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `audit:3` | [0x2d353812e8](https://explorer-studio.genlayer.com/tx/0x2d353812e8db7bfc2b634d5ba4de774cf7d8a9f0ec3d968d9a3dfb0cdc19b862) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `guard:clawback-evaluated` | [0x3c7c374d54](https://explorer-studio.genlayer.com/tx/0x3c7c374d545cd71ed4bcd46589a4e2dd595c21c218433104fa51daa11fae39a1) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree |
| `settle:1` | [0xb676aa3aee](https://explorer-studio.genlayer.com/tx/0xb676aa3aeeba808092fa4ece1c848c45d02d2264d8d1a81f2d8f7a61d0e94091) | FINALIZED | MAJORITY_AGREE | SUCCESS | 3 agree / 0 disagree |
| `settle:3` | [0x2c2e9603ec](https://explorer-studio.genlayer.com/tx/0x2c2e9603ec93b7628cf3af52b3fba003bc83c33a5dd8acdf5919081310ab54d7) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree |
| `refund:curation-1` | [0x5068fa7e8e](https://explorer-studio.genlayer.com/tx/0x5068fa7e8e49d9f74ba8580896cafb13c822afd0d773e65aabc0c729398380cc) | FINALIZED | MAJORITY_AGREE | SUCCESS | 5 agree / 0 disagree |
| `guard:curate-after-settlement` | [0x5c90e42056](https://explorer-studio.genlayer.com/tx/0x5c90e420564d854fedd98d49841d34342d0a6e966fe339528a1a900aa67b8e0b) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree |
| `guard:transfer-overdraw` | [0x49665d0eec](https://explorer-studio.genlayer.com/tx/0x49665d0eecac9ec5041ee10be2daa07f992cd81dda768c9a056f0a3686d73149) | FINALIZED | MAJORITY_AGREE | FINISHED_WITH_ERROR | 3 agree / 0 disagree |

### Final campaign state

| Id | Campaign | Band | Anchor | Creator CPT | Brand CPT | State |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | AuroraLab night serum drop | `BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH` | 0 | 0 | 1650 | SETTLED |
| 2 | PulseFuel morning stack | `TARGET_MET_TIER` | 80 | 1000 | 400 | EVALUATED |
| 1 | NovaGlow winter ritual launch | `VIRAL_BONUS_TIER` | 100 | 2120 | 0 | SETTLED |

Vault invariant at the end of the run:
`vault 1610 CPT == escrow
1400 + curation
210`, drift
`0`.

The raw machine readable record, including every vote tally, payload and final balance, lives in
[`evidence/studionet_deployment.json`](evidence/studionet_deployment.json).

<!-- DEPLOYMENT_EVIDENCE_END -->

---

## Security model

| Threat | Control |
| --- | --- |
| Brand tries to score or approve its own campaign | No privileged write path exists; scoring only through consensus |
| Brand pulls the viral pool during an audit | `PAPITO_LIABILITY_LOCK` revert in open, submitted and post-audit states |
| Creator fakes the disclosure in a caption | The tag must appear in the rendered page text, checked deterministically |
| Creator buys engagement | Anchor 0 or a bot signal forces the slash band and burns the bond |
| Model returns malformed JSON to force a payout | Fail-closed parsing reverts instead of defaulting |
| Leader picks a self-serving band | `prompt_comparative` demands exact agreement on three settlement fields |
| Validator reads different state | All inputs are snapshotted before the non deterministic call |
| Settlement pays more than custody | Conservation is asserted before any credit and checked by a view |
| Curator games the feed after settlement | Curation reverts once settled, and settlement re-syncs the ranking |
| Replay of a claim | `settled` flag plus state machine block a second release |
| Brand self-dealing | Brand cannot submit its own campaign, neither party can curate it |

---

## Frontend

![CreatorPulse hero](docs/screenshot-home.png)

![Live campaign board read from studionet](docs/screenshot-campaigns.png)

![What if payout simulator verified against the deployed helper](docs/screenshot-simulator.png)

![Consensus and prompt inspector](docs/screenshot-inspector.png)

- Creator economy studio aesthetic on midnight `#0B0716` with magenta, violet and emerald rings.
- Interactive What-If payout and viral bonus simulator with live band, split bars and conservation.
- Consensus and prompt inspector drawer: exact prompt, equivalence principle, snapshot, verdict.
- Security Guard Lab: one click real transaction probes plus a deterministic slash probe.
- Dual wallet: a 1-click browser burner with a locally generated key, or MetaMask.
- Web Audio synthesizer: ambient pad, chord swells and UI cues, generated at runtime.
- One `get_dashboard` call on first paint to stay well under studionet rate limits, and no local ABI
  override is ever passed to `readContract`.

---

## Demo video

`docs/demo-video-subtitled.mp4` is a 48 second 1280x720 walkthrough with a synthesized ambient
soundtrack and burned-in English subtitles. Regenerate it with:

```bash
.venv/bin/python tools/generate_soundtrack.py
```

The MP4 is gitignored on `main` because GitHub Pages and git history should stay small. The
generator and the storyboard are tracked.

---

## Licence

MIT. Test assets only. CPT has no monetary value.
