import { describe, it, expect } from 'vitest';
import { GET as getFalling } from '@/app/api/trending/falling/route';
import { GET as getTopCategories } from '@/app/api/categories/top/route';
import { GET as getTopPairings } from '@/app/api/pairings/top/route';
import { NextRequest } from 'next/server';

describe('New Card API Endpoints', () => {
  it('GET /api/trending/falling should return status 200 or json object', async () => {
    const req = new NextRequest('http://localhost:3000/api/trending/falling?limit=5');
    const res = await getFalling(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data).toHaveProperty('technologies');
    expect(Array.isArray(data.technologies)).toBe(true);
  });

  it('GET /api/categories/top should return status 200 and categories array', async () => {
    const req = new NextRequest('http://localhost:3000/api/categories/top');
    const res = await getTopCategories(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data).toHaveProperty('categories');
    expect(Array.isArray(data.categories)).toBe(true);
  });

  it('GET /api/pairings/top should return status 200 and pairings array', async () => {
    const req = new NextRequest('http://localhost:3000/api/pairings/top?limit=5');
    const res = await getTopPairings(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data).toHaveProperty('pairings');
    expect(Array.isArray(data.pairings)).toBe(true);
  });
});
