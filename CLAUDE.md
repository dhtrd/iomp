# CLAUDE.md — IOMP: Multi‑User Inventory System (شركة الضبيبي التجارية / Al‑Dhabibi Trading Co.)

> Written in **English for precision**. The product is **Arabic‑first (RTL)**.
> **ABSOLUTE OUTPUT RULE:** every artifact for the client — UI strings, reports, printed documents, install/handover docs, commit/PR text meant for the client, error messages, and all chat replies — **MUST be in Arabic (RTL)**. Only internal reasoning and code identifiers may be non‑Arabic. Code identifiers, Firestore field names and permission keys stay exactly as defined below (some role keys are literally Arabic strings — keep them Arabic).
> **Last updated:** 2026‑10‑21 (branch review before approval behind flag `branchReview`; ج٢ source icons + wide screens; global listener re‑attach).

---

## 0 · MISSION

You are a senior engineer continuing development on **IOMP**, a production inventory‑count system for **Al‑Dhabibi Trading Co.** (multiple branches, each with **1500+** products; physical counts run nightly ~9 PM–1 AM Saudi time). The system is **live**, in a **pre‑production hardening phase**. Correctness of every inventory number is the top priority. Client rule: **"If a single number can become wrong, treat the bug as critical."** Be surgical, test‑driven, and never break deployed behavior.

## 1 · IMMUTABLE CLIENT CONSTANTS

1. **All client‑facing output is in Arabic.**
2. **Do NOT change business logic, calculations, reports, or permissions** unless the client explicitly asks for that specific change. In particular:
   - The scanner is **always ready for the next scan**; **no extra manual steps after a scan**.
   - **Consecutive identical scans each add +1** (four scans ⇒ +4). **NO time‑debounce.** The only suppressed duplicate is the *same DOM event processed twice* (`_scanEvtSeen`, object identity), never by time.
3. **Large features = analysis/mock‑ups FIRST, explicit written approval, THEN implementation.** Direct bug‑fixes may ship immediately *with tests*.
4. **Every delivery = only the changed files + an Arabic install/handover doc (`وثيقة تركيب`)** + update the **test count** in `README.md` and `.github/workflows/ci.yml`.
5. **NEVER put secrets in chat/replies.** Never echo `firebaseConfig` fields or the `OWNER_EMAIL` value.
6. **Preserve 100%:** existing logic, identifiers, RTL layout, printing. **CI is the sole judge of Firestore rules.** Measure the rules ceiling on any `firestore.rules` change.
7. **Deploy size ≤ 200,000 bytes gzipped**, measured on the **deployed** file (`node build_deploy.js` ⇒ `gzip -c < _site/index.html | wc -c`) — currently **195,112** (tested `index.html` = 201,763 — the readable tested file may exceed 200 KB; only the deployed file is capped). `build_deploy.js` fails (and CI does not deploy) above the ceiling. New large UI still goes into a lazily loaded file (precedent: `branch-review.js`).
8. **`firestore.rules` is not touched except by explicit decision**, validated only by CI/emulator.
9. **Before trusting an adversarial edge case, get an independent review** of any change to the count/queue/sync paths (the 2026‑10 change needed three review rounds; see §12).

## 2 · ARCHITECTURE & MANDATORY BUILD CYCLE

Single‑file web app, no framework (inline CSS + vanilla JS).
- **`index.source.html`** = documented source of truth. **Edit ONLY here.**
- **`node build_release.js`** → generates **`index.html`** (comments stripped via `acorn`) and proves byte‑for‑byte code identity. Expected: `التحقّق : الشيفرة متطابقةٌ حرفًا بحرف …✓`. **Never add a `// comment` at the end of a fragment that is followed by more code on the same line** (it silently comments out the rest — a real 2026‑10 incident caught only by the parser).
- **`node build_harness.js`** → `harness.html` (instrumented, gitignored).
- **`node run_all_tests.mjs`** → must finish **`TOTAL: 1757/1757 — ALL GREEN ✓`** (64 `test_*.mjs`, sequential, fails on first red file).
- **`node build_deploy.js`** (2026‑10‑21, owner choice «ضغط المسافات عند البناء») → `_site/index.html`: terser `compress:false, mangle:false, keep_quoted_props, ecma 2020` on the module script only; head/tail (HTML/CSS) byte‑identical; proves **acorn AST equality** (positions dropped; tolerated only `{a}`≡`{a:a}` except `__proto__`, and numeric non‑computed key `30`≡`"30"`). Runs in the CI deploy job. Tests and harness keep using the readable `index.html` (harness patches are text‑based). Pinned devDeps `acorn@8.19.0`, `terser@5.36.0`. Tested by `test_deploy_build.mjs` (16: build+proof, head/tail identical, ceiling, no renamed declarations, both files boot in Chromium with a neutral Firebase stub and render the identical login DOM, comparator self‑tests incl. directive/template‑raw/`<!--` detection).

