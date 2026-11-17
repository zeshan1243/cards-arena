# CardArena: Google AdSense Readiness Audit

**Site:** https://www.cardsarena.world
**Audit date:** 17 November 2026
**Scope:** the live site and the full frontend codebase (`frontend/`), including all 23 game engines compared with their published rules.

---

## 1. Executive summary

The site's content is strong for AdSense purposes: 23 working games, and each game page carries 900–1,400 words of server-rendered, original rules and strategy text. The technical SEO foundations are also sound.

The most likely cause of the AdSense rejection was **advertising, not content**:

- A second, low-quality ad network (Adsterra) ran banners on every page.
- An Adsterra "smartlink" in the footer sent visitors to unknown third-party pages.
- Ads were placed directly above the "Play again" buttons in every game-over dialog.

All of these have been removed.

Other issues found and fixed in code:

- Made-up URLs returned a copy of the homepage with HTTP 200 (soft 404s).
- One page served the wrong HTML.
- Eleven game pages showed text about another game.
- A number of written rules contradicted the actual game code.
- The site had no consent defaults for visitors from Europe.

**Readiness:** once deployed and the manual steps in section 9 are done, the site is in a reasonable position for an AdSense review. Approval is never guaranteed; Google's decision also depends on factors outside the code, such as traffic, domain age and how the reviewer judges the site.

| Severity | Found | Resolved in code | Needs manual action |
|---|---|---|---|
| Critical | 2 | 2 | deploy |
| High | 5 | 5 | 2 partly manual (H1 verify, H4 consent message) |
| Medium | 7 | 6 | 1 (M7) |
| Low | 5 | 4 | 1 (L5) |

---

## 2. Pages audited (29 indexable + app screens)

| Route | Type | Status |
|---|---|---|
| `/` | Home, prerendered | OK |
| `/games` | Catalogue, prerendered | OK |
| `/games/{23 slugs}` | Rules and strategy pages, prerendered | Content fixed (see section 4) |
| `/about`, `/contact`, `/privacy` | Prerendered | Privacy corrected |
| `/terms` | **New**, prerendered | Added |
| `/play/{23 slugs}` | Game screens, client-rendered | Canonical points to `/games/{slug}`. OK |
| `/settings`, `/progress` | Client-rendered, noindex | `/progress` served the wrong HTML; fixed |
| `/login`, `/register`, `/profile`, `/statistics`, `/history`, `/leaderboard`, `/multiplayer` | Redirect to `/` (accounts are switched off) | Disallowed in robots.txt. OK |
| Any unknown URL | Should be 404 | Served the homepage; fixed |

**Game count:** 23 on the homepage, About and /games, all generated from one list (`core/data/games.data.ts`). I found no inconsistency.

---

## 3. Findings

Status key: ✅ fixed in code (live after deployment) · ⚠️ needs manual action.

### Critical

| ID | URL | Source | Problem | Fix | Status |
|---|---|---|---|---|---|
| C1 | All pages | `public/ads/*.html`, `shared/components/ad-banner/`, `app.ts`, `footer.ts` | Adsterra banners (`bauval.org`) on every page, plus a footer "Sponsored" smartlink (`araplhn.org`) that redirects to unknown advertisers. This is a common reason for AdSense rejection. | Removed the Adsterra files, the component and every placement. AdSense is now the only ad code. | ✅ |
| C2 | All `/play/*` | 12 game templates (`modal-ad`) | A 320×50 banner directly above "Play again" in every win/lose dialog, which invites accidental clicks. | Removed. | ✅ |

### High

| ID | URL | Source | Problem | Fix | Status |
|---|---|---|---|---|---|
| H1 | `/anything`, `/games/bogus` | `vercel.json` | Unknown URLs returned HTTP 200 with a copy of the homepage, creating duplicate pages. | Catch-all rewrite to `404.html`, which renders "Page not found" with `noindex`. | ✅ (check after deploying; see section 9) |
| H2 | `/progress` ("My stats") | `vercel.json` | Served the prerendered homepage HTML, which Angular then rebuilt into a different page. | Added to the client-rendered rewrites. | ✅ |
| H3 | 11 game pages | `pages/game-detail/game-detail.html:63` | The fallback "Play against AI" paragraph said "…estimate the risk of a **Thulla**" on Hearts, Spades, 29, Court Piece and others. | Each game now has its own AI description, written from its bot code; the fallback is neutral. | ✅ |
| H4 | All pages (EEA/UK/CH visitors) | `core/services/analytics.service.ts`, `pages/privacy/privacy.ts` | No consent setup in the code; Google Analytics ran before consent; the privacy policy promised a consent prompt that didn't exist. | Consent Mode v2 now defaults to "denied" in the EEA, UK and Switzerland before Analytics loads, and the policy wording matches. | ✅ code / ⚠️ consent message (section 9) |
| H5 | Several game pages | see section 4 | Written rules contradicted the game code (Farkle four 1s, Sudoku "no guessing", Seep player count, Baloot melds and levels, Bhabhi variants, Donkey hand size, Klondike recycling, Checkers AI depth). | Corrected against the engines. | ✅ |

