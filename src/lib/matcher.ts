import fs from 'fs/promises';

type TechnologyDictionaryEntry = {
  npmPackage: string;
  slug: string;
};

let packageIndexPromise: Promise<Map<string, string>> | undefined;

function getPackageIndex(): Promise<Map<string, string>> {
  packageIndexPromise ??= fs
    .readFile(new URL('../../data/technologies.json', import.meta.url), 'utf8')
    .then((contents) => {
      const technologies = JSON.parse(contents) as TechnologyDictionaryEntry[];
      return new Map(technologies.map(({ npmPackage, slug }) => [npmPackage, slug]));
    });

  return packageIndexPromise;
}

export async function matchDependencies(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}): Promise<string[]> {
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };

  const packageIndex = await getPackageIndex();
  const matched = new Set<string>();
  for (const name of Object.keys(deps)) {
    const slug = packageIndex.get(name);
    if (slug) matched.add(slug);
  }
  return Array.from(matched);
}

// Keep export for backward compatibility
export const matchTechnologies = matchDependencies;