```bash
npm install && npm install --no-save acorn
export CHROME_EXE=$(node -e "console.log(require('playwright-core').chromium.executablePath())")
# cloud fallback: export CHROME_EXE=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
node build_release.js && node build_harness.js && node run_all_tests.mjs
node build_deploy.js          # deploy file + AST proof; fails above 200000 gz
```
**Harness caveats:** in the HOOKS template write `[0-9]` not `\d`. The س٥/س٦ group in `test_scanflow` is load‑sensitive — rerun alone before calling it a regression. Headless Chromium on `file://` can **lose localStorage between page loads** — tests that simulate a reload must copy device storage explicitly (see `reloadLike` in `test_quota_exhaust.mjs`), never rely on navigation persistence.

**CI/CD:** push to `main` ⇒ app tests + Firestore rules tests (emulator) ⇒ on green, deploy to **GitHub Pages**. Rules must also be published manually in the Firebase console.

## 3 · GOVERNING NUMBERS (update on every delivery)

| Item | Value |
|---|---|
| Tests | **`TOTAL: 1757/1757 — ALL GREEN ✓`** (64 files) · rules emulator **141/141**. Note: README previously said 1540 while the real pre‑change total was 1526 — documentation drift, fixed. |
| Deploy size | **195,112 bytes gzipped** (deployed `_site/index.html` after `build_deploy.js`; tested `index.html` = 201,763; `branch-review.js` and `queue-io.js` are separate) — ceiling **200,000** |
| `firestore.rules` | **31,499 bytes** — `branchReview` subcollection + mandatory gate (2026‑10‑21) |
| Hosting | GitHub Pages via CI · Firebase **Spark (free)** |

## 4 · TECHNOLOGY STACK

Vanilla JS + inline CSS; RTL. **Firebase 10.12.5** (`app`/`auth`/`firestore`, from gstatic; imports now also include `getDocFromCache`, `getDocsFromCache`). Auth = email/password; Cloud Firestore with `persistentLocalCache` + multi‑tab manager. Lazy libs: XLSX 0.18.5 (`loadXLSX`), ZXing 0.21.3 (`loadZXing`). Font: IBM Plex Sans Arabic. PWA: `manifest.webmanifest` + `sw.js` (`iomp-shell-v1`). CSS tokens on `:root`, dark via `[data-theme="dark"]`. Numbers: `fmt()` Western digits, `fmtDateTimeAr()` Arabic‑Indic, `numv()` parses Arabic‑Indic/`٫`.

## 5 · ROLES & PERMISSIONS

Built‑in roles (Arabic keys, keep exactly): **`مدير`** · **`مدير مخزون`** · **`عدّاد`** · **`مطّلع`**; custom roles via `customRoles`. `can(cap)`: owner ⇒ all; else per‑user override ⇐ role setting ⇐ `DEFAULT_CAPS`; requires `active`. `مدير` always holds `perms.manage` + `users.manage`. 34 capability keys (`CAPS`) incl. `count`, `session.*` (incl. `session.branchReview`), `report.*`, `reason.*` (branch/detailed/committee/mgmt/varianceSummary/handover/custody/upload), `warehouse.manage`, `stock.move`, `branch.manage`, `users.manage`, `perms.manage`, `trash.*`, `pw.*`. `عدّاد` = `count` only; `مطّلع` = view/export/pw + `reason.branch`, no finance (`FIN_COLS` hidden). Server enforcement mirrors `can()` in `firestore.rules`; UI is not a security boundary.