### Medium

| ID | URL | Source | Problem | Fix | Status |
|---|---|---|---|---|---|
| M1 | Game pages | `*.content.ts` | Scoring, target and tie/end rules existed in the code but not on the indexed page. | Added for every affected game. | ✅ |
| M2 | `/games/court-piece` | `court-piece.content.ts` | Thinnest page (~384 content words); its FAQ repeated How to Play. | Expanded with scoring, match target, rotation and early stop; new FAQ and tips. | ✅ |
| M3 | All 23 game pages | `*.content.ts` | Each FAQ included a "Can I play X online for free?" marketing question, also output as FAQ structured data. | Replaced with real rules questions. | ✅ |
| M4 | Solo games | `game-detail.html:65` | One generic text on every solo game; Sudoku's written note never showed. | Each game's own note now renders for solo games too. | ✅ |
| M5 | `/`, `/games` | `home.html`, `games.ts` | "Most played" was based on invented popularity numbers. | Renamed "Popular picks"; removed the "Most played" sort option. | ✅ |
| M6 | `/games` (Newest sort) | `games.data.ts` | 9 playable games had release dates in 2026-12 to 2027-07. | Set to their real first-commit date, 2026-10-15. | ✅ |
| M7 | `/play/*` | AdSense dashboard | Once approved, Auto ads (anchor and vignette) could cover the game table. | Exclude `/play/*` from Auto ads. | ⚠️ |

### Low

| ID | Source | Problem | Fix | Status |
|---|---|---|---|---|
| L1 | `footer.ts` | Footer "Regional games" showed 6 of 8 (Tarneeb and Baloot missing). | Shows all 8. | ✅ |
| L2 | `privacy.ts` | Google Analytics data described as "anonymous" (it uses a pseudonymous identifier). | Reworded accurately. | ✅ |
| L3 | `thirteen.content.ts` | The alias "Viet Cong" and the claim "national card game of Vietnam". | Alias removed; claim softened to "widely played". | ✅ |
| L4 | `war.content.ts`, `hokm.content.ts`, `twenty-nine.content.ts` | Unverifiable numbers ("~200 battles", "5–10 minutes") and an unsourced "traditional" claim. | Removed. | ✅ |
| L5 | `/about` | The site doesn't say who runs it (a trust signal). | Add owner or company name and country. | ⚠️ |

---

## 4. Game pages: findings and changes

Every fact added was checked against the game's engine, definition or bot code.

