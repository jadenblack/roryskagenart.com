import { describe, it, expect } from 'vitest';
import { buildEditPath, parseAdminPath } from '../lib/adminRoute';

describe('parseAdminPath', () => {
  it('resolves the dashboard route', () => {
    expect(parseAdminPath('/admin')).toEqual({ subPath: '', editSlug: null });
    expect(parseAdminPath('/admin/')).toEqual({ subPath: '', editSlug: null });
  });

  it('resolves a plain section route', () => {
    expect(parseAdminPath('/admin/catalog')).toEqual({ subPath: 'catalog', editSlug: null });
    expect(parseAdminPath('/admin/users')).toEqual({ subPath: 'users', editSlug: null });
  });

  it('extracts the deep-linked edit slug', () => {
    expect(parseAdminPath('/admin/catalog?edit=the-balloon-cats-ii')).toEqual({
      subPath: 'catalog',
      editSlug: 'the-balloon-cats-ii',
    });
  });

  it('decodes a percent-encoded slug', () => {
    expect(parseAdminPath('/admin/catalog?edit=the%20cats').editSlug).toBe('the cats');
  });

  it('treats a blank or missing edit parameter as absent', () => {
    expect(parseAdminPath('/admin/catalog?edit=').editSlug).toBeNull();
    expect(parseAdminPath('/admin/catalog?edit=%20').editSlug).toBeNull();
    expect(parseAdminPath('/admin/catalog?other=1').editSlug).toBeNull();
  });

  it('tolerates a path without the /admin prefix', () => {
    expect(parseAdminPath('catalog?edit=cat').subPath).toBe('catalog');
  });

  it('tolerates a trailing slash on a section route', () => {
    expect(parseAdminPath('/admin/catalog/').subPath).toBe('catalog');
  });
});

describe('buildEditPath', () => {
  it('round-trips through the parser', () => {
    const slug = 'the-balloon-cats-ii';
    const parsed = parseAdminPath(buildEditPath(slug));
    expect(parsed).toEqual({ subPath: 'catalog', editSlug: slug });
  });

  it('escapes characters that would break the query string', () => {
    const parsed = parseAdminPath(buildEditPath('a&b=c'));
    expect(parsed.editSlug).toBe('a&b=c');
  });
});
