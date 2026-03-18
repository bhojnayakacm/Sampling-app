import type { ProductItem } from '@/types';
import { SUB_CATEGORY_LABELS } from '@/types';
import type { ProductTemplate } from '@/lib/api/templates';

export interface TemplateGroup {
  label: string;
  qualities: string[];
  isKit: boolean;
  order: number;
}

/**
 * Groups template items into a strict display hierarchy:
 * 1. Marble          — comma-separated qualities
 * 2. Magro - Tile    — comma-separated qualities
 * 3. Magro - Stone   — comma-separated qualities
 * 4. Magro - Quartz  — comma-separated qualities
 * 5. Magro - Terrazzo — comma-separated qualities
 * 6. Kits            — e.g. "Marble Kit (6x4), Magro Kit (4x4)"
 *
 * Works with both ProductItem[] (form state) and template saved items.
 */
export function groupTemplateItems(items: TemplateItemLike[]): TemplateGroup[] {
  const marble: string[] = [];
  const magroTile: string[] = [];
  const magroStone: string[] = [];
  const magroQuartz: string[] = [];
  const magroTerrazzo: string[] = [];
  const kits: string[] = [];

  for (const item of items) {
    if (!item.category) continue;

    // Kit items
    if (item.is_kit) {
      const kitCat = item.category === 'marble' ? 'Marble' : 'Magro';
      const size = item.sample_size || '';
      kits.push(size ? `${kitCat} Kit (${size})` : `${kitCat} Kit`);
      continue;
    }

    // Collect qualities from multi-select or legacy single field
    const qualities = getItemQualities(item);

    if (item.category === 'marble') {
      marble.push(...qualities);
    } else if (item.category === 'magro') {
      const sub = item.sub_category || '';
      switch (sub) {
        case 'tile':     magroTile.push(...qualities); break;
        case 'stone':    magroStone.push(...qualities); break;
        case 'quartz':   magroQuartz.push(...qualities); break;
        case 'terrazzo': magroTerrazzo.push(...qualities); break;
        default:         magroTile.push(...qualities); break; // fallback
      }
    }
  }

  const groups: TemplateGroup[] = [];

  if (marble.length > 0) {
    groups.push({ label: 'Marble', qualities: marble, isKit: false, order: 1 });
  }
  if (magroTile.length > 0) {
    groups.push({ label: `Magro - ${SUB_CATEGORY_LABELS.tile}`, qualities: magroTile, isKit: false, order: 2 });
  }
  if (magroStone.length > 0) {
    groups.push({ label: `Magro - ${SUB_CATEGORY_LABELS.stone}`, qualities: magroStone, isKit: false, order: 3 });
  }
  if (magroQuartz.length > 0) {
    groups.push({ label: `Magro - ${SUB_CATEGORY_LABELS.quartz}`, qualities: magroQuartz, isKit: false, order: 4 });
  }
  if (magroTerrazzo.length > 0) {
    groups.push({ label: `Magro - ${SUB_CATEGORY_LABELS.terrazzo}`, qualities: magroTerrazzo, isKit: false, order: 5 });
  }
  if (kits.length > 0) {
    groups.push({ label: 'Kits', qualities: kits, isKit: true, order: 6 });
  }

  return groups.sort((a, b) => a.order - b.order);
}

// ============================================================
// Helpers
// ============================================================

/** Shape that works for both ProductItem (form) and saved template items */
type TemplateItemLike = Pick<ProductItem, 'category' | 'sub_category' | 'is_kit' | 'sample_size'> & {
  selected_qualities?: string[];
  quality?: string;
};

function getItemQualities(item: TemplateItemLike): string[] {
  if (item.selected_qualities && item.selected_qualities.length > 0) {
    return [...item.selected_qualities];
  }
  if (item.quality) {
    return [item.quality];
  }
  return ['(unspecified)'];
}

/**
 * Convenience: group a ProductTemplate's items (same function, typed for template data)
 */
export function groupProductTemplateItems(template: ProductTemplate): TemplateGroup[] {
  return groupTemplateItems(template.items as TemplateItemLike[]);
}