| Game | Errors corrected | Rules added | Other |
|---|---|---|---|
| Bhabhi Thulla | Said there were 2 rule sets; there are 3 (Open start: a random player leads any card). | Scoring (first out (n−1)×5, Bhabhi −10), Aces high, who leads after an escape. | New FAQ: "Who leads after a Thulla?" |
| Court Piece | n/a | 1 point per hand, Court = 3, target 3/5/7, dealer rotation, hand stops at 7 tricks. | Expanded; FAQ that repeated How to Play replaced. |
| 29 | n/a | Pair adjustment kept between 16 and 28 (one per hand); a bid of 28 ends the auction. | Unsourced "last-trick point" claim removed. |
| Seep | Description said "four players" (supports 2 or 4); Casino called "Indian" (it's European). | One combination per capture. | n/a |
| Call Break | n/a | Tie for the top = draw. | n/a |
| Hokm | n/a | A match can't end in a tie. | "5–10 minutes" claim removed. |
| Tarneeb | n/a | All-13 with a lower bid scores 13; target, tie and 40-deal rules. | n/a |
| Baloot | "Melds" claimed (not implemented); "three levels" (there are four); Baloot scores when K+Q are *played*, not just held. | Target 101, tie and 250-deal rules. | n/a |
| Spades | n/a | Double Nil; 50-hand cap; Blind Nil not offered. | n/a |
| Hearts | Hearts can also be broken by leading from an all-hearts hand. | Target 50/100; Q♠ doesn't break hearts; ties. | n/a |
| Thirteen | n/a | Consecutive pairs beat four of a kind; 2–3 player scoring; target 5/10/15. | "Viet Cong" removed. |
| Rummy | n/a | Hand ends after 3 reshuffles; last-card discard exception; no "rummy" bonus; target. | n/a |
| Donkey | "Always finish with four cards" (not once the stock is empty); AI description was wrong. | Capturing is optional; table cards score for nobody; target 500/1000. | n/a |
| War | "~200 battles" removed. | 1,500-battle cap; draws; the won pile is shuffled. | n/a |
| Checkers | "Expert searches eight moves": it's 8 half-moves, 7 with optional captures. | A jump sequence must be completed; crowning ends the move. | n/a |
| Chess | n/a | Which positions are drawn for lack of material. | n/a |
| Solitaire | Implied you can go through the stock only once more; it's unlimited (−100 in Draw 1, −20 in Draw 3). | Full scoring table; score never below 0; when Finish appears. | n/a |
| Spider | "Unlimited undo" (capped at 500). | Score never below 0; runs removed automatically. | Also fixed in the game screen's meta description. |
| Tri Peaks | n/a | Undo is free but counts as a move. | n/a |
| Pyramid | n/a | Draws one card at a time; no recycle penalty. | n/a |
| Yacht Dice | n/a | Joker rule after scratching Yacht; forced 0; five of a kind isn't a Full House; ties. | n/a |
| Farkle | "Four of a kind is 1,000": four 1s score **1,100**. | Must set aside a scoring die before banking; ties. | n/a |
| Sudoku | "Always solvable by logic alone": Expert may need trial and error. "Daily streak": no Sudoku streak exists. Mistakes are counted even with Check off. | Daily puzzle uses the local date; what each level aims for. | Its own note now renders on the page. |

All 23 pages: the "Can I play free?" FAQ was replaced, and each game's own AI or game-screen note is shown. Built pages now range from 944 to 1,411 words.

---

## 5. Privacy and policy findings

| Item | Before | After |
|---|---|---|
| AdSense disclosure | Present and accurate (third-party cookies, Ads Settings, aboutads.info, youronlinechoices) | Unchanged |
| Adsterra disclosure | Present (and accurate while Adsterra ran) | Removed, because Adsterra is no longer integrated |
| Google Analytics | Called "anonymous" | Accurate description; opt-out link kept |
| EEA, UK and Switzerland consent | Promised a prompt that didn't exist in code | Consent Mode defaults to denied; text describes the actual behaviour |
| Terms of use | Missing | Added at `/terms` and linked in the footer |
| Contact | Email `contact@cardsarena.world` on the Contact, Privacy and Terms pages | OK |

**Google's consent requirement:** Google requires a Google-certified consent management platform (CMP) for ads served to visitors in the EEA, the UK and Switzerland. The code is now ready for one (Consent Mode defaults), but **the CMP itself must be turned on in AdSense** (section 9).

---

## 6. Technical SEO findings

| Check | Result |
|---|---|
| sitemap.xml | 29 URLs (Terms added), generated at build time. OK |
| robots.txt | Allows everything except account pages, plus the sitemap link. OK |
| ads.txt | `google.com, pub-3366385543056829, DIRECT, f08c47fec0942fa0`. OK |
| AdSense verification | `google-adsense-account` meta tag plus the adsbygoogle script loaded after hydration. OK |
| Canonicals | Correct on all 29 pages; `/play/*` points to `/games/*`. OK |
| Titles and descriptions | All unique, 17–61 characters and 99–157 characters. OK |
| H1 | Exactly one per page. OK |
| Structured data | WebSite, Organization, BreadcrumbList, VideoGame, FAQPage, all valid JSON (checked). OK |
| Status codes | Soft-404s and `/progress` fixed (H1, H2). `www` and trailing-slash redirects are 308. OK |
| Indexing | Not checked. Use Search Console → Pages to confirm which URLs are actually indexed. |
| Core Web Vitals | Not measured in this audit. The homepage HTML is ~212 KB (38 KB inline CSS plus decorative card markup). Check PageSpeed Insights or Search Console → Core Web Vitals. |
| Mobile | Viewport set; responsive layout. The sticky mobile ad bar (an Adsterra slot) has been removed. |

---

## 7. Advertising placement: after the changes

- **The only ad code:** Google AdSense (Auto ads), loaded after the page hydrates (`core/services/ads.service.ts`).
- **Removed entirely:**
  - Adsterra banners: side rails, inline, sticky mobile bar, in-game side columns.
  - Ads in game-over dialogs.
  - The "Sponsored" footer link.
- **Kept:** the dismissible ad-blocker notice, shown at most once a day and never during a game.

---

## 8. Files modified

**Deleted**
- `frontend/public/ads/banner-160x300.html`, `banner-160x600.html`, `banner-320x50.html`
- `frontend/src/app/shared/components/ad-banner/ad-banner.ts`

**Added**
- `frontend/src/app/pages/terms/terms.ts`
- `CARDARENA_ADSENSE_AUDIT_REPORT.md`

**Hosting, build and shell**
- `frontend/vercel.json`
- `frontend/scripts/postbuild.mjs`
- `frontend/src/app/app.ts`, `app.routes.ts`, `app.routes.server.ts`
- `frontend/src/styles.scss`

**Services**
- `core/services/ads.service.ts`
- `core/services/analytics.service.ts`

**Pages and shared components**
- `pages/game-detail/game-detail.html`
- `pages/games/games.ts`
- `pages/home/home.html`
- `pages/privacy/privacy.ts`
- `shared/components/footer/footer.ts`
- `shared/components/toast/toast.ts`

**Data:** `core/data/games.data.ts`

**Game content (22 files):** `games/*/*.content.ts`

**Game screens (ad-banner removal, 24 files):** `*-game.ts` and `*-game.html` for Bhabhi Thulla, Checkers, Chess, Farkle, Pyramid, Solitaire, Spider, Sudoku, Tri Peaks, War and Yacht, plus `games/core/ui/table-game-page.*`

All paths except the report are under `frontend/src/app/` unless shown otherwise.

**Verification:**
- `ng build`: OK, 29 routes prerendered.
- `vitest`: 262/262 passed.
- `tsc`: no errors.
- Built pages contain no Adsterra domains.

---

## 9. Needs manual action

1. **Deploy** these changes (commit, then push to the branch Vercel builds).
2. **Check the 404 fix after deploying:** `curl -I https://www.cardsarena.world/zzz-test` should return the "Page not found" page, not the homepage.
   - If it still shows the homepage, check Vercel → Project Settings → Build & Deployment (Framework Preset should be "Other") and any dashboard-level rewrites.
   - The response may still be HTTP 200. The page is marked noindex, which Google accepts, but a true 404 status is better if Vercel can be set to serve `404.html` natively.
3. **AdSense → Privacy & messaging → European regulations:** create and publish a consent message using Google's certified CMP. It updates the Consent Mode defaults added in the code.
4. **AdSense → Auto ads → Page exclusions:** exclude `cardsarena.world/play/*` so anchor and vignette ads never cover a game.
5. **About page:** add who runs CardArena (person or company name and country).
6. **Search Console:** submit the sitemap, then use URL Inspection on `/`, a game page and `/terms` after deploying, and check Pages → Indexed.
7. Wait a few days for Google to re-crawl, then click **Request review** in AdSense.

## 10. Remaining risks

- **Domain age and traffic:** a young site with little organic traffic can be rejected for "low value content" or "site not ready" regardless of quality.
- **Game screens are mostly interactive** (`/play/*` pages have little text). They're canonicalised to the content pages, which is the correct setup, but a reviewer who lands only on a game screen sees little text.
- **The ad-blocker notice** is allowed by Google, but some reviewers find these prompts intrusive. Consider removing it until AdSense is approved.
- **Bot levels:** in some trick-taking games, Hard and Expert play cards the same way (the shared trick bot only distinguishes Easy, Normal and Hard-or-above). The pages now say so honestly; give the levels distinct play if you want them to differ.

## 11. Final readiness assessment

**Code:** ready. The policy-risk items found (a second ad network, deceptive placements, soft-404 duplicates, inaccurate claims, missing consent defaults) are resolved in the codebase.

**Overall:** ready to request review **after** deploying and completing items 1–4 in section 9. This does not guarantee approval.
