---
name: vercel-deployment-data-issue
description: Top Pairings and Top Per Category show data locally but not on Vercel
metadata:
  type: project
---

The user's app shows data for "Top Pairings" and "Top Per Category" sections locally, but not on their live Vercel deployment. These sections rely on database calculations performed by scripts (e.g., `src/scripts/aggregate.ts`).

**Why:**
The data isn't showing because the aggregation scripts likely haven't been run on the production database in the Vercel environment. Vercel deployment only runs `prisma generate && next build`, it does not automatically run data aggregation or seeding scripts.

**How to apply:**
1. [[vercel-deployment-data-issue]] is a known deployment pattern issue.
2. The aggregation scripts must be executed against the production Neon database.
3. Suggest adding a build hook or running the aggregation script manually after deployment, or including it in the CI/CD pipeline if appropriate.
4. Verify the database is actually populated by connecting to the Neon console.