## 6 · SCREENS

`renderNav()` tabs: `home`, `sessions`, `warehouses`, `users`, `settings` (perms), `admin` (م18), `trash`, `reports` (م19), `branches` (م17, flag), `products` (م15, flag), `catalog` (ط‑11, on by default). Counting screen = `renderCountingShell`/`renderCountList`, opened from sessions.

## 7 · COUNTING / SCAN FLOW

Scan engine: cadence capture (`SCAN_CADENCE_MS=40`, `SCAN_IDLE_MS=60`, `SCAN_MIN_LEN=4`, `SCAN_RUN_RESET_MS=700`, `SCAN_PROOF_GAPS=2`, `SCAN_LATE_MS=25`), verify‑before‑commit, single‑consumer FIFO (`scanCommit → scanQueue → scanPump → scanStep → addEntry(code,1,{run:true})`). **+1 / no‑debounce rule** — do not add debounce. Run merging (`×n`) for consecutive scans by the same counter; **manual entry never merges**. `scanPanel` = persistent 8‑field live card (zero reads). Blind mode hides book/diff. Unknown barcode ⇒ `unkLog` + manual item route. `findByScan`: exact ⇐ strip leading zeros ⇐ digits‑only.

**Source tagging (2026‑10, client request):** every count entry carries `src: 'scan' | 'manual'`.
- `scan`: external scanner burst (cadence), camera, scanner into the «أضف» field, bulk‑injected/pasted code.
- `manual`: typed quantity in «أضف» (`addFrom`), or a code typed by hand in the search box + Enter — classified on `input` events (works with phone keyboards where keydown is `Unidentified`): manual iff more than half the characters arrived with gaps > `MAN_KEY_MS=100` (`_hk`); `insertReplacementText` ⇒ manual. Job `src:'hand'` ⇒ `addEntry(...,{man:true})`.
- Manual adds call `runBreak()` (never merge into or across a scan run). `entrySrc(e)`: `manual`⇒m; `scan` or merged run (`n>1`/`mrg`)⇒s; else u (legacy). `srcSplit`. **Display (ج٢, 2026‑10‑21, owner‑approved, no flag):** `srcIc(k)` renders an SVG sprite icon (`#ic-bc` barcode = scan, `#ic-pen` pen = manual, none = legacy) before each chip number on the count screen and next to «المعدود» / each «من أضاف» part on the on‑screen variance report (`whoDetail(w,true,1)` via `repAgg` `qs/ss`). Print and Excel keep `whoDetail(w,…)` text with «✍n» unchanged. From 1024px up, **every tab** fills the width beside the sidebar (`#appContent{max-width:none}`, owner request 2026‑10‑21); below 1024px the 900px layout is unchanged. `body.wide` (set in `renderCountingShell`/`openVarianceReport`, cleared in `_route`) now only turns `#clist` into a 2‑column grid.

