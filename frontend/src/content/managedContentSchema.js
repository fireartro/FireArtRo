import { z } from 'zod';
import contract from './siteContent.schema.json';

// The field contract is generated from backend/cms_models.py.
function fromContract(node) {
  if (node.$ref) return fromContract(contract.$defs[node.$ref.split('/').pop()]);
  if (node.const !== undefined) return z.literal(node.const);
  if (node.enum) return z.enum(node.enum);
  if (node.anyOf) return z.union(node.anyOf.map(fromContract));
  let schema;
  if (node.type === 'object') {
    schema = z.object(Object.fromEntries(Object.entries(node.properties).map(([key, definition]) => {
      let field = fromContract(definition);
      if (!node.required?.includes(key)) field = definition.default !== undefined ? field.default(definition.default) : field.optional();
      return [key, field];
    }))).strict();
  } else if (node.type === 'array') {
    schema = z.array(fromContract(node.items));
    if (node.minItems !== undefined) schema = schema.min(node.minItems);
    if (node.maxItems !== undefined) schema = schema.max(node.maxItems);
  } else if (node.type === 'string') {
    schema = z.string().trim();
    if (node.minLength !== undefined) schema = schema.min(node.minLength);
    if (node.maxLength !== undefined) schema = schema.max(node.maxLength);
    if (node.pattern) schema = schema.regex(new RegExp(node.pattern));
    if (node.format === 'email') schema = schema.email();
  } else if (node.type === 'integer' || node.type === 'number') {
    schema = z.number().finite();
    if (node.type === 'integer') schema = schema.int();
    if (node.minimum !== undefined) schema = schema.min(node.minimum);
    if (node.maximum !== undefined) schema = schema.max(node.maximum);
    if (node.exclusiveMinimum !== undefined) schema = schema.gt(node.exclusiveMinimum);
  } else if (node.type === 'boolean') schema = z.boolean();
  else if (node.type === 'null') schema = z.null();
  else throw new Error('Tip de contract CMS necunoscut.');
  return schema;
}

export function isSafeContentUrl(value, webOnly = false) {
  if (!value) return true;
  if (/[\u0000-\u0020\\]/.test(value)) return false;
  if (!webOnly && (/^\/(?!\/)/.test(value) || value.startsWith('#') || /^tel:\+[1-9]\d{7,14}$/.test(value) || /^mailto:[^@]+@[^@]+$/.test(value))) return true;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}

const schema = fromContract(contract).superRefine((content, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message });
  const mediaIds = new Set(content.mediaItems.map(item => item.id));
  const walk = (value, path = []) => {
    if (Array.isArray(value)) {
      const ids = value.map(item => item?.id).filter(id => id !== undefined);
      if (new Set(ids).size !== ids.length) issue(path, 'Identificatorii trebuie să fie unici.');
      value.forEach((item, index) => walk(item, [...path, index]));
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => {
        const next = [...path, key];
        if (typeof item === 'string') {
          if (/(Href|Url)$/.test(key) || ['href', 'src', 'poster', 'thumbnail'].includes(key)) {
            if (!isSafeContentUrl(item, /Url$/.test(key))) issue(next, 'Introdu o adresă sigură și validă.');
          }
          if ((/MediaId$/.test(key) || key === 'mediaId') && item && !mediaIds.has(item)) issue(next, 'Materialul selectat nu există în galerie.');
        }
        walk(item, next);
      });
      if ('ctaLabel' in value && Boolean(value.ctaLabel) !== Boolean(value.ctaHref)) issue(path, 'Butonul are nevoie de text și destinație.');
      if (['image', 'video', 'promo'].includes(value.type) && 'src' in value && !value.src) issue([...path, 'src'], 'Alege un fișier.');
      if (value.type === 'youtube' && !value.youtubeUrl) issue([...path, 'youtubeUrl'], 'Introdu linkul YouTube.');
    } else if (typeof value === 'string' && path[0] === 'legalPages' && /[<>]/.test(value)) issue(path, 'Folosește doar text simplu.');
  };
  walk(content);
});

export function validateManagedContent(content) {
  const result = schema.safeParse(content);
  return result.success ? { content: result.data, errors: [] } : { content: null,
    errors: result.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.code === 'custom' ? issue.message : 'Verifică valoarea și limitele acestui câmp.' })),
  };
}
export function normalizePublishedContent(content) {
  const result = validateManagedContent(content);
  if (result.errors.length) throw new Error('Conținut public invalid.');
  return result.content;
}
