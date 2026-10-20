# Public production-build lab audit

Lighthouse13.5.0 ran against the rebuilt local production server, using Chrome for Testing156 from the matching Playwright1.64.1 Linux image. Default simulated mobile throttling used a412×823viewport,4×CPU slowdown,150ms RTT and1638.4Kbps throughput. This is a local lab snapshot with synthetic/unconfigured hosted dependencies, not a production field study or measured improvement against the previous site.

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 98 | 100 | 100 | 100 | 2.497s | 0 | 36ms |
| Work, after contrast fix | 99 | 100 | 100 | 100 | 2.113s | 0 | 28ms |
| Join | 99 | 100 | 100 | 100 | 2.106s | 0 | 38.5ms |
| Contact | 97 | 100 | 100 | 100 | 2.678s | 0 | 36.5ms |

The first Work audit found actual insufficient contrast: white at75% opacity on the blue invitation background measured4.05:1 against its4.5:1 requirement. The paragraph now uses full white. A fresh build/server restart and re-audit passed the contrast check; Work accessibility changed from97to100 in these two runs. No warnings were returned. Timing differences are lab variance, not a claimed speed gain from that color change.

Raw HTML and JSON reports are retained under `.audit/lighthouse/`, including the original failing Work result and the corrected `work-mobile-fixed` reports. `evidence/public-lab-summary.json` records exact values, fetch times, settings and SHA-256 hashes of the raw JSON files.

The lab server has Clerk disabled and a deliberately invalid Supabase endpoint; Join exercises the unavailable recruitment state, and client-approved project content is absent. Configured hosted identity, real recruitment/project data, provider scripts, deployment caching and real network/device conditions can change these measurements. Automated100scores do not establish search ranking, conversion, complete accessibility, human comprehension or world-class acceptance. Physical-device and assistive-technology work remain outstanding. No deployment or hosted write was performed.