**Row‑diff rendering (البند ١, 2026‑10‑21):** data‑change paths (counts listener via `renderCountListLive`, `addEntry`, `pendDrop`, scan‑idle flushes) call `renderCountListDiff()`: it recomputes `countRowHtml` for the visible ≤300 rows and replaces only rows whose HTML differs from the cache `_rclRows` (kept by `renderCountList`, and by `patchCountRow` at the row's real DOM index — safe with duplicate codes). Any change in visible membership/order/blind/frozen (`rclKey`) ⇒ full `renderCountList()`. Output is byte‑identical to a full render. `#clist>.sess{content-visibility:auto}` (≥1024px only — no guaranteed scroll anchoring on mobile Safari) skips offscreen layout. Measured at 1500 items: remote update 372 → ~40–65 ms, own scan 396 → ~55–75 ms.

## 8 · SESSION LIFECYCLE

`open → review → reviewed → [fin_approved] → approved`; `started` flag separates prep from counting. Single‑signature or three‑step chain (م14, `approvalChainOn`). Signatures `SIG-` (SHA‑256 / FNV fallback).

**Branch review before approval (2026‑10‑21, owner‑approved spec «ورقة-اتفاق-مراجعة-الفرع-قبل-الاعتماد», flag `features.branchReview`, default OFF):** UI lives in **`branch-review.js`** (lazy `brLoad()`/`brOpen(mode)`, `?v=BR_V` — bump `BR_V` on every change to the file; deployed by CI next to `index.html`). Reviewer = `brCan(s)`: flag + cap `session.branchReview` (34th cap; مدير default true, others false — rules `defCap` excludes it for مدير مخزون) + session location in `userLocations` (owner bypasses) + `canSeeSessionData` (so also grant `report.view.location`). Steps = each counter's entries sorted by `at`, consecutive same code merged; same code elsewhere = another step («الموضع i من n», time order). **Notes only — never writes counts.** Storage: `sessions/{sid}/branchReview/p_<counterUid>` `{u,m:{<uid>_<firstEntryId>:{c,v:'ok'|'diff',a,nt≤200,cq,at}},by,byName,at}` (batched: 20 marks / 6 s / submit / leave / hidden; unsaved count shown; transient failure ⇒ retry, permanent/left review ⇒ one toast + stop) and `__brmeta` `{submitted,by,byName,at,closedAt,steps,ok,diff,notes}`. A mark is valid only while its step qty equals `cq`. Gate: `doMarkReviewed` and the rules (`brSent`) require `__brmeta.closedAt == session.closedAt` when the flag is ON (re‑close ⇒ resubmit). Submit requires a server‑confirmed counts snapshot (`ctx.snapMeta` = raw `_fsOnSnapshot` with `includeMetadataChanges`, shares the watch target). Manager sees «📝 ملاحظات الفرع» (`session.review`). Admin Center «⚙ تجهيز حسابات الفروع للمراجعة» (`IOMPBR.setup`, owner request): lists active non‑owner users with ≥1 assigned location, grants only missing caps as per‑user overrides via `setDoc` merge (`session.branchReview`, plus `report.view.location` if the user sees no reports); counters (`عدّاد`) unchecked by default; already‑ready users shown «✓ جاهز»; nothing revoked; re‑press for new accounts. Purge skips `branchReview` if unreadable. Included in the in‑app Dropbox full backup (`dbxBuildFullBackup`) and in the scheduled cloud backup (all subcollections).

## 9 · REPORTS & EXPORT

`computeVariance(items,counts)` — per item `book/counted/cost/diff/status/varValue/bookValue/countedValue/who/entries` **plus additive `scanQty`, `manQty`, `unkQty`** (`unkQty = counted − scan − manual`, so the three always sum to `counted`). No existing field changed. `summarize()`, `REPX_*` unified reports. Export: `excelSheetFromCols` (supports a `'src'` placeholder ⇒ `srcCols(rows)` = بالقارئ/يدوي + «غير مصنّف» only when legacy data exists), `exportDetailedAoa` (source columns **appended at the end**, with totals and summary rows), `EXPORT_REASONS.branch` ends with `'src'`. `whoDetail` marks manual parts `✍n`. Print: `PRINT_COLDEF` has `scanQty/manQty/unkQty`; `DOC_COL_KEYS` lists them last — **opt‑in only; default print layout unchanged**.

## 10 · DATA MODEL (Firestore)

`config/permissions` (central doc: roles, users, warehouses, settings, features, approvalChain, …), `config/appearance`, `config/dropbox`, `users/{uid}`, `sessions/{sid}` (+ `counts/{code}` `{code, qty, entries:[{id,q,by,byName,at,n?,endAt?,lastEid?,src?}], lastByName, lastAt}`, `itemNotes`, `snapshot/chunk_NNNN` (400/chunk, items `{code,barcode,name,category,unit,book,cost}`), `extraItems`, `activity`), `counters/movements`, `movements`, `branches`, `products` (+history), `catalogMeta/catalogChunks/catalogImports`. Terminal deny rule. Writes append‑only where possible; corrections are reverse entries. `src` inside entries is not constrained by rules.

## 11 · FEATURE FLAGS (`config/permissions.features`, default OFF unless noted)

`suppliers`, `warehouseLedger`, `branches`, `productCatalog`, `masterCatalog` (**ON**), `offlineCount`, `dropboxBackup`, `sessionSummary`, plus `approvalChain`, `viewersAfterClose`, `branchReview`. New features start behind an OFF flag.

## 12 · OFFLINE, QUOTA EXHAUSTION & SYNC (behind `featuresOfflineOn()` = `offlineCount`)

Device queue `offlineStore` (IndexedDB in production; localStorage fallback on `file://`), key `iomp-offline-queue`. Ops `{seq, op(add|dec|remove|reset|note|additem), code, sid, deviceId, at, val?, eid?, src?, run?, index?, log?, uid}`.

**2026‑10 resilience layer (tested by `test_quota_exhaust.mjs`, 40 checks):**
- **Cache fallback reads:** `getDocSafe`/`getDocsSafe` fall back to `getDocFromCache`/`getDocsFromCache` on connection/quota errors (`offlineIsConnErr`). Boot profile + `loadPermConfigOnce` always (so the flag itself is readable); session doc/snapshot only when the flag is on. A cached item list whose length ≠ `curSess.itemCount` is rejected. Missing cache ⇒ explicit error + «إعادة المحاولة».
- **Display = server + pending + this device's queue:** `_srvCounts` (listener mirror) ⇒ `cntRebuild()` = clone + `pendReapply()` + `oqReflect()` over the in‑memory queue mirror `_oq` (own ops of `curSid`; adds deduped by `id`/`lastEid`; removes skipped when the entry is gone). Fixes audit **ع‑4** (unsynced counts showing 0 after refresh ⇒ double count). `cntOpen()` loads `_oq` before first render.
- **Queue integrity:** every queue read‑modify‑write goes through `oqLocked()` (in‑tab promise chain + `navigator.locks` `'iomp-oq'` across tabs); `oqDrop(op)` matches `seq+at+op+code`; `BroadcastChannel('iomp-oq')` refreshes other tabs. `offlineFlush` = cross‑tab single flusher (`navigator.locks 'iomp-oq-flush'`, `ifAvailable`) ⇒ `offlineFlush0`, which drains in passes (ops added during a flush are flushed in order), stops if signed out, writes queued activity logs (`op.log`, incl. adjustment reasons) **after** `oqDrop` (fire‑and‑forget), skips other users' ops (`oqOwn`), and **skips per item** on a connection error (keeps that item's order) — it breaks only on a real outage (quota error or two different items failing in a row).
- **Per‑item ordering & degraded mode:** `offDirect(code)` = flag && (offline || `_qDown` active || `oqHas(code)`). After a quota error `qDownFor()` routes writes straight to the queue for `OFFLINE_RETRY_MS` (5 min; 30 s for other connection errors) — because the real SDK retries a failing transaction ≈5× (~8 s per scan). `oqKick()` flushes 600 ms after an enqueue once the window expires.
- **Auto sync:** `offlineAutoTick()` every `OFFLINE_RETRY_MS`, on tab visibility, 1 s after boot, plus the `online` event. Auto failures are quiet (`offlineFlush('auto')`); every 6th non‑quota failure shows an explicit error. Full drain clears `_qDown` and re‑attaches dead listeners via `cntReattach()` (no shell re‑render, waits for scan idle, only on the counting screen; also from the tick when the queue is empty).
- **Global re‑attach (2026‑10‑21, `test_listen_reattach.mjs`, 12 checks):** the `config/permissions` listener (`_permDead`) and the visible session‑list listener (`listDied` → `_listRe = {node, fn}`) are re‑attached by `globalReattach()` at the same recovery points as `cntReattach` (and on every tick when the flag is OFF, which also calls `cntReattach`). Perm re‑attach re‑renders only if the config changed and the snapshot is not `fromCache` (no periodic re‑render during an outage). Session‑list listeners (counter/viewer home, sessions tab) are **managed** via `listOwn()` → `_listUnsub`, torn down in `_route()`, `openSession`, `openVarianceReport` and `stopPermListener` (previously leaked and were billed per visit). Dashboard unsubscribes its old `sessUnsub` before re‑listening.
- **Deleting queued (⏳) quantities (2026‑10‑24, owner request):** entries reflected from the device queue carry `oq:true` (new entry) or `oq:'m'` (queued scan merged into a run already on the server); × is shown when `!frozen && (!pending || (oq && no _pendingAdds for the code))`; `data-delp` ("saved on your device" confirm text) only for `oq===true`. The click passes the entry id: `removeEntry(code,index,eid)` re‑resolves the line by id **after** the dialogs (gone ⇒ warning, nothing deleted); online path deletes by id via `countWriteRemove(...,-1,eid)`; offline path queues `remove` by that id behind the add. Legacy entries without id keep the index path.
- **Activity time of queued ops (2026‑10‑24, owner request):** `offlineFlush0` writes `countedAt: op.at` (device time of the count) beside `at: serverTimestamp()` (arrival; ordering/audit unchanged); `renderActivity` shows «عُدّت: <countedAt>» plus a small «وصلت الخادم: <at>» line. Other activity views (Admin Center, unified audit) still show `at`.
- **Count‑loss protection layers (2026‑10‑24, spec «ورقة-اتفاق-حماية-العد-من-الضياع», behind `offlineCount`):** أ `storagePersist()` (navigator.storage.persist on counting‑shell open); ب `appInstalled()`/`isIOS()` + captured `beforeinstallprompt` (`_bip`); ج static «لا تعدّ في نافذة التصفّح الخاص» line (detection impossible by design — owner decision); all shown in `#safeNote` + «🛡 حماية العدّ» button ⇒ lazy **`queue-io.js`** (`qioLoad`/`qioOpen`, `?v=QIO_V`, deployed by CI) status dialog. د `offlineStore` mirrors `iomp-offline-queue`/`iomp-offline-seq` to localStorage `iomp-oq-mirror`/`iomp-oqseq-mirror` on every set (mirror removed if its write fails); `get` restores from mirror when IDB read throws or the key is missing while the mirror has ops, rewrites IDB, and `offlineRefreshLen` toasts the restore. هـ idle: `idleSync()` reads the shared localStorage stamp (activity in any tab counts; `storage` event closes another tab's warning; `_idleBase`), timers call `idleWarnDue`; `idleGoOut` (async) does **not** sign out while own queued ops exist (toast every 10 min); `safeLogout()` confirms when own ops are queued (confirm, not hard block — avoids locking shared devices); `beforeunload` warns while `_offlineQueueLen>0`. Layer و (export/import) postponed to its own PR after the independent review found double‑apply risks (run‑merge `lastEid` guard, overlapping files, multi‑session resume, seq reset).
- **Listener death:** counts listener error ⇒ `_cntDead`; if nothing was ever received, counts are loaded from cache, else a persistent warning. Chip shows «— ⚠ قد لا تظهر عدّات الأجهزة الأخرى…».
- Quota counter (`iomp-quota-<date>`, read 50k / write 20k). Spark quota resets at midnight Pacific (10:00 KSA in PDT, 11:00 in PST).
- **Known limits:** protection requires the flag; a device that never opened the session before exhaustion cannot start counting; the queue is per device/browser (no private windows); during exhaustion devices don't see each other's counts.

## 13–17 · CATALOGS, BRANCHES/LEDGER, ADMIN/NOTIFICATIONS, PRINT, BRANDING

Unchanged from the previous spec: product catalog م15 (`products`, variants, `PX_STATUSES`, ABC/XYZ), master catalog ط‑11 (chunked, O(1) index, `ca13Try`), branches م17 (`brx*`), ledger م16 (`movements`, `MV-NNNN`, no delete), Admin Center م18 (backup with checksum, integrity check), Notification Center م20 (derived from sessions), print engine ط‑22 (fixed mm pages, density presets, real «صفحة i من N»), branding (`BRAND_DEFAULTS`, custom logo). Do not regress the ط‑22b page counts.

## 18 · TESTING & MEASUREMENT

64 test files → `run_all_tests.mjs` (1757). `test_count_safety.mjs` (21, served over http://127.0.0.1 so real IndexedDB works: cross‑tab idle, no idle logout with own queue, logout confirm, beforeunload, mirror restore after IDB key loss without duplicates, safety bar/dialog, iPhone install hint, flag OFF unchanged); harness hooks `__idleLastMem`, `__signOuts`. `test_pending_cancel.mjs` (33: queued ⏳ entries deletable during quota exhaustion, reason + confirm, survives reload, run «إنقاص واحد», sync ⇒ server = screen, activity log with reason, flush during dialog never hits a colleague's entry, mixed server/queue run, online delete by id equivalence, entry vanished during dialog ⇒ nothing deleted). `test_branchreview.mjs` (60: per‑counter path order, multi‑location steps, src/added/edited badges, search incl. arNorm, batched per‑counter saves + visible unsaved/failed state, submit gate & stale meta after re‑close, notes screen, flag OFF = unchanged, other branch denied, cache‑only counts block submit, permanent denial stops retries, 390px); harness hooks `__failWrite(path,true|'perm')`, `__cacheOnly(b)` (includeMetadataChanges listeners). `test_rowdiff.mjs` (5: one remote update replaces exactly one card; 200 consecutive random ops (remote, scans, search, notes, removeEntry, reset, duplicate code) compared with `__rclExpect()` without resetting the cache; duplicate code shows the same total on both cards; focus/value kept; membership change ⇒ full render); hooks `__rclFull`, `__rclDiff`, `__cntRebuild`, `__rclExpect`. `test_srcicons.mjs` (20: ج٢ source icons on count chips + report «المعدود»/«من أضاف», wide layout 1440/1024/768/390, print & Excel unchanged, other screens keep 900px). `test_listen_reattach.mjs` (12: perm/list/dashboard re‑attach, no re‑render storm, form input kept, no duplicate/leaked `sessions` listener, flag‑off path); hooks `__permCfg`, `__lisN(path)`. New in 2026‑10: `test_quota_exhaust.mjs` (40: boot/open from cache, queue reflection after reload, auto sync, degraded mode, ordering vs queued reset, lock under concurrent scanning, per‑item stuck isolation, audit log after sync, other‑user ops), `test_srcmark.mjs` (24: real keyboard timing scanner vs hand, phone keyboard, camera, offline, exports, legacy). Harness additions in `build_harness.js`: `__quotaOut(b)` (reads/transactions/listeners reject `resource-exhausted`, listeners die), `__cacheMiss(b)`, `getDocFromCache`/`getDocsFromCache` stubs, `__txCalls`, `__failRead` also fails transactions on that path, hooks `__me`, `__cntEntries`, `__qtyOf`, `__autoTick`, `__retryMs`, `__varRows`, `__qDownClear`, `__offChip`. Measurement scripts are read‑only — never modify.

## 19 · KNOWN PENDING WORK

Fixed already: ح‑1..ح‑4; **ع‑4** (reflection after refresh); multi‑tab queue races (lock + single flusher). Still open (P1 unless noted): **ع‑1** negative manual quantity bypasses the adjustment‑reason gate; **ع‑2** unified reports don't dedup sessions (inventory value can double) — needs client decision; **ع‑3** Excel totals vs line rounding; **ع‑5** blind/finance hiding is client‑side only (architectural, approval first); **ع‑6** silent offline‑save failure; mediums m‑4 (CSV formula injection), m‑8 (rejected‑ops log has no recovery screen). Non‑audit: proactive 80% quota warning; Blaze decision (one Firebase project vs per branch); category filter B→D; manual print check on Firefox/Safari; legacy queued ops without `uid` are treated as the current user's.

## 20 · SECURITY

Never output `firebaseConfig` fields or `OWNER_EMAIL`. Inventory data, emails and costs are confidential. Permission changes must be reflected in `firestore.rules` and validated by CI.

## 21 · OPERATING LOOP

1. Read the relevant source + this file first; cite function names (Arabic analysis to the client).
2. Bug‑fix: edit `index.source.html` → `build_release.js` (identical ✓) → `build_harness.js` → `run_all_tests.mjs` all green (add tests; update the total everywhere) → gzip < 200,000.
3. Large feature: Arabic analysis/mock‑up, wait for approval, ship behind an OFF flag.
4. Rules change: `measure_rules_ceiling.mjs`, emulator tests, CI decides.
5. Deliver changed files + Arabic install doc + updated counts. Work on a branch and open a PR unless the owner says to commit to `main`.
6. Arabic to the client. Never leak a secret.

*When this file and the code disagree, the code wins — read it.*
