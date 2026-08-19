import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../lib/logger.js';

interface Technology {
  slug: string;
  name: string;
  category: string;
  repoCount: number;
}

interface Repository {
  fullName: string;
  url: string;
  stars: number;
  technologies: string[];
}

interface Pairing {
  technologyA: string;
  technologyB: string;
  repositoryCount: number;
  strengthScore: number;
}

interface TrendingEntry {
  slug: string;
  name: string;
  trendScore: number;
  adoptionCount?: number;
  adoptionDelta?: number;
  snapshotDate: string;
}

async function main() {
  const datasetDir = path.join(process.cwd(), 'public', 'datasets');
  const readmePath = path.join(process.cwd(), 'README.md');

  try {
    const techData = JSON.parse(await fs.readFile(path.join(datasetDir, 'technologies.json'), 'utf8'));
    const pairingData = JSON.parse(await fs.readFile(path.join(datasetDir, 'pairings.json'), 'utf8'));
    const trendData = JSON.parse(await fs.readFile(path.join(datasetDir, 'trending.json'), 'utf8'));

    const technologies: Technology[] = techData.technologies;
    const pairings: Pairing[] = pairingData.pairings;
    const trending: TrendingEntry[] = trendData.trending;

    const totalRepos = 5422; // Placeholder, derived from previous README context.
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Generate content
    let content = `\n<!-- STACKPULSE:SUMMARY:START -->\n`;
    content += `## The Pulse (Updated: ${dateStr})\n\n`;
    content += `🔗 [View the live dashboard →](https://stack-pulse-data.vercel.app/)\n\n`;
    content += `### 📊 Daily Snapshot\n\n`;

    content += `| Technology | Adoption | Trend Score |\n|------------|---------:|------------:|\n`;
    const topTech = [...technologies].sort((a, b) => b.repoCount - a.repoCount).slice(0, 10);
    topTech.forEach(t => {
      const adoption = ((t.repoCount / totalRepos) * 100).toFixed(1) + '%';
      const trendEntry = trending.find(tr => tr.slug === t.slug);
      const trend = trendEntry?.trendScore || 0;
      const trendDisplay = trend > 0 ? `▲ +${trend.toFixed(2)}` : trend < 0 ? `▼ ${trend.toFixed(2)}` : '-';
      content += `| ${t.name} | ${adoption} | ${trendDisplay} |\n`;
    });

    content += `\n<small><i>Trend Score is a log-scaled growth index: (current adoption / prior adoption) × log10(current adoption + 10), weighted so both the rate of change and the technology's overall scale matter.</i></small>\n\n`;

    // Load weekly trending data
    const weeklyData = JSON.parse(await fs.readFile(path.join(datasetDir, 'weekly-trending.json'), 'utf8').catch(() => '{"technologies":[]}'));
    const weeklyTechs = weeklyData.technologies || [];

    // Sort by weeklyPercentChange descending
    const sortedWeeklyTechs = [...weeklyTechs].sort((a: any, b: any) => {
      const aVal = a.weeklyPercentChange ?? 0;
      const bVal = b.weeklyPercentChange ?? 0;
      return bVal - aVal;
    });

    content += `### 🔥 Hot This Week\n| Rank | Technology | Category | Weekly Change |\n|------|------------|----------|-------------:|\n`;
    sortedWeeklyTechs.slice(0, 10).forEach((t: any, i: number) => {
      const deltaDisplay = t.weeklyPercentChange !== null && t.weeklyPercentChange !== undefined
        ? `▲ +${t.weeklyPercentChange}%`
        : `N/A`;
      content += `| ${i + 1} | ${t.name} | ${t.category} | ${deltaDisplay} |\n`;
    });
 
    content += `\n### 📉 Falling This Month\n| Name | 30-Day Trend |\n|---|---|\n`;
    const falling = [...trending]
      .filter(t => (t.adoptionDelta ?? 0) < 0)
      .map(t => {
        // Compute percentage change: (delta / previousCount) * 100
        // previousCount = currentCount - delta
        const delta = t.adoptionDelta ?? 0;
        const techInfo = technologies.find(tech => tech.slug === t.slug);
        const currentCount = techInfo ? techInfo.repoCount : (t.adoptionCount ?? 0);
        const previousCount = currentCount - delta;
        const percentChange = previousCount > 0 ? (delta / previousCount) * 100 : 0;
        return { ...t, percentChange };
      })
      .sort((a, b) => a.percentChange - b.percentChange)
      .slice(0, 10);

    falling.forEach(t => content += `| ${t.name} | ${t.percentChange.toFixed(1)}% |\n`);
    if (falling.length === 0) content += `| No declining trends this month | - |\n`;
    content += `\n`;

    content += `### 🏷️ Top Per Category\n| Category | Top Technology |\n|---|---|\n`;
    const categories = Array.from(new Set(technologies.map(t => t.category))).sort();
    categories.forEach(cat => {
      const catTechs = technologies.filter(t => t.category === cat);
      const top = catTechs.sort((a, b) => b.repoCount - a.repoCount)[0];
      content += `| ${cat} | ${top ? top.name : '—'} |\n`;
    });
    content += `\n`;

    content += `### 🔗 Top Pairings\n| Tech A | Tech B | Strength Score |\n|---|---|---|\n`;
    const topPairings = [...pairings].sort((a, b) => b.strengthScore - a.strengthScore).slice(0, 10);
    topPairings.forEach(p => {
      content += `| ${p.technologyA} | ${p.technologyB} | ${p.strengthScore.toFixed(2)} |\n`;
    });

    content += `\n*Strength Score measures the co-occurrence affinity between two technologies using the Jaccard similarity coefficient:*\n\n`;
    content += `$$\n\\frac{|A \\cap B|}{|A| + |B| - |A \\cap B|}\n$$\n\n`;
    content += `*The number of repositories containing both divided by the number of repositories containing either. Scores range from 0 to 1.*\n\n`;

    content += `<!-- STACKPULSE:SUMMARY:END -->\n`;

    // Update README
    let readme = await fs.readFile(readmePath, 'utf8');
    const startMarker = '<!-- STACKPULSE:SUMMARY:START -->';
    const endMarker = '<!-- STACKPULSE:SUMMARY:END -->';

    if (!readme.includes(startMarker) || !readme.includes(endMarker)) {
      throw new Error('Markers not found in README.md');
    }

    const before = readme.substring(0, readme.indexOf(startMarker));
    const after = readme.substring(readme.indexOf(endMarker) + endMarker.length);

    await fs.writeFile(readmePath, before + content.trim() + '\n\n' + after.trim() + '\n');
    logger.info({ service: 'update-readme', status: 'success' });

  } catch (err: any) {
    logger.error({ service: 'update-readme', status: 'error', error: err.message });
    process.exit(0);
  }
}

main();
